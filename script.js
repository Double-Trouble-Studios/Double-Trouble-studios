// Double Trouble Studios — site logic
const SUPA_URL = "https://xemwnccaqxnttrabdayh.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbXduY2NhcXhudHRyYWJkYXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NTczMTksImV4cCI6MjEwNjAzMzMxOX0.mawkXgP9IrL0_Yhj3OiW94v6LwthNrzJfFIwsUVRCIM";

const db = supabase.createClient(SUPA_URL, SUPA_KEY);
const SESSION_KEY = "dts_session"; // { email, session_token }

const CONTROLLER_ICON = `
  <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="8" width="62" height="24" rx="12" fill="url(#dt-grad)"/>
    <circle cx="18" cy="20" r="5" fill="#0b0818" opacity="0.55"/>
    <circle cx="46" cy="16" r="3" fill="#0b0818" opacity="0.55"/>
    <circle cx="52" cy="22" r="3" fill="#0b0818" opacity="0.55"/>
    <defs>
      <linearGradient id="dt-grad" x1="0" y1="0" x2="64" y2="40">
        <stop offset="0%" stop-color="#e5001c"/>
        <stop offset="100%" stop-color="#8f0012"/>
      </linearGradient>
    </defs>
  </svg>
`;

// --- Games grid ---
function updateScrollHint() {
  const grid = document.getElementById("game-grid");
  const hint = document.querySelector(".scroll-hint");
  if (!grid || !hint) return;
  hint.classList.toggle("hidden", grid.scrollWidth <= grid.clientWidth + 1);
}

async function loadGames() {
  const grid = document.getElementById("game-grid");
  if (!grid) return;

  const { data, error } = await db.from("games").select("*").order("id");

  if (error || !data || data.length === 0) {
    grid.innerHTML = `
      <div class="grid-empty">
        ${CONTROLLER_ICON}
        <span>New games in development — join the crew below to hear about them first.</span>
      </div>
    `;
    updateScrollHint();
    return;
  }

  grid.innerHTML = data.map(g => `
    <article class="card">
      ${g.image_url
        ? `<img src="${g.image_url}" alt="${g.title}">`
        : `<div class="card-placeholder">${CONTROLLER_ICON}</div>`}
      <div class="card-body">
        <h3>${g.title}</h3>
        <p>${g.description || ""}</p>
      </div>
    </article>
  `).join("");

  updateScrollHint();
}

window.addEventListener("resize", updateScrollHint);

// --- Session helpers ---
function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* private mode etc — ignore, membership still works this visit */ }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

function showMember(email) {
  const nav = document.getElementById("nav-member");
  const navCta = document.getElementById("nav-cta");
  const guestPanel = document.getElementById("guest-panel");
  const memberPanel = document.getElementById("member-panel");

  if (nav) {
    nav.classList.remove("hidden");
    document.getElementById("nav-member-email").textContent = email;
  }
  if (navCta) navCta.classList.add("hidden");
  if (guestPanel) guestPanel.classList.add("hidden");
  if (memberPanel) {
    memberPanel.classList.remove("hidden");
    document.getElementById("member-email").textContent = email;
    document.getElementById("member-avatar").textContent = email.charAt(0).toUpperCase();
  }
}

function showGuest() {
  const nav = document.getElementById("nav-member");
  const navCta = document.getElementById("nav-cta");
  const guestPanel = document.getElementById("guest-panel");
  const memberPanel = document.getElementById("member-panel");

  if (nav) nav.classList.add("hidden");
  if (navCta) navCta.classList.remove("hidden");
  if (guestPanel) guestPanel.classList.remove("hidden");
  if (memberPanel) memberPanel.classList.add("hidden");
}

async function checkSession() {
  const session = readSession();
  if (!session || !session.session_token) {
    showGuest();
    return;
  }

  const { data, error } = await db.rpc("get_member", { session_token_input: session.session_token });

  if (error || !data || !data.ok) {
    clearSession();
    showGuest();
    return;
  }

  showMember(data.email);
}

function bindLogout(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener("click", () => {
    clearSession();
    showGuest();
  });
}
bindLogout("nav-logout");
bindLogout("member-logout");

// --- Join / log in form (same form does both) ---
const form = document.getElementById("sub-form");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("sub-email");
    const status = document.getElementById("sub-status");
    const btn = document.getElementById("sub-btn");
    const email = emailInput.value.trim().toLowerCase();

    status.className = "sub-status";
    if (!email || !email.includes("@") || !email.includes(".")) {
      status.textContent = "Please enter a valid email address.";
      status.classList.add("err");
      return;
    }

    btn.disabled = true;
    status.textContent = "Sending your link...";

    const { error } = await db.rpc("request_access", { email_input: email });

    btn.disabled = false;

    if (error) {
      status.textContent = "Something went wrong — please try again.";
      status.classList.add("err");
      console.error(error);
      return;
    }

    status.textContent = "Check your inbox! Click the link we just sent to join or sign in.";
    status.classList.add("ok");
    emailInput.value = "";
  });
}

loadGames();
checkSession();
