// Tier 2: Backend API for ramiza.site
// Listens on port 5000 inside Docker. Nginx (frontend tier) forwards /api/* here.

const express = require("express");
const mysql = require("mysql2/promise");

const PORT = Number(process.env.PORT) || 5000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
});

const app = express();
app.use(express.json({ limit: "10kb" }));

// Health check: proves backend -> database connectivity
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ backend: "ok", database: "ok" });
  } catch (err) {
    console.error("Health check failed:", err.message);
    res.status(503).json({ backend: "ok", database: "unreachable" });
  }
});

// List the latest messages
app.get("/api/messages", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, message, created_at FROM messages ORDER BY id DESC LIMIT 50"
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/messages failed:", err.message);
    res.status(500).json({ error: "Could not load messages." });
  }
});

// Add a message
app.post("/api/messages", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const message = String(req.body?.message ?? "").trim();

  if (!name || !message) {
    return res.status(400).json({ error: "Name and message are both required." });
  }
  if (name.length > 100 || message.length > 500) {
    return res.status(400).json({ error: "Name must be under 100 characters and message under 500." });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO messages (name, message) VALUES (?, ?)",
      [name, message]
    );
    const [rows] = await pool.query(
      "SELECT id, name, message, created_at FROM messages WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /api/messages failed:", err.message);
    res.status(500).json({ error: "Could not save the message." });
  }
});

// Unknown API routes
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Wait for MySQL before accepting traffic (it can take ~30s on first start)
async function waitForDatabase(retries = 30, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT 1");
      console.log("Connected to MySQL.");
      return;
    } catch (err) {
      console.log(`Waiting for MySQL (attempt ${attempt}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("MySQL did not become available in time.");
}

waitForDatabase()
  .then(() => {
    // 0.0.0.0 so Nginx in another container can reach it (not just localhost)
    app.listen(PORT, "0.0.0.0", () => console.log(`Backend listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1); // Docker restarts the container (restart: unless-stopped)
  });
