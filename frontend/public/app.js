// Tier 1: browser code. Uses relative URLs (/api/...) so it works the same
// through ramiza.site -> CloudFront -> ALB -> Nginx, and locally on localhost.

const notesEl = document.getElementById("notes");
const emptyEl = document.getElementById("empty");
const form = document.getElementById("note-form");
const formError = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");
const statusText = document.getElementById("status-text");

function setState(id, state) {
  document.getElementById(id).dataset.state = state;
}

async function checkHealth() {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));

    setState("tier-backend", "ok");
    setState("link-api", "ok");

    if (res.ok && data.database === "ok") {
      setState("tier-database", "ok");
      setState("link-db", "ok");
      statusText.textContent = "All three tiers are connected.";
    } else {
      setState("tier-database", "bad");
      setState("link-db", "bad");
      statusText.textContent = "The backend is up, but it can't reach MySQL. Check: docker compose logs db";
    }
  } catch {
    setState("tier-backend", "bad");
    setState("link-api", "bad");
    setState("tier-database", "checking");
    statusText.textContent = "The backend isn't responding. Check: docker compose logs backend";
  }
}

function formatTime(value) {
  const date = new Date(value);
  return isNaN(date) ? "" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function renderNote(note, isNew = false) {
  const li = document.createElement("li");
  if (isNew) li.className = "is-new";

  const head = document.createElement("div");
  head.className = "note-head";

  const name = document.createElement("span");
  name.className = "note-name";
  name.textContent = note.name; // textContent prevents HTML injection

  const time = document.createElement("time");
  time.className = "note-time";
  time.dateTime = note.created_at;
  time.textContent = formatTime(note.created_at);

  const body = document.createElement("p");
  body.className = "note-body";
  body.textContent = note.message;

  head.append(name, time);
  li.append(head, body);
  return li;
}

async function loadNotes() {
  try {
    const res = await fetch("/api/messages", { cache: "no-store" });
    if (!res.ok) throw new Error();
    const notes = await res.json();
    notesEl.replaceChildren(...notes.map((n) => renderNote(n)));
    emptyEl.hidden = notes.length > 0;
  } catch {
    emptyEl.hidden = false;
    emptyEl.textContent = "Notes can't be loaded until the backend and database are connected.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";

  const name = form.name.value.trim();
  const message = form.message.value.trim();

  if (!name || !message) {
    formError.textContent = "Enter your name and a message first.";
    (name ? form.message : form.name).focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Signing…";

  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);

    notesEl.prepend(renderNote(data, true));
    emptyEl.hidden = true;
    form.message.value = "";
  } catch (err) {
    formError.textContent = err.message || "Your note wasn't saved. Try again.";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign the guestbook";
  }
});

[form.name, form.message].forEach((field) =>
  field.addEventListener("input", () => (formError.textContent = ""))
);

checkHealth();
loadNotes();
