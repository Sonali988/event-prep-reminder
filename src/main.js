import {
  loadStateAsync,
  normalizeSavedState,
  resetChecklist,
  saveStateLocal,
  setItemChecked,
  setItemChangeOccurred,
  stampState,
  updateTestimonyTimers,
  updateServiceNotes,
} from "./state.js";
import { createUi } from "./ui.js";
import { buildBackstageMessage, formatDurationInput, normalizeDuration } from "./testimonyTimers.js";
import {
  buildServiceNotesMessage,
  getDefaultServiceNotes,
  hasServiceNotes,
} from "./serviceNotes.js";
import {
  fetchRemoteState,
  getClientId,
  markPushed,
  probeSync,
  pullRemoteStateNow,
  scheduleRemoteSave,
  setSyncCallbacks,
  startSyncPolling,
} from "./sync.js";
import { exportChecklistPdf } from "./checklistPdf.js";

const ACTIVE_PANEL_KEY = "service-prep-active-panel";

const ui = createUi(document.getElementById("app"));
let state = null;
let clockTimer = null;
let pollTimer = null;

function switchPanel(panelId) {
  ui.els.appNav?.querySelectorAll(".app-nav__tab").forEach((tab) => {
    const active = tab.dataset.panel === panelId;
    tab.classList.toggle("app-nav__tab--active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll(".app-panel").forEach((panel) => {
    const active = panel.id === `panel-${panelId}`;
    panel.classList.toggle("app-panel--active", active);
    panel.hidden = !active;
  });

  try {
    localStorage.setItem(ACTIVE_PANEL_KEY, panelId);
  } catch {
    // Ignore storage errors in private browsing.
  }
}

function restoreActivePanel() {
  try {
    const saved = localStorage.getItem(ACTIVE_PANEL_KEY);
    if (saved && document.getElementById(`panel-${saved}`)) {
      switchPanel(saved);
    }
  } catch {
    // Ignore storage errors.
  }
}

function setActionsMenuOpen(open) {
  const trigger = document.getElementById("actions-menu-btn");
  const popover = document.getElementById("actions-menu-popover");

  if (!trigger || !popover) {
    return;
  }

  trigger.setAttribute("aria-expanded", String(open));
  popover.classList.toggle("hidden", !open);
}

function closeActionsMenu() {
  setActionsMenuOpen(false);
}

function toggleActionsMenu() {
  const popover = document.getElementById("actions-menu-popover");
  setActionsMenuOpen(popover?.classList.contains("hidden"));
}

function isUserEditing() {
  const active = document.activeElement;
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement
  );
}

function commitState(nextState) {
  state = stampState(nextState, getClientId());
  saveStateLocal(state);
  scheduleRemoteSave(state);
  return state;
}

function applyRemoteState(remote) {
  state = normalizeSavedState(remote);
  saveStateLocal(state);
  markPushed(state.updatedAt);
  ui.renderAll(state);
}

function persist(nextState) {
  commitState(nextState);
  ui.renderChecklist(state);
  ui.renderStatus(state);
}

function persistTestimonyTimers(testimonyTimers) {
  commitState(updateTestimonyTimers(state, testimonyTimers));
  ui.updateTestimonyPreview(state);
}

function readServiceNotesFromDom() {
  return {
    remarks: ui.els.serviceRemarksInput?.value ?? "",
    observations: ui.els.serviceObservationsInput?.value ?? "",
    challenges: ui.els.serviceChallengesInput?.value ?? "",
  };
}

function persistServiceNotes(serviceNotes) {
  commitState(updateServiceNotes(state, serviceNotes));
  ui.renderServiceNotes(state);
  ui.renderStatus(state);
}

function showServiceNotesStatus(message, isError = false) {
  const statusEl = ui.els.serviceNotesStatus;
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.toggle("service-notes__status--error", isError);
  statusEl.classList.remove("hidden");
  setTimeout(() => statusEl.classList.add("hidden"), 2500);
}

