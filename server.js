// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// ======= BASIC ROUTES (REQUIRED BY FRONTEND) =======

// Root test route
app.get("/", (req, res) => {
  res.send("ATG Backend is running.");
});

// GET /test
app.get("/test", (req, res) => {
  res.json({ status: "ok", message: "ATG backend test route working!" });
});

// GET /channels → reads channels.json from assets folder
app.get("/channels", (req, res) => {
  const filePath = path.join(__dirname, "channels.json");

  try {
    const data = fs.readFileSync(filePath, "utf8");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("Error loading channels.json:", err);
    res.status(500).json({ error: "Could not read channels file." });
  }
});

// GET /favorites/:group
// Example: /favorites/ken OR /favorites/karen
app.get("/favorites/:group", (req, res) => {
  const group = req.params.group.toLowerCase();

  const favorites = {
    ken: [10179, 20231, 33455, 10945],
    karen: [10945, 10022, 33455],
  };

  if (!favorites[group]) {
    return res.status(404).json({ error: "Favorite group not found." });
  }

  res.json({ group, stations: favorites[group] });
});

// ======= SCHEDULES DIRECT CONFIG =======
const SD_BASE = "https://json.schedulesdirect.org/20141201";
const SD_USERNAME = "statmanbp";
const SD_PASSWORD_HASH = "d6e863b000e51e6fd94aa4367e84e50b39f647b2";

let sdToken = null;
let tokenTimestamp = 0;

// LOGIN FUNCTION
async function loginToSD() {
  const now = Date.now();

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

// ======= POST /schedules =======
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

// ======= POST /programs =======
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

// ======= UNIVERSAL ERROR HANDLER =======
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// ====== START SERVER ======
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`ATG Backend running on port ${PORT}`);
});
