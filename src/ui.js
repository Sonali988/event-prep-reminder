import {
  getGroupProgress,
  getMsUntilEnd,
  getMsUntilNextReminder,
  getUncheckedGroups,
  hasEndTimePassed,
  isAllChecked,
  isChangeTrackedItem,
  isChecklistItemVisible,
  getChangeTrackMessage,
  parseEndTimeToday,
} from "./state.js";
import {
  buildBackstageMessage,
  formatDurationSeconds,
  sumMainTestimonySeconds,
} from "./testimonyTimers.js";
import {
  buildServiceNotesSummary,
} from "./serviceNotes.js";

function formatClock(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatServiceTime(endTime, now = new Date()) {
  return parseEndTimeToday(endTime, now).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
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
  };
}

function reminderTitleForCount(count) {
  if (count === 1) {
    return "1 item still needs your attention";
  }

  return `${count} items still pending`;
}

function reminderIntroForGroups(groups) {
  const sectionNames = groups.map((group) => group.title.toLowerCase()).join(", ");

  return `Work through these ${groups.length} sections — ${sectionNames} — then check them off below.`;
}

function formatSettingsPreview(state, now = new Date()) {
  const serviceTime = formatServiceTime(state.endTime, now);

  if (state.remindersEnabled === false) {
    return `Service starts ${serviceTime} · Reminders off`;
  }

  return `Service starts ${serviceTime} · Reminders every ${state.reminderIntervalMinutes} min`;
}