async function copyServiceNotes() {
  const notes = state.serviceNotes;

  if (!hasServiceNotes(notes)) {
    showServiceNotesStatus("Add some notes before copying.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(buildServiceNotesMessage(notes));
    showServiceNotesStatus("Notes copied to clipboard.");
  } catch {
    showServiceNotesStatus("Could not copy — select the text and copy manually.", true);
  }
}

function applyTestimonyInput(target) {
  const { kind, id, field } = target.dataset;
  const testimonyTimers = {
    ...state.testimonyTimers,
    main: state.testimonyTimers.main.map((item) => ({ ...item })),
    backup: state.testimonyTimers.backup.map((item) => ({ ...item })),
  };

  if (kind === "intro") {
    testimonyTimers.introTimer = target.value;
    return testimonyTimers;
  }

  if (kind === "main" && id && field) {
    testimonyTimers.main = testimonyTimers.main.map((item) =>
      item.id === id ? { ...item, [field]: target.value } : item,
    );
    return testimonyTimers;
  }

  if (kind === "backup" && id) {
    testimonyTimers.backup = testimonyTimers.backup.map((item) =>
      item.id === id ? { ...item, name: target.value } : item,
    );
  }

  return testimonyTimers;
}

async function copyBackstageMessage() {
  const message = buildBackstageMessage(state.testimonyTimers);
  const statusEl = ui.els.testimonyTimers.querySelector("#copy-status");

  try {
    await navigator.clipboard.writeText(message);
    if (statusEl) {
      statusEl.textContent = "Copied to clipboard.";
      statusEl.classList.remove("hidden");
      setTimeout(() => statusEl.classList.add("hidden"), 2500);
    }
  } catch {
    if (statusEl) {
      statusEl.textContent = "Could not copy — select the message and copy manually.";
      statusEl.classList.remove("hidden");
    }
  }
}

function bindEvents() {
  const actionsMenu = document.getElementById("actions-menu");
  const actionsMenuBtn = document.getElementById("actions-menu-btn");

  actionsMenuBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleActionsMenu();
  });

  document.addEventListener("click", (event) => {
    if (!actionsMenu?.contains(event.target)) {
      closeActionsMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeActionsMenu();
    }
  });

  ui.els.appNav?.addEventListener("click", (event) => {
    const tab = event.target.closest(".app-nav__tab");
    if (!tab?.dataset.panel) {
      return;
    }

    switchPanel(tab.dataset.panel);
  });

  ui.els.checklist.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
      return;
    }

    const groupId = target.dataset.groupId;
    const itemId = target.dataset.itemId;
    if (!groupId || !itemId) {
      return;
    }

    if (target.hasAttribute("data-change-toggle")) {
      persist(setItemChangeOccurred(state, groupId, itemId, target.checked));
      return;
    }

    persist(setItemChecked(state, groupId, itemId, target.checked));
  });

  ui.els.resetBtn.addEventListener("click", () => {
    closeActionsMenu();

    if (!window.confirm("Reset the checklist and testimony timers? Service notes will be kept.")) {
      return;
    }

    persist(resetChecklist(state));
    ui.renderTestimonyTimers(state);
  });

  document.getElementById("export-checklist-pdf-btn")?.addEventListener("click", () => {
    closeActionsMenu();
    exportChecklistPdf(state);
  });

  ui.els.testimonyTimers.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.dataset.field === "duration" || target.dataset.kind === "intro") {
      const formatted = formatDurationInput(target.value);
      if (formatted !== target.value) {
        target.value = formatted;
      }
    }

    persistTestimonyTimers(applyTestimonyInput(target));
  });

  ui.els.testimonyTimers.addEventListener(
    "blur",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (target.dataset.field !== "duration" && target.dataset.kind !== "intro") {
        return;
      }

      const normalized = normalizeDuration(target.value);
      if (normalized === target.value) {
        return;
      }

      target.value = normalized;
      persistTestimonyTimers(applyTestimonyInput(target));
    },
    true,
  );

  ui.els.testimonyTimers.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.id === "copy-backstage-message-btn") {
      copyBackstageMessage();
    }
  });

  const serviceNotesPanel = document.getElementById("service-notes-panel");

  serviceNotesPanel?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) {
      return;
    }

    persistServiceNotes(readServiceNotesFromDom());
  });

  serviceNotesPanel?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.id === "copy-service-notes-btn") {
      copyServiceNotes();
      return;
    }

    if (target.id === "clear-service-notes-btn") {
      if (!hasServiceNotes(state.serviceNotes)) {
        return;
      }

      if (!window.confirm("Clear all service notes?")) {
        return;
      }

      persistServiceNotes(getDefaultServiceNotes());
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      ui.updateClock();
      pullRemoteStateNow(() => state, isUserEditing);
    }
  });
}

async function init() {
  ui.setSyncStatus("loading");

  setSyncCallbacks({
    onStatusChange: (status, detail) => ui.setSyncStatus(status, detail),
    onRemoteState: (remote) => applyRemoteState(remote),
  });

  await probeSync();
  state = await loadStateAsync(fetchRemoteState);

  bindEvents();
  restoreActivePanel();
  ui.updateClock();
  clockTimer = setInterval(() => ui.updateClock(), 1000);
  ui.renderAll(state);
  pollTimer = startSyncPolling(() => state, isUserEditing);
}

init();
