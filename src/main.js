import {
  applyTestMode,
  hasEndTimePassed,
  isReminderDue,
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

const TEST_MODE = new URLSearchParams(window.location.search).get("test") === "1";

const ui = createUi(document.getElementById("app"));
let state = null;
let tickTimer = null;
let clockTimer = null;
let pollTimer = null;

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
  ui.renderAll(state);
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

function stopReminders() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function triggerFinalAlert() {
  if (!state.remindersEnabled) {
    ui.hideReminderModal();
    return;
  }

  if (!state.finalAlertShown) {
    state = commitState({ ...state, finalAlertShown: true });
    ui.showFinalAlert();
  }
  ui.hideReminderModal();
}

function handleEndTimeReached() {
  if (state.stopped) {
    return;
  }

  state = commitState({ ...state, stopped: true });
  triggerFinalAlert();
  stopReminders();
  ui.renderAll(state);
}

function showReminderIfDue() {
  if (state.stopped || hasEndTimePassed(state.endTime)) {
    handleEndTimeReached();
    return;
  }

  if (!state.remindersEnabled) {
    ui.hideReminderModal();
    ui.renderStatus(state);
    return;
  }

  if (isReminderDue(state)) {
    ui.renderReminderModal(state, new Date());
    ui.showReminderModal();
    state = commitState({ ...state, lastReminderAt: new Date().toISOString() });
  }

  ui.renderStatus(state);
}

function onTick() {
  const now = new Date();

  if (hasEndTimePassed(state.endTime, now)) {
    handleEndTimeReached();
    return;
  }

  showReminderIfDue();
  ui.renderStatus(state, now);
}

function startTimers() {
  ui.updateClock();
  clockTimer = setInterval(() => ui.updateClock(), 1000);

  const tickMs = TEST_MODE ? 5000 : 60000;
  tickTimer = setInterval(onTick, tickMs);

  ui.renderAll(state);

  if (hasEndTimePassed(state.endTime)) {
    handleEndTimeReached();
    return;
  }

  if (state.remindersEnabled && isReminderDue(state)) {
    setTimeout(showReminderIfDue, 500);
  }
}

function bindEvents() {
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

  ui.els.endTimeInput.addEventListener("change", (event) => {
    const value = event.target.value;
    if (!value) {
      return;
    }

    persist({
      ...state,
      endTime: value,
      stopped: false,
      finalAlertShown: false,
    });
  });

  ui.els.intervalRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) {
        return;
      }

      persist({
        ...state,
        reminderIntervalMinutes: Number(radio.value),
      });
    });
  });

  ui.els.remindersEnabledInput.addEventListener("change", (event) => {
    const enabled = event.target.checked;

    persist({
      ...state,
      remindersEnabled: enabled,
      lastReminderAt: enabled ? state.lastReminderAt : null,
    });

    if (!enabled) {
      ui.hideReminderModal();
    } else if (!state.stopped && isReminderDue(state)) {
      setTimeout(showReminderIfDue, 300);
    }
  });

  ui.els.resetBtn.addEventListener("click", () => {
    if (!window.confirm("Reset the checklist and testimony timers? Settings and service notes will be kept.")) {
      return;
    }

    persist(resetChecklist(state));
    if (state.remindersEnabled && !state.stopped && isReminderDue(state)) {
      setTimeout(showReminderIfDue, 300);
    }
  });

  document.getElementById("export-checklist-pdf-btn")?.addEventListener("click", () => {
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

  ui.els.reminderDismissBtn.addEventListener("click", () => {
    ui.hideReminderModal();
    ui.focusFirstUnchecked();
  });

  ui.els.finalAlertDismissBtn.addEventListener("click", () => {
    ui.hideFinalAlert();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      onTick();
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

  if (TEST_MODE) {
    state = commitState(applyTestMode(state));
  }

  bindEvents();
  startTimers();
  pollTimer = startSyncPolling(() => state, isUserEditing);
}

init();
