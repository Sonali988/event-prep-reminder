export const STORAGE_KEY = "event-prep-reminder-v1";

export function getDefaultGroups() {
  return [
    {
      id: "media",
      title: "Do you have all media ready?",
      items: [
        { id: "intro_video", label: "Current intro video", checked: false },
        { id: "thumbnail", label: "Thumbnail", checked: false },
        { id: "offering_video", label: "Offering video", checked: false },
        { id: "testimonies", label: "Testimonies", checked: false },
        { id: "songs", label: "Songs", checked: false },
        { id: "testimonies_sequence", label: "Testimonies sequence", checked: false },
        { id: "songs_sequence", label: "Songs sequence", checked: false },
      ],
    },
    {
      id: "backstage_timer",
      title: "Have you conveyed the intro video timer to backstage?",
      items: [
        { id: "timer_conveyed", label: "Yes, conveyed to backstage", checked: false },
      ],
    },
    {
      id: "video_loops",
      title: "Have you stopped the loops of all the videos?",
      items: [{ id: "loops_stopped", label: "Yes, all loops stopped", checked: false }],
    },
  ];
}

export function getDefaultState() {
  return {
    endTime: "09:45",
    reminderIntervalMinutes: 15,
    lastReminderAt: null,
    stopped: false,
    finalAlertShown: false,
    groups: getDefaultGroups(),
  };
}

function mergeGroups(savedGroups, defaultGroups) {
  return defaultGroups.map((defaultGroup) => {
    const savedGroup = savedGroups?.find((group) => group.id === defaultGroup.id);
    if (!savedGroup) {
      return defaultGroup;
    }

    return {
      ...defaultGroup,
      items: defaultGroup.items.map((defaultItem) => {
        const savedItem = savedGroup.items?.find((item) => item.id === defaultItem.id);
        return savedItem
          ? { ...defaultItem, checked: Boolean(savedItem.checked) }
          : defaultItem;
      }),
    };
  });
}

export function loadState() {
  const defaults = getDefaultState();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const saved = JSON.parse(raw);
    return {
      ...defaults,
      ...saved,
      groups: mergeGroups(saved.groups, defaults.groups),
      reminderIntervalMinutes: saved.reminderIntervalMinutes === 20 ? 20 : 15,
      stopped: Boolean(saved.stopped),
      finalAlertShown: Boolean(saved.finalAlertShown),
    };
  } catch {
    return defaults;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getUncheckedItems(state) {
  const items = [];

  for (const group of state.groups) {
    for (const item of group.items) {
      if (!item.checked) {
        items.push({
          groupId: group.id,
          groupTitle: group.title,
          itemId: item.id,
          label: item.label,
        });
      }
    }
  }

  return items;
}

export function isAllChecked(state) {
  return getUncheckedItems(state).length === 0;
}

export function getGroupProgress(group) {
  const total = group.items.length;
  const done = group.items.filter((item) => item.checked).length;
  return { done, total };
}

export function parseEndTimeToday(endTime, now = new Date()) {
  const [hours, minutes] = endTime.split(":").map(Number);
  const end = new Date(now);
  end.setHours(hours, minutes, 0, 0);
  return end;
}

export function hasEndTimePassed(endTime, now = new Date()) {
  return now >= parseEndTimeToday(endTime, now);
}

export function getMsUntilEnd(endTime, now = new Date()) {
  return parseEndTimeToday(endTime, now).getTime() - now.getTime();
}

export function getMsUntilNextReminder(state, now = new Date()) {
  if (!state.lastReminderAt) {
    return 0;
  }

  const intervalMs = state.reminderIntervalMinutes * 60 * 1000;
  const elapsed = now.getTime() - new Date(state.lastReminderAt).getTime();
  return Math.max(0, intervalMs - elapsed);
}

export function isReminderDue(state, now = new Date()) {
  if (state.stopped || isAllChecked(state)) {
    return false;
  }

  if (!state.lastReminderAt) {
    return true;
  }

  return getMsUntilNextReminder(state, now) === 0;
}

export function applyTestMode(state) {
  const now = new Date();
  const end = new Date(now.getTime() + 3 * 60 * 1000);
  const hours = String(end.getHours()).padStart(2, "0");
  const minutes = String(end.getMinutes()).padStart(2, "0");

  return {
    ...state,
    endTime: `${hours}:${minutes}`,
    reminderIntervalMinutes: 1,
    lastReminderAt: null,
    stopped: false,
    finalAlertShown: false,
  };
}

export function resetChecklist(state) {
  return {
    ...state,
    groups: getDefaultGroups(),
    lastReminderAt: null,
    stopped: false,
    finalAlertShown: false,
  };
}

export function setItemChecked(state, groupId, itemId, checked) {
  return {
    ...state,
    groups: state.groups.map((group) =>
      group.id !== groupId
        ? group
        : {
            ...group,
            items: group.items.map((item) =>
              item.id === itemId ? { ...item, checked } : item,
            ),
          },
    ),
  };
}
