import {
  getDefaultServiceNotes,
  mergeServiceNotes,
} from "./serviceNotes.js";

export const STORAGE_KEY = "event-prep-reminder-v1";

export const CHANGE_TRACKED_ITEM_IDS = new Set([
  "songs",
  "songs_sequence",
  "song_sequence",
  "download_announcements",
]);

export const CHANGE_TRACK_MESSAGES = {
  songs: "Change before service",
  songs_sequence: "Change before service",
  song_sequence: "Change before service",
  download_announcements: "Received during service",
};

export function isChangeTrackedItem(itemId) {
  return CHANGE_TRACKED_ITEM_IDS.has(itemId);
}

export function getChangeTrackMessage(itemId) {
  return CHANGE_TRACK_MESSAGES[itemId] || "";
}

function withChangeTrackingFields(item) {
  if (!isChangeTrackedItem(item.id)) {
    return item;
  }

  return {
    ...item,
    changeOccurred: false,
    changeAt: null,
  };
}

function mergeChecklistItem(defaultItem, savedItem) {
  if (!savedItem) {
    return withChangeTrackingFields(defaultItem);
  }

  const merged = {
    ...defaultItem,
    checked: Boolean(savedItem.checked),
    checkedAt:
      savedItem.checked && typeof savedItem.checkedAt === "string"
        ? savedItem.checkedAt
        : null,
  };

  if (isChangeTrackedItem(defaultItem.id)) {
    merged.changeOccurred = Boolean(savedItem.changeOccurred);
    merged.changeAt =
      merged.changeOccurred && typeof savedItem.changeAt === "string"
        ? savedItem.changeAt
        : null;
  }

  return merged;
}

export function getDefaultTestimonyTimers() {
  return {
    introTimer: "",
    main: [
      { id: "main-1", name: "", duration: "" },
      { id: "main-2", name: "", duration: "" },
      { id: "main-3", name: "", duration: "" },
      { id: "main-4", name: "", duration: "" },
    ],
    backup: [
      { id: "backup-1", name: "" },
      { id: "backup-2", name: "" },
    ],
  };
}

function mergeTestimonyTimers(savedTimers) {
  const defaults = getDefaultTestimonyTimers();

  if (!savedTimers) {
    return defaults;
  }

  return {
    introTimer: typeof savedTimers.introTimer === "string" ? savedTimers.introTimer : "",
    main: defaults.main.map((defaultItem) => {
      const savedItem = savedTimers.main?.find((item) => item.id === defaultItem.id);
      return savedItem
        ? {
            ...defaultItem,
            name: typeof savedItem.name === "string" ? savedItem.name : "",
            duration: typeof savedItem.duration === "string" ? savedItem.duration : "",
          }
        : defaultItem;
    }),
    backup: defaults.backup.map((defaultItem) => {
      const savedItem = savedTimers.backup?.find((item) => item.id === defaultItem.id);
      return savedItem
        ? {
            ...defaultItem,
            name: typeof savedItem.name === "string" ? savedItem.name : "",
          }
        : defaultItem;
    }),
  };
}

