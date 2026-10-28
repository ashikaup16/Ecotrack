import { randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";

const scrypt = promisify(scryptCallback);
const app = express();
const port = Number(process.env.PORT) || 3001;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const calculatorPath = path.join(projectRoot, "calculator", "footprint.py");
const frontendPath = path.join(projectRoot, "dist");
const pythonExecutable = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const sessionDurationSeconds = 60 * 60 * 24 * 30;
const databasePath = path.resolve(process.env.ECOTRACK_DB_PATH || path.join(projectRoot, "data", "ecotrack.sqlite"));

mkdirSync(path.dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    inputs_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS footprint_checkins (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_key TEXT NOT NULL,
    total_kg INTEGER NOT NULL,
    categories_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, month_key)
  );
  CREATE TABLE IF NOT EXISTS user_journeys (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    goal_percent INTEGER NOT NULL DEFAULT 10,
    completed_actions_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(express.json({ limit: "10kb" }));

const actionIds = new Set([
  "swap-short-trip",
  "plant-forward-meal",
  "switch-off-standby",
  "avoid-food-waste",
  "repair-or-reuse",
]);
const goalOptions = new Set([5, 10, 15, 20, 25]);

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `ecotrack_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionDurationSeconds}${secure}`,
  );
}

function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", "ecotrack_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function getCookie(request, name) {
  const entry = request.headers.cookie?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}

function requireUser(request, response, next) {
  const token = getCookie(request, "ecotrack_session");
  if (!token) {
    response.status(401).json({ error: "Please sign in to use your EcoTrack account." });
    return;
  }

  const session = database.prepare(`
    SELECT users.id, users.name, users.email
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(hashToken(token), Date.now());

  if (!session) {
    database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    clearSessionCookie(response);
    response.status(401).json({ error: "Your session has expired. Please sign in again." });
    return;
  }

  request.user = session;
  next();
}

function profileFor(userId) {
  const profile = database.prepare("SELECT inputs_json, result_json FROM profiles WHERE user_id = ?").get(userId);
  if (!profile) return null;
  return {
    inputs: JSON.parse(profile.inputs_json),
    result: JSON.parse(profile.result_json),
  };
}

function journeyFor(userId) {
  const history = database.prepare(`
    SELECT month_key AS month, total_kg AS totalKg
    FROM footprint_checkins
    WHERE user_id = ?
    ORDER BY month_key ASC
  `).all(userId);
  const journey = database.prepare(
    "SELECT goal_percent, completed_actions_json FROM user_journeys WHERE user_id = ?",
  ).get(userId);

  return {
    history,
    goalPercent: journey?.goal_percent ?? 10,
    completedActions: journey ? JSON.parse(journey.completed_actions_json) : [],
  };
}

function saveCheckin(userId, result) {
  const month = new Date().toISOString().slice(0, 7);
  database.prepare(`
    INSERT INTO footprint_checkins (user_id, month_key, total_kg, categories_json, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, month_key) DO UPDATE SET
      total_kg = excluded.total_kg,
      categories_json = excluded.categories_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, month, result.totalKg, JSON.stringify(result.categories));
}

