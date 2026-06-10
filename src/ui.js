import {
  getGroupProgress,
  getMsUntilEnd,
  getMsUntilNextReminder,
  getUncheckedItems,
  hasEndTimePassed,
  isAllChecked,
} from "./state.js";

function formatClock(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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
    resetBtn: root.querySelector("#reset-checklist-btn"),
    reminderModal: document.getElementById("reminder-modal"),
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
          <section class="checklist-group ${complete ? "checklist-group--complete" : ""}" data-group-id="${group.id}">
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

  function renderSettings(state) {
    els.endTimeInput.value = state.endTime;
    els.intervalRadios.forEach((radio) => {
      radio.checked = Number(radio.value) === state.reminderIntervalMinutes;
    });
  }

  function renderReminderModal(state) {
    const unchecked = getUncheckedItems(state);
    els.reminderList.innerHTML = unchecked
      .map(
        (item) =>
          `<li><strong>${item.groupTitle}</strong><span>${item.label}</span></li>`,
      )
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
    renderSettings(state);
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
