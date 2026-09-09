import {
  getGroupProgress,
  isChangeTrackedItem,
  isChecklistItemVisible,
  getChangeTrackMessage,
} from "./state.js";
import {
  buildBackstageMessage,
  formatDurationSeconds,
  sumMainTestimonySeconds,
} from "./testimonyTimers.js";
import { hasServiceNotes } from "./serviceNotes.js";

const GROUP_ACCENTS = {
  media: "media",
  apps: "apps",
  prep_before_service: "prep",
};

function formatClock(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getOverallProgress(state) {
  let done = 0;
  let total = 0;

  for (const group of state.groups) {
    const progress = getGroupProgress(group);
    done += progress.done;
    total += progress.total;
  }

  return {
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 100,
    remaining: total - done,
  };
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function createUi(root) {
  const els = {
    liveClock: root.querySelector("#live-clock"),
    syncStatus: root.querySelector("#sync-status"),
    statusStrip: root.querySelector("#status-strip"),
    progressBarFill: root.querySelector("#progress-bar-fill"),
    checklistTabBadge: root.querySelector("#checklist-tab-badge"),
    notesTabBadge: root.querySelector("#notes-tab-badge"),
    checklist: root.querySelector("#checklist"),
    resetBtn: root.querySelector("#reset-checklist-btn"),
    testimonyTimers: root.querySelector("#testimony-timers"),
    serviceRemarksInput: root.querySelector("#service-remarks-input"),
    serviceObservationsInput: root.querySelector("#service-observations-input"),
    serviceChallengesInput: root.querySelector("#service-challenges-input"),
    serviceNotesStatus: root.querySelector("#service-notes-status"),
    appNav: root.querySelector(".app-nav"),
  };

  function updateClock(now = new Date()) {
    els.liveClock.textContent = formatClock(now);
    els.liveClock.dateTime = now.toISOString();
  }

  function setSyncStatus(status, detail = "") {
    if (!els.syncStatus) {
      return;
    }

    els.syncStatus.className = `sync-status sync-status--${status}`;
    const labels = {
      loading: "Loading…",
      synced: "Shared",
      saving: "Saving…",
      local: "Local only",
      error: "Sync issue",
    };

    els.syncStatus.textContent = labels[status] || "Sync";
    els.syncStatus.title = detail || labels[status] || "Shared sync status";
  }

  function renderStatus(state) {
    const { done, total, percent, remaining } = getOverallProgress(state);
    const complete = done === total;

    if (els.progressBarFill) {
      els.progressBarFill.style.width = `${percent}%`;
      els.progressBarFill.classList.toggle("progress-bar__fill--complete", complete);
    }

    if (els.statusStrip) {
      els.statusStrip.textContent = complete
        ? `All done — ${total} items complete`
        : `${done} of ${total} complete · ${remaining} left`;
    }

    if (els.checklistTabBadge) {
      if (complete) {
        els.checklistTabBadge.hidden = true;
      } else {
        els.checklistTabBadge.hidden = false;
        els.checklistTabBadge.textContent = String(remaining);
      }
    }

    if (els.notesTabBadge) {
      els.notesTabBadge.hidden = !hasServiceNotes(state.serviceNotes);
    }
  }

  function renderChecklist(state) {
    els.checklist.innerHTML = state.groups
      .map((group) => {
        const { done, total } = getGroupProgress(group);
        const complete = done === total;
        const percent = total ? Math.round((done / total) * 100) : 100;
        const accent = GROUP_ACCENTS[group.id] || "default";

        const itemsHtml = group.items
          .filter((item) => isChecklistItemVisible(item, group))
          .map((item) => {
            const checked = item.checked ? "checked" : "";
            const checkedClass = item.checked ? "checklist-item--checked" : "checklist-item--unchecked";
            const nestedClass = item.parentItemId ? "checklist-item--nested" : "";
            const changeToggle = isChangeTrackedItem(item.id)
              ? `
                <label class="checklist-item__change" title="${getChangeTrackMessage(item.id)}">
                  <input
                    type="checkbox"
                    class="checklist-item__change-input"
                    data-change-toggle
                    data-group-id="${group.id}"
                    data-item-id="${item.id}"
                    ${item.changeOccurred ? "checked" : ""}
                  />
                  <span class="checklist-item__change-label">${getChangeTrackMessage(item.id)}</span>
                </label>
              `
              : "";

            return `
              <div class="checklist-item ${checkedClass} ${nestedClass}" data-group-id="${group.id}" data-item-id="${item.id}">
                <label class="checklist-item__main">
                  <input type="checkbox" ${checked} data-group-id="${group.id}" data-item-id="${item.id}" />
                  <span>${item.label}</span>
                </label>
                ${changeToggle}
              </div>
            `;
          })
          .join("");

        return `
          <section class="checklist-group checklist-group--${group.id} checklist-group--${accent} ${complete ? "checklist-group--complete" : ""}" data-group-id="${group.id}">
            <div class="checklist-group__header">
              <div class="checklist-group__heading">
                <h2 class="checklist-group__title">${group.title}</h2>
                <div class="checklist-group__progress-bar" aria-hidden="true">
                  <div class="checklist-group__progress-fill" style="width: ${percent}%"></div>
                </div>
              </div>
              <span class="checklist-group__progress">${done} / ${total}</span>
            </div>
            <div class="checklist-group__items">${itemsHtml}</div>
          </section>
        `;
      })
      .join("");
  }

  function renderTestimonyTimers(state) {
    const { testimonyTimers } = state;
    const totalSeconds = sumMainTestimonySeconds(testimonyTimers.main);
    const message = buildBackstageMessage(testimonyTimers);

    const mainRows = testimonyTimers.main
      .map(
        (testimony, index) => `
          <div class="testimony-timers__row">
            <span class="testimony-timers__index">${index + 1}</span>
            <input
              type="text"
              class="testimony-timers__name"
              data-kind="main"
              data-id="${testimony.id}"
              data-field="name"
              placeholder="e.g. Sister Akansha"
              value="${escapeHtml(testimony.name)}"
            />
            <input
              type="text"
              class="testimony-timers__duration"
              data-kind="main"
              data-id="${testimony.id}"
              data-field="duration"
              placeholder="mm:ss"
              inputmode="numeric"
              pattern="[0-9]{1,2}:[0-9]{2}"
              value="${escapeHtml(testimony.duration)}"
            />
          </div>
        `,
      )
      .join("");

    const backupRows = testimonyTimers.backup
      .map(
        (testimony) => `
          <div class="testimony-timers__row testimony-timers__row--backup">
            <span class="testimony-timers__index">backup</span>
            <input
              type="text"
              class="testimony-timers__name"
              data-kind="backup"
              data-id="${testimony.id}"
              data-field="name"
              placeholder="e.g. Brother Ankit"
              value="${escapeHtml(testimony.name)}"
            />
          </div>
        `,
      )
      .join("");

    els.testimonyTimers.innerHTML = `
      <div class="testimony-timers__header">
        <div>
          <h2 class="testimony-timers__title">Testimony timers</h2>
          <p class="testimony-timers__subtitle">Set durations for main testimonies, then copy the backstage message.</p>
        </div>
        <div class="testimony-timers__total" aria-live="polite">
          <span class="testimony-timers__total-label">Total</span>
          <strong id="testimony-total-value">${formatDurationSeconds(totalSeconds)}</strong>
        </div>
      </div>

      <div class="testimony-timers__grid">
        <div class="testimony-timers__panel">
          <h3 class="testimony-timers__panel-title">Main testimonies</h3>
          <div class="testimony-timers__table-head">
            <span></span>
            <span>Name</span>
            <span>Duration</span>
          </div>
          <div class="testimony-timers__rows">${mainRows}</div>
        </div>

        <div class="testimony-timers__panel">
          <h3 class="testimony-timers__panel-title">Backup testimonies</h3>
          <p class="testimony-timers__hint">Names only — not included in the total.</p>
          <div class="testimony-timers__rows">${backupRows}</div>

          <label class="testimony-timers__intro">
            <span class="testimony-timers__intro-label">Intro timer</span>
            <input
              type="text"
              id="intro-timer-input"
              data-kind="intro"
              data-field="introTimer"
              placeholder="mm:ss"
              inputmode="numeric"
              pattern="[0-9]{1,2}:[0-9]{2}"
              value="${escapeHtml(testimonyTimers.introTimer)}"
            />
          </label>
        </div>

        <div class="testimony-timers__panel testimony-timers__panel--message">
          <div class="testimony-timers__message-header">
            <h3 class="testimony-timers__panel-title">Backstage message</h3>
            <button type="button" class="btn btn--primary" id="copy-backstage-message-btn">Copy message</button>
          </div>
          <textarea
            id="backstage-message-preview"
            class="testimony-timers__preview"
            readonly
            rows="12"
          >${escapeHtml(message)}</textarea>
          <p class="testimony-timers__copy-status hidden" id="copy-status" role="status"></p>
        </div>
      </div>
    `;
  }

  function updateTestimonyPreview(state) {
    const totalEl = els.testimonyTimers.querySelector("#testimony-total-value");
    const previewEl = els.testimonyTimers.querySelector("#backstage-message-preview");

    if (!totalEl || !previewEl) {
      renderTestimonyTimers(state);
      return;
    }

    totalEl.textContent = formatDurationSeconds(
      sumMainTestimonySeconds(state.testimonyTimers.main),
    );
    previewEl.value = buildBackstageMessage(state.testimonyTimers);
  }

  function renderServiceNotes(state) {
    const { serviceNotes } = state;
    const active = document.activeElement;

    if (els.serviceRemarksInput && active !== els.serviceRemarksInput) {
      els.serviceRemarksInput.value = serviceNotes.remarks;
    }

    if (els.serviceObservationsInput && active !== els.serviceObservationsInput) {
      els.serviceObservationsInput.value = serviceNotes.observations;
    }

    if (els.serviceChallengesInput && active !== els.serviceChallengesInput) {
      els.serviceChallengesInput.value = serviceNotes.challenges;
    }
  }

  function renderAll(state, now = new Date()) {
    updateClock(now);
    renderTestimonyTimers(state);
    renderChecklist(state);
    renderServiceNotes(state);
    renderStatus(state);
  }

  return {
    els,
    updateClock,
    setSyncStatus,
    renderStatus,
    renderChecklist,
    renderTestimonyTimers,
    updateTestimonyPreview,
    renderServiceNotes,
    renderAll,
  };
}