function createSession(userId, response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + sessionDurationSeconds * 1000;
  database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(hashToken(token), userId, expiresAt);
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  setSessionCookie(response, token);
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.post("/api/auth/signup", async (request, response) => {
  const name = typeof request.body.name === "string" ? request.body.name.trim() : "";
  const email = typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";

  if (name.length < 2 || name.length > 60) {
    response.status(400).json({ error: "Enter a name between 2 and 60 characters." });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    response.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (password.length < 10 || password.length > 128) {
    response.status(400).json({ error: "Use a password between 10 and 128 characters." });
    return;
  }

  const salt = randomBytes(16);
  const passwordHash = await scrypt(password, salt, 64);
  try {
    const insertion = database.prepare(
      "INSERT INTO users (name, email, password_salt, password_hash) VALUES (?, ?, ?, ?)",
    ).run(name, email, salt.toString("hex"), passwordHash.toString("hex"));
    const user = { id: Number(insertion.lastInsertRowid), name, email };
    createSession(user.id, response);
    response.status(201).json({
      user: { name: user.name, email: user.email },
      profile: null,
      journey: journeyFor(user.id),
    });
  } catch (error) {
    if (error.errcode === 2067 || error.message.includes("UNIQUE constraint failed: users.email")) {
      response.status(409).json({ error: "An account with that email already exists. Sign in instead." });
      return;
    }
    throw error;
  }
});

app.post("/api/auth/login", async (request, response) => {
  const email = typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const user = database.prepare(
    "SELECT id, name, email, password_salt, password_hash FROM users WHERE email = ?",
  ).get(email);

  if (!user || password.length > 128) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  const candidate = await scrypt(password, Buffer.from(user.password_salt, "hex"), 64);
  const storedHash = Buffer.from(user.password_hash, "hex");
  if (candidate.length !== storedHash.length || !timingSafeEqual(candidate, storedHash)) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  createSession(user.id, response);
  response.json({
    user: { name: user.name, email: user.email },
    profile: profileFor(user.id),
    journey: journeyFor(user.id),
  });
});

app.post("/api/auth/logout", (request, response) => {
  const token = getCookie(request, "ecotrack_session");
  if (token) database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  clearSessionCookie(response);
  response.status(204).end();
});

app.get("/api/auth/me", (request, response) => {
  const token = getCookie(request, "ecotrack_session");
  if (!token) {
    response.json({ user: null, profile: null });
    return;
  }

  const user = database.prepare(`
    SELECT users.id, users.name, users.email
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(hashToken(token), Date.now());
  if (!user) {
    database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    clearSessionCookie(response);
    response.json({ user: null, profile: null });
    return;
  }

  response.json({
    user: { name: user.name, email: user.email },
    profile: profileFor(user.id),
    journey: journeyFor(user.id),
  });
});

app.get("/api/journey", requireUser, (request, response) => {
  response.json(journeyFor(request.user.id));
});

app.put("/api/journey", requireUser, (request, response) => {
  const { goalPercent, completedActions } = request.body;
  if (!goalOptions.has(goalPercent)) {
    response.status(400).json({ error: "Choose a reduction goal between 5% and 25%." });
    return;
  }
  if (!Array.isArray(completedActions)
    || completedActions.length > actionIds.size
    || completedActions.some((id) => typeof id !== "string" || !actionIds.has(id))
    || new Set(completedActions).size !== completedActions.length) {
    response.status(400).json({ error: "The action checklist contains an invalid selection." });
    return;
  }

  database.prepare(`
    INSERT INTO user_journeys (user_id, goal_percent, completed_actions_json, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      goal_percent = excluded.goal_percent,
      completed_actions_json = excluded.completed_actions_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(request.user.id, goalPercent, JSON.stringify(completedActions));
  response.json(journeyFor(request.user.id));
});

app.post("/api/calculate", requireUser, (request, response) => {
  const child = spawn(pythonExecutable, [calculatorPath], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  let output = "";
  let errors = "";
  let responseSent = false;
  let timedOut = false;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    output += chunk;
    if (output.length > 64 * 1024) child.kill();
  });
  child.stderr.on("data", (chunk) => {
    errors += chunk;
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, 15_000);
  child.on("error", (error) => {
    clearTimeout(timeout);
    if (response.headersSent) return;
    responseSent = true;
    console.error("Could not start the Python footprint calculator:", error);
    response.status(503).json({
      error: `Python could not be started (${pythonExecutable}). Install Python 3 or set the PYTHON environment variable, then restart EcoTrack.`,
    });
  });

  child.on("close", (code) => {
    clearTimeout(timeout);
    if (responseSent || response.headersSent) return;
    if (timedOut) {
      response.status(504).json({ error: "The calculator took too long to respond. Please try again." });
      return;
    }
    if (code !== 0) {
      console.error("Footprint calculator failed:", errors || `exit code ${code}`);
      response.status(400).json({
        error: errors.trim() || "Could not calculate your footprint. Check the values and try again.",
      });
      return;
    }

    let result;
    try {
      result = JSON.parse(output);
    } catch (error) {
      console.error("Footprint calculator returned invalid JSON:", error);
      response.status(500).json({ error: "The calculator returned an invalid response. Please try again." });
      return;
    }

    try {
      database.prepare(`
        INSERT INTO profiles (user_id, inputs_json, result_json, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          inputs_json = excluded.inputs_json,
          result_json = excluded.result_json,
          updated_at = CURRENT_TIMESTAMP
      `).run(request.user.id, JSON.stringify(request.body), JSON.stringify(result));
      saveCheckin(request.user.id, result);
      response.json({ result, history: journeyFor(request.user.id).history });
    } catch (error) {
      console.error("Could not save the user's footprint:", error);
      response.status(500).json({ error: "Your estimate was calculated but could not be saved. Check the local database and try again." });
    }
  });

  child.stdin.end(JSON.stringify(request.body));
});

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "API route not found." });
});

if (existsSync(path.join(frontendPath, "index.html"))) {
  app.use(express.static(frontendPath));
  app.get("/{*path}", (_request, response) => {
    response.sendFile(path.join(frontendPath, "index.html"));
  });
}

app.use((error, _request, response, _next) => {
  console.error("EcoTrack API error:", error);
  if (response.headersSent) return;
  response.status(error.status === 413 ? 413 : 400).json({
    error: error.status === 413 ? "Request is too large." : "The request could not be processed.",
  });
});

app.listen(port, () => {
  console.log(`EcoTrack API listening on http://localhost:${port}`);
  console.log(`EcoTrack account data: ${databasePath}`);
});
