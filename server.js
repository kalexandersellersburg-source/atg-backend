// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// --- Schedules Direct Login Info ---
const SD_BASE = "https://json.schedulesdirect.org/20141201";
const SD_USERNAME = "statmanbp";
const SD_PASSWORD_HASH = "d6e863b000e51e6fd94aa4367e84e50b39f647b2";

// Cache token for 24 hours
let sdToken = null;
let tokenTimestamp = 0;

// ---- LOGIN FUNCTION ----
async function loginToSD() {
  const now = Date.now();

  // If token is <24 hours old, reuse it
  if (sdToken && now - tokenTimestamp < 24 * 60 * 60 * 1000) {
    return sdToken;
  }

  console.log("Logging in to Schedules Direct…");

  const response = await fetch(`${SD_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: SD_USERNAME,
      password: SD_PASSWORD_HASH,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.token) {
    console.error("SD Login Failed:", data);
    throw new Error("Schedules Direct login failed.");
  }

  sdToken = data.token;
  tokenTimestamp = now;

  console.log("SD login successful!");
  return sdToken;
}

// ---- Schedules Endpoint ----
// POST /schedules
// BODY: { stationIDs: ["10179"], dates: ["2025-12-05", "2025-12-06"] }
app.post("/schedules", async (req, res) => {
  try {
    const { stationIDs, dates } = req.body;

    if (!stationIDs || !dates) {
      return res.status(400).json({ error: "stationIDs and dates required" });
    }

    const token = await loginToSD();

    const payload = stationIDs.flatMap((sid) =>
      dates.map((d) => ({
        stationID: sid.toString(),
        date: d,
      }))
    );

    const response = await fetch(`${SD_BASE}/schedules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("ERROR /schedules:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Programs Endpoint ----
// POST /programs
// BODY: { programIDs: ["EP00012345", "SH00098765"] }
app.post("/programs", async (req, res) => {
  try {
    const { programIDs } = req.body;

    if (!programIDs) {
      return res.status(400).json({ error: "programIDs required" });
    }

    const token = await loginToSD();

    const response = await fetch(`${SD_BASE}/programs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify(programIDs),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("ERROR /programs:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- START SERVER (for local testing) ----
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`ATG Backend running on port ${PORT}`);
});
