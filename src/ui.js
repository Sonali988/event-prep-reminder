import {
  getGroupProgress,
  getMsUntilEnd,
  getMsUntilNextReminder,
  getUncheckedGroups,
  hasEndTimePassed,
  isAllChecked,
  parseEndTimeToday,
} from "./state.js";

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

export function createUi(root) {
  const els = {
    liveClock: root.querySelector("#live-clock"),
    statusStrip: root.querySelector("#status-strip"),
    checklist: root.querySelector("#checklist"),
    endTimeInput: root.querySelector("#end-time-input"),
    intervalRadios: root.querySelectorAll('input[name="interval"]'),
    intervalFieldset: root.querySelector("#reminder-interval-fieldset"),
    remindersEnabledInput: root.querySelector("#reminders-enabled-input"),
    settingsPreview: root.querySelector("#settings-preview"),
    resetBtn: root.querySelector("#reset-checklist-btn"),
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
          .map((item) => {
            const checked = item.checked ? "checked" : "";
            const uncheckedClass = item.checked ? "" : "checklist-item--unchecked";
            return `
              <label class="checklist-item ${uncheckedClass}" data-group-id="${group.id}" data-item-id="${item.id}">
                <input type="checkbox" ${checked} data-group-id="${group.id}" data-item-id="${item.id}" />
                <span>${item.label}</span>
              </label>
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
    renderChecklist(state);
    renderStatus(state, now);
    renderReminderModal(state);
  }

  return {
    els,
    updateClock,
    renderStatus,
    renderChecklist,
    renderSettings,
    renderReminderModal,
    showReminderModal,
    hideReminderModal,
    showFinalAlert,
    hideFinalAlert,
    focusFirstUnchecked,
    renderAll,
  };
}
