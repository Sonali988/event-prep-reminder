import {
  getDefaultServiceNotes,
  mergeServiceNotes,
} from "./serviceNotes.js";

export const STORAGE_KEY = "event-prep-reminder-v1";

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
        { id: "songs", label: "Songs", checked: false },
        { id: "songs_sequence", label: "Songs sequence", checked: false },
        {
          id: "last_week_media",
          label: "Videos/photos from last week's event",
          checked: false,
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
      ],
    },
    {
      id: "prep_before_service",
      title: "Preparation before service",
      items: [
        { id: "song_sequence", label: "Check song sequence", checked: false },
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
          id: "songs_theme_hindi",
          label: "Check songs theme (Hindi up, no black background)",
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
      reminderIntervalMinutes: [10, 15, 20].includes(saved.reminderIntervalMinutes)
        ? saved.reminderIntervalMinutes
        : 15,
      remindersEnabled: saved.remindersEnabled !== false,
      testimonyTimers: mergeTestimonyTimers(saved.testimonyTimers),
      serviceNotes: mergeServiceNotes(saved.serviceNotes),
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

export function getUncheckedGroups(state) {
  return state.groups
    .map((group) => {
      const uncheckedItems = group.items.filter((item) => !item.checked);
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
