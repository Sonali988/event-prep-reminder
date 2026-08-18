const API_URL = "/api/state";
const CLIENT_ID = crypto.randomUUID();
const SAVE_DEBOUNCE_MS = 800;
const POLL_INTERVAL_MS = 12000;

let saveTimer = null;
let lastPushedAt = null;
let syncAvailable = false;
let onSyncStatusChange = null;
let onRemoteState = null;

function getWriteHeaders() {
  const headers = {
    "Content-Type": "application/json",
    "X-Client-Id": CLIENT_ID,
  };

  const writeKey = import.meta.env.VITE_SYNC_WRITE_KEY;
  if (writeKey) {
    headers.Authorization = `Bearer ${writeKey}`;
  }

  return headers;
}

export function getClientId() {
  return CLIENT_ID;
}

export function isSyncAvailable() {
  return syncAvailable;
}

export function setSyncCallbacks(callbacks) {
  onSyncStatusChange = callbacks.onStatusChange ?? null;
  onRemoteState = callbacks.onRemoteState ?? null;
}

function setStatus(status, detail = "") {
  onSyncStatusChange?.(status, detail);
}

export async function probeSync() {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (response.status === 503) {
      syncAvailable = false;
      setStatus("local", "Shared storage not configured");
      return false;
    }

    syncAvailable = response.ok;
    setStatus(syncAvailable ? "synced" : "local");
    return syncAvailable;
  } catch {
    syncAvailable = false;
    setStatus("local", "Working offline on this device");
    return false;
  }
}

export async function fetchRemoteState() {
  const response = await fetch(API_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Remote state request failed (${response.status})`);
  }

  const data = await response.json();
  return data ?? null;
}

export async function pushRemoteState(state) {
  if (!syncAvailable) {
    return false;
  }

  setStatus("saving");

  try {
    const response = await fetch(API_URL, {
      method: "PUT",
      headers: getWriteHeaders(),
      body: JSON.stringify(state),
    });

    if (!response.ok) {
      const detail = response.status === 401 ? "Invalid sync key" : "Save failed";
      setStatus("error", detail);
      return false;
    }

    const result = await response.json();
    lastPushedAt = result.updatedAt || state.updatedAt || new Date().toISOString();
    setStatus("synced");
    return true;
  } catch {
    setStatus("error", "Could not reach server");
    return false;
  }
}

export function scheduleRemoteSave(state) {
  if (!syncAvailable) {
    return;
  }

  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    pushRemoteState(state);
  }, SAVE_DEBOUNCE_MS);
}

export function startSyncPolling(getLocalState, isUserEditing) {
  if (!syncAvailable) {
    return null;
  }

  return setInterval(async () => {
    if (isUserEditing()) {
      return;
    }

    try {
      const remote = await fetchRemoteState();
      if (!remote?.updatedAt) {
        return;
      }

      const local = getLocalState();
      const localUpdatedAt = local.updatedAt || lastPushedAt || "";
      if (remote.updatedAt <= localUpdatedAt) {
        return;
      }

      onRemoteState?.(remote);
      setStatus("synced", "Updated from team");
    } catch {
      setStatus("error", "Sync paused");
    }
  }, POLL_INTERVAL_MS);
}

export async function pullRemoteStateNow(getLocalState, isUserEditing) {
  if (!syncAvailable || isUserEditing()) {
    return null;
  }

  try {
    const remote = await fetchRemoteState();
    if (!remote?.updatedAt) {
      return null;
    }

    const local = getLocalState();
    const localUpdatedAt = local.updatedAt || lastPushedAt || "";
    if (remote.updatedAt <= localUpdatedAt) {
      setStatus("synced");
      return null;
    }

    onRemoteState?.(remote);
    setStatus("synced", "Updated from team");
    return remote;
  } catch {
    setStatus("error", "Could not refresh");
    return null;
  }
}

export function markPushed(updatedAt) {
  lastPushedAt = updatedAt;
}