function formatDuration(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes <= 0) {
    return "now";
  }
  if (totalMinutes === 1) {
    return "1 min";
  }
  return `${totalMinutes} min`;
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
    checklist: root.querySelector("#checklist"),
    endTimeInput: root.querySelector("#end-time-input"),
    intervalRadios: root.querySelectorAll('input[name="interval"]'),
    intervalFieldset: root.querySelector("#reminder-interval-fieldset"),
    remindersEnabledInput: root.querySelector("#reminders-enabled-input"),
    settingsPreview: root.querySelector("#settings-preview"),
    resetBtn: root.querySelector("#reset-checklist-btn"),
    testimonyTimers: root.querySelector("#testimony-timers"),
    serviceNotesPreview: root.querySelector("#service-notes-preview"),
    serviceRemarksInput: root.querySelector("#service-remarks-input"),
    serviceObservationsInput: root.querySelector("#service-observations-input"),
    serviceChallengesInput: root.querySelector("#service-challenges-input"),
    serviceNotesStatus: root.querySelector("#service-notes-status"),
    reminderModal: document.getElementById("reminder-modal"),
    reminderBadge: document.getElementById("reminder-badge"),
    reminderTime: document.getElementById("reminder-time"),
    reminderProgressBar: document.getElementById("reminder-progress-bar"),
    reminderTitle: document.getElementById("reminder-title"),
    reminderIntro: document.getElementById("reminder-intro"),
    reminderList: document.getElementById("reminder-list"),
    reminderDismissBtn: document.getElementById("reminder-dismiss-btn"),
    finalAlert: document.getElementById("final-alert"),
    finalAlertDismissBtn: document.getElementById("final-alert-dismiss-btn"),
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

  function renderStatus(state, now = new Date()) {
    const strip = els.statusStrip;
    strip.classList.remove(
      "status-strip--ok",
      "status-strip--warn",
      "status-strip--ended",
    );

    if (state.stopped || hasEndTimePassed(state.endTime, now)) {
      strip.textContent = "Event started — reminders stopped";
      strip.classList.add("status-strip--ended");
      return;
    }

    if (state.remindersEnabled === false) {
      const untilEnd = getMsUntilEnd(state.endTime, now);
      strip.textContent = `Reminders off · Service starts in ${formatDuration(untilEnd)}`;
      strip.classList.add("status-strip--ok");
      return;
    }

    if (isAllChecked(state)) {
      strip.textContent = "All clear — no more reminders";
      strip.classList.add("status-strip--ok");
      return;
    }

    const untilReminder = getMsUntilNextReminder(state, now);
    const untilEnd = getMsUntilEnd(state.endTime, now);
    strip.textContent = `Next reminder in ${formatDuration(untilReminder)} · Service starts in ${formatDuration(untilEnd)}`;
    strip.classList.add("status-strip--warn");
  }

  function renderChecklist(state) {
    els.checklist.innerHTML = state.groups
      .map((group) => {
        const { done, total } = getGroupProgress(group);
        const complete = done === total;

        const itemsHtml = group.items
          .filter((item) => isChecklistItemVisible(item, group))
          .map((item) => {
            const checked = item.checked ? "checked" : "";
            const uncheckedClass = item.checked ? "" : "checklist-item--unchecked";
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
              <div class="checklist-item ${uncheckedClass} ${nestedClass}" data-group-id="${group.id}" data-item-id="${item.id}">
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
          <section class="checklist-group checklist-group--${group.id} ${complete ? "checklist-group--complete" : ""}" data-group-id="${group.id}">
            <div class="checklist-group__header">
              <h2 class="checklist-group__title">${group.title}</h2>
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
          <p class="testimony-timers__subtitle">Add main testimony durations, then copy the backstage message.</p>
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

    if (els.serviceNotesPreview) {
      els.serviceNotesPreview.textContent = buildServiceNotesSummary(serviceNotes);
    }
  }

  function renderSettings(state, now = new Date()) {
    els.endTimeInput.value = state.endTime;
    els.remindersEnabledInput.checked = state.remindersEnabled !== false;
    els.intervalFieldset.disabled = state.remindersEnabled === false;
    els.intervalRadios.forEach((radio) => {
      radio.checked = Number(radio.value) === state.reminderIntervalMinutes;
    });
    els.settingsPreview.textContent = formatSettingsPreview(state, now);
  }

  function renderReminderModal(state, now = new Date()) {
    const groups = getUncheckedGroups(state);
    const pendingCount = groups.reduce((count, group) => count + group.items.length, 0);
    const overall = getOverallProgress(state);
    const untilEnd = formatDuration(getMsUntilEnd(state.endTime, now));
    const serviceTime = formatServiceTime(state.endTime, now);

    els.reminderBadge.textContent =
      pendingCount === 1 ? "1 item pending" : `${pendingCount} items pending`;
    els.reminderTime.textContent = `Service at ${serviceTime} · starts in ${untilEnd}`;
    els.reminderProgressBar.style.width = `${overall.percent}%`;
    els.reminderTitle.textContent = reminderTitleForCount(pendingCount);
    els.reminderIntro.textContent = reminderIntroForGroups(groups);

    els.reminderList.innerHTML = groups
      .map((group) => {
        const itemsHtml = group.items
          .map(
            (item) =>
              `<li class="modal__item" data-group-id="${group.id}" data-item-id="${item.id}">${item.label}</li>`,
          )
          .join("");

        return `
          <section class="modal__section modal__section--${group.id}">
            <div class="modal__section-header">
              <h3 class="modal__section-title">${group.title}</h3>
              <span class="modal__section-count">${group.done} / ${group.total}</span>
            </div>
            <ul class="modal__section-list">${itemsHtml}</ul>
          </section>
        `;
      })
      .join("");
  }

  function showReminderModal() {
    els.reminderModal.classList.remove("hidden");
  }

  function hideReminderModal() {
    els.reminderModal.classList.add("hidden");
  }

  function showFinalAlert() {
    els.finalAlert.classList.remove("hidden");
  }

  function hideFinalAlert() {
    els.finalAlert.classList.add("hidden");
  }

  function focusFirstUnchecked() {
    const first = els.checklist.querySelector(".checklist-item--unchecked input");
    first?.focus();
    first?.closest(".checklist-item")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderAll(state, now = new Date()) {
    updateClock(now);
    renderSettings(state, now);
    renderTestimonyTimers(state);
    renderChecklist(state);
    renderServiceNotes(state);
    renderStatus(state, now);
    renderReminderModal(state);
  }

  return {
    els,
    updateClock,
    setSyncStatus,
    renderStatus,
    renderChecklist,
    renderSettings,
    renderTestimonyTimers,
    updateTestimonyPreview,
    renderServiceNotes,
    renderReminderModal,
    showReminderModal,
    hideReminderModal,
    showFinalAlert,
    hideFinalAlert,
    focusFirstUnchecked,
    renderAll,
  };
}
