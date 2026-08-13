import {
  applyTestMode,
  hasEndTimePassed,
  isReminderDue,
  loadState,
  resetChecklist,
  saveState,
  setItemChecked,
} from "./state.js";
import { createUi } from "./ui.js";

const TEST_MODE = new URLSearchParams(window.location.search).get("test") === "1";

let state = loadState();
if (TEST_MODE) {
  state = applyTestMode(state);
  saveState(state);
}

const ui = createUi(document.getElementById("app"));
let tickTimer = null;
let clockTimer = null;

function persist(nextState) {
  state = nextState;
  saveState(state);
  ui.renderAll(state);
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
    state = { ...state, finalAlertShown: true };
    saveState(state);
    ui.showFinalAlert();
  }
  ui.hideReminderModal();
}

function handleEndTimeReached() {
  if (state.stopped) {
    return;
  }

  state = { ...state, stopped: true };
  saveState(state);
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
    state = { ...state, lastReminderAt: new Date().toISOString() };
    saveState(state);
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
  if (!window.confirm("Reset all checklist items? Settings will be kept.")) {
    return;
  }

  persist(resetChecklist(state));
  if (state.remindersEnabled && !state.stopped && isReminderDue(state)) {
    setTimeout(showReminderIfDue, 300);
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
  }
});

startTimers();
