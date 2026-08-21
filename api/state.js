const STATE_KEY = "event-prep:shared-state";

function getKvConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return null;
  }
  return { url, token };
}

async function kvGet(key) {
  const config = getKvConfig();
  if (!config) {
    return null;
  }

  const response = await fetch(`${config.url}/get/${encodeURIComponent(key)}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`KV get failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.result) {
    return null;
  }

  return typeof data.result === "string" ? JSON.parse(data.result) : data.result;
}

async function kvSet(key, value) {
  const config = getKvConfig();
  if (!config) {
    throw new Error("KV not configured");
  }

  const response = await fetch(`${config.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });

  if (!response.ok) {
    throw new Error(`KV set failed (${response.status})`);
  }
}

function isAuthorized(req) {
  const writeKey = process.env.SYNC_WRITE_KEY;
  if (!writeKey) {
    return true;
  }

  const auth = req.headers.authorization || "";
  return auth === `Bearer ${writeKey}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!getKvConfig()) {
    return res.status(503).json({
      error: "Shared storage is not configured. Add a Redis (Upstash) store to this Vercel project.",
    });
  }

  if (req.method === "GET") {
    try {
      const state = await kvGet(STATE_KEY);
      return res.status(200).json(state ?? null);
    } catch (error) {
      console.error("KV read failed:", error);
      return res.status(500).json({ error: "Failed to read shared state." });
    }
  }

  if (req.method === "PUT") {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ error: "Invalid state payload." });
    }

    const nextState = {
      ...body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.headers["x-client-id"] || "unknown",
    };

    try {
      await kvSet(STATE_KEY, nextState);
      return res.status(200).json({
        ok: true,
        updatedAt: nextState.updatedAt,
      });
    } catch (error) {
      console.error("KV write failed:", error);
      return res.status(500).json({ error: "Failed to save shared state." });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