export function getDefaultGroups() {
  return [
    {
      id: "media",
      title: "Do you have all media ready?",
      items: [
        { id: "intro_video", label: "Intro video", checked: false },
        { id: "thumbnail", label: "Thumbnail", checked: false },
        { id: "offering_video", label: "Offering video", checked: false },
        { id: "testimonies", label: "Testimonies", checked: false },
        { id: "testimonies_sequence", label: "Testimonies sequence", checked: false },
        { id: "songs", label: "Songs", checked: false, changeOccurred: false, changeAt: null },
        {
          id: "songs_sequence",
          label: "Songs sequence",
          checked: false,
          changeOccurred: false,
          changeAt: null,
        },
        {
          id: "last_week_media",
          label: "Videos/photos from last week's event",
          checked: false,
        },
        {
          id: "poster_graphic",
          label: "Check Poster Graphic",
          checked: false,
          parentItemId: "last_week_media",
        },
        {
          id: "qr_code",
          label: "Check QR",
          checked: false,
          parentItemId: "last_week_media",
        },
        {
          id: "contact_number",
          label: "Check Contact Number",
          checked: false,
          parentItemId: "last_week_media",
        },
        {
          id: "address",
          label: "Check address",
          checked: false,
          parentItemId: "last_week_media",
        },
        {
          id: "phone_number",
          label: "Check Phone number",
          checked: false,
          parentItemId: "last_week_media",
        },
      ],
    },
    {
      id: "apps",
      title: "Apps to be open",
      items: [
        { id: "propresentor", label: "ProPresenter", checked: false },
        { id: "openlp", label: "OpenLP", checked: false },
        { id: "file_explorer", label: "File Explorer", checked: false },
        { id: "chrome", label: "Chrome", checked: false },
        { id: "whatsapp", label: "WhatsApp", checked: false },
        { id: "canva", label: "Canva", checked: false },
        { id: "notepad", label: "Notepad", checked: false },
        {
          id: "chatgpt",
          label: "ChatGPT — verses & lyrics search prompt ready",
          checked: false,
        },
        {
          id: "bible_verse_card",
          label: "Bible verse card app",
          checked: false,
        },
        { id: "charger_connected", label: "Charger connected", checked: false },
        { id: "audio_cable_connected", label: "Audio cable connected", checked: false },
        { id: "hdmi_cable_connected", label: "HDMI cable connected", checked: false },
      ],
    },
    {
      id: "prep_before_service",
      title: "Preparation before service",
      items: [
        {
          id: "song_sequence",
          label: "Check song sequence",
          checked: false,
          changeOccurred: false,
          changeAt: null,
        },
        {
          id: "songs_theme_hindi",
          label: "Check song theme (Hindi up, no black background)",
          checked: false,
        },
        {
          id: "testimonies_sequence",
          label: "Check testimonies sequence",
          checked: false,
        },
        {
          id: "convey_timers_backstage",
          label: "Convey testimonies timer & intro video timer to backstage",
          checked: false,
        },
        {
          id: "mute_apps_except_propresentor",
          label: "Mute all apps except ProPresenter",
          checked: false,
        },
        {
          id: "stop_video_loops",
          label: "Stop loop for intro, testimonies & announcement videos",
          checked: false,
        },
        {
          id: "sound_check_videos",
          label: "Sound check for all videos",
          checked: false,
        },
        {
          id: "service_order_live",
          label: "Check service order for live testimonies & announcements",
          checked: false,
        },
        {
          id: "openlp_theme_verses",
          label: "Check today's theme in OpenLP & Bible verses",
          checked: false,
        },
        {
          id: "offering_verses_ready",
          label: "Keep offering verses ready",
          checked: false,
        },
        { id: "download_verses", label: "Download verses", checked: false },
        {
          id: "download_announcements",
          label: "Download announcement posters/videos",
          checked: false,
          changeOccurred: false,
          changeAt: null,
        },
        {
          id: "adjust_propresentor_height",
          label: "Adjust height of ProPresenter",
          checked: false,
        },
        {
          id: "no_lyrics_on_screen",
          label: "No lyrics on screen",
          checked: false,
        },
        { id: "thumbnail_on", label: "Keep thumbnail ON", checked: false },
      ],
    },
  ];
}

export function getDefaultState() {
  return {
    endTime: "09:45",
    reminderIntervalMinutes: 15,
    remindersEnabled: true,
    lastReminderAt: null,
    stopped: false,
    finalAlertShown: false,
    groups: getDefaultGroups(),
    testimonyTimers: getDefaultTestimonyTimers(),
    serviceNotes: getDefaultServiceNotes(),
    updatedAt: null,
    updatedBy: null,
  };
}

export function normalizeSavedState(saved) {
  const defaults = getDefaultState();

  if (!saved || typeof saved !== "object") {
    return defaults;
  }

  return {
    ...defaults,
    ...saved,
    groups: mergeGroups(saved.groups, defaults.groups),
    reminderIntervalMinutes: [10, 15, 20].includes(saved.reminderIntervalMinutes)
      ? saved.reminderIntervalMinutes
      : 15,
    remindersEnabled: saved.remindersEnabled !== false,
    testimonyTimers: mergeTestimonyTimers(saved.testimonyTimers),
    serviceNotes: mergeServiceNotes(saved.serviceNotes),
    stopped: Boolean(saved.stopped),
    finalAlertShown: Boolean(saved.finalAlertShown),
    updatedAt: typeof saved.updatedAt === "string" ? saved.updatedAt : null,
    updatedBy: typeof saved.updatedBy === "string" ? saved.updatedBy : null,
  };
}

export function loadLocalState() {
  const defaults = getDefaultState();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    return normalizeSavedState(JSON.parse(raw));
  } catch {
    return defaults;
  }
}

export async function loadStateAsync(fetchRemote) {
  try {
    const remote = await fetchRemote();
    if (remote) {
      const normalized = normalizeSavedState(remote);
      saveStateLocal(normalized);
      return normalized;
    }
  } catch {
    // Fall back to local cache when shared storage is unavailable.
  }

  return loadLocalState();
}

export function stampState(state, clientId) {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    updatedBy: clientId,
  };
}

export function saveStateLocal(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState() {
  return loadLocalState();
}

export function saveState(state) {
  saveStateLocal(state);
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
        return mergeChecklistItem(defaultItem, savedItem);
      }),
    };
  });
}

export function isChecklistItemVisible(item, group) {
  if (!item.parentItemId) {
    return true;
  }

  const parent = group.items.find((groupItem) => groupItem.id === item.parentItemId);
  return Boolean(parent?.checked);
}

export function getVisibleGroupItems(group) {
  return group.items.filter((item) => isChecklistItemVisible(item, group));
}

export function getUncheckedItems(state) {
  const items = [];

  for (const group of state.groups) {
    for (const item of getVisibleGroupItems(group)) {
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

export function getUncheckedGroups(state) {
  return state.groups
    .map((group) => {
      const uncheckedItems = getVisibleGroupItems(group).filter((item) => !item.checked);
      return {
        id: group.id,
        title: group.title,
        items: uncheckedItems,
        ...getGroupProgress(group),
      };
    })
    .filter((group) => group.items.length > 0);
}

export function isAllChecked(state) {
  return getUncheckedItems(state).length === 0;
}

export function getGroupProgress(group) {
  const visibleItems = getVisibleGroupItems(group);
  const total = visibleItems.length;
  const done = visibleItems.filter((item) => item.checked).length;
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
  if (!state.remindersEnabled || state.stopped || isAllChecked(state)) {
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
    testimonyTimers: getDefaultTestimonyTimers(),
    lastReminderAt: null,
    stopped: false,
    finalAlertShown: false,
  };
}

export function setItemChecked(state, groupId, itemId, checked) {
  return {
    ...state,
    groups: state.groups.map((group) => {
      if (group.id !== groupId) {
        return group;
      }

      let items = group.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              checked,
              checkedAt: checked ? new Date().toISOString() : null,
            }
          : item,
      );

      if (!checked) {
        items = items.map((item) =>
          item.parentItemId === itemId
            ? { ...item, checked: false, checkedAt: null }
            : item,
        );
      }

      return { ...group, items };
    }),
  };
}

export function setItemChangeOccurred(state, groupId, itemId, changeOccurred) {
  if (!isChangeTrackedItem(itemId)) {
    return state;
  }

  return {
    ...state,
    groups: state.groups.map((group) =>
      group.id !== groupId
        ? group
        : {
          ...group,
          items: group.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  changeOccurred,
                  changeAt: changeOccurred ? new Date().toISOString() : null,
                }
              : item,
          ),
        },
    ),
  };
}

export function updateTestimonyTimers(state, testimonyTimers) {
  return {
    ...state,
    testimonyTimers,
  };
}

export function updateServiceNotes(state, serviceNotes) {
  return {
    ...state,
    serviceNotes,
  };
}
