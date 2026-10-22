// Double Trouble Studios — site logic
const SUPA_URL = "https://xemwnccaqxnttrabdayh.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbXduY2NhcXhudHRyYWJkYXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0NTczMTksImV4cCI6MjEwNjAzMzMxOX0.mawkXgP9IrL0_Yhj3OiW94v6LwthNrzJfFIwsUVRCIM";

const db = supabase.createClient(SUPA_URL, SUPA_KEY);
const SESSION_KEY = "dts_session"; // { email, session_token }

// tr("English", "Suomi") picks the text for the current language (set up in nav.js)
const tr = (en, fi) => (window.dtT ? window.dtT(en, fi) : en);
const locale = () => (tr("en", "fi") === "fi" ? "fi-FI" : "en-GB");

// Page state, kept so everything can re-render when the language or login changes
const state = {
  games: null,         // array, or null while loading / on error
  gamesFailed: false,
  memberCount: 0,
  isMember: false,
  memberEmail: "",
  memberPosts: null,   // array once loaded
  devlogFailed: false,
  teaser: [],
};

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const CONTROLLER_ICON = `
  <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="1" y="8" width="62" height="24" rx="12" fill="#e4002b"/>
    <circle cx="18" cy="20" r="5" fill="#0b0818" opacity="0.55"/>
    <circle cx="46" cy="16" r="3" fill="#0b0818" opacity="0.55"/>
    <circle cx="52" cy="22" r="3" fill="#0b0818" opacity="0.55"/>
  </svg>
`;

// --- Games grid ---
function updateScrollHint() {
  const grid = document.getElementById("game-grid");
  const hint = document.querySelector(".scroll-hint");
  if (!grid || !hint) return;
  hint.classList.toggle("hidden", grid.scrollWidth <= grid.clientWidth + 1);
}

function gameLinkLabel(url) {
  try {
    if (new URL(url).hostname.endsWith("itch.io")) return tr("Play on itch.io", "Pelaa itch.iossa");
  } catch { /* fall through */ }
  return tr("Play now", "Pelaa nyt");
}

function renderGames() {
  const grid = document.getElementById("game-grid");
  if (!grid) return;

  const stat = document.getElementById("stat-games");
  if (stat) stat.textContent = state.games ? String(state.games.length) : "–";

  if (state.games === null) {
    if (state.gamesFailed) {
      grid.innerHTML = `
        <div class="grid-empty">
          ${CONTROLLER_ICON}
          <span>${tr("New games in development. Join the crew below to hear about them first.",
                     "Uusia pelejä työn alla. Liity jengiin alla, niin kuulet niistä ensimmäisenä.")}</span>
        </div>`;
    }
    return;
  }

  const cards = state.games.map(g => {
    const title = escapeHtml(g.title);
    const img = g.image_url
      ? `<img src="${escapeHtml(g.image_url)}" alt="${title}" width="520" height="190" loading="lazy">`
      : `<div class="card-placeholder">${CONTROLLER_ICON}</div>`;
    const link = g.url && /^https?:\/\//i.test(g.url)
      ? `<a class="btn btn-ghost card-link" href="${escapeHtml(g.url)}" target="_blank" rel="noopener">${gameLinkLabel(g.url)}</a>`
      : "";
    return `
      <article class="card">
        ${img}
        <div class="card-body">
          <h3>${title}</h3>
          <p>${escapeHtml(g.description || "")}</p>
          ${link}
        </div>
      </article>`;
  });

  // A teaser tile so the grid never looks finished
  cards.push(`
    <article class="card card-next">
      <div class="card-placeholder next-mark">?</div>
      <div class="card-body">
        <h3>${tr("Next project", "Seuraava projekti")}</h3>
        <p>${tr("Classified. Join the crew to be first to know.", "Salainen. Liity jengiin, niin kuulet ensimmäisenä.")}</p>
        ${state.isMember ? "" : `<a class="btn btn-ghost card-link" href="#crew">${tr("Join the crew", "Liity jengiin")}</a>`}
      </div>
    </article>`);

  grid.innerHTML = cards.join("");
  updateScrollHint();
}

async function loadGames() {
  const { data, error } = await db.from("games").select("*").order("id");
  if (error || !data) {
    state.games = null;
    state.gamesFailed = true;
  } else {
    state.games = data;
    state.gamesFailed = false;
  }
  renderGames();
}

window.addEventListener("resize", updateScrollHint);

// --- Member count (social proof) ---
function renderMemberCount() {
  const el = document.getElementById("member-count");
  const n = state.memberCount;
  if (!el || n < 1) return;

  el.textContent = tr(
    `${n.toLocaleString("en-US")} ${n === 1 ? "troublemaker" : "troublemakers"} already causing chaos with us`,
    `${n.toLocaleString("fi-FI")} ${n === 1 ? "riiviö" : "riiviötä"} on jo mukana aiheuttamassa kaaosta`
  );
  el.classList.remove("hidden");

  const statWrap = document.getElementById("stat-members-wrap");
  const statNum = document.getElementById("stat-members");
  if (statWrap && statNum) {
    statNum.textContent = n.toLocaleString(locale());
    statWrap.classList.remove("hidden");
  }
}

async function loadMemberCount() {
  const { data, error } = await db.rpc("get_member_count");
  if (error || !data || typeof data.count !== "number") return;
  state.memberCount = data.count;
  renderMemberCount();
}

// --- Session helpers ---
function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

function setGuestOnly(visible) {
  document.querySelectorAll(".guest-only").forEach(el => el.classList.toggle("hidden", !visible));
}

function memberGreeting(email) {
  const hour = new Date().getHours();
  const raw = (email || "").split("@")[0].split("+")[0].replace(/[._-]+/g, " ").trim();
  const name = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "";
  const base = hour < 11
    ? tr("Good morning", "Hyvää huomenta")
    : hour < 18
      ? tr("Good afternoon", "Hyvää päivää")
      : tr("Good evening", "Hyvää iltaa");
  return name ? `${base}, ${name}` : base;
}

function renderMemberPanel() {
  const title = document.getElementById("member-title");
  if (title && state.isMember) title.textContent = memberGreeting(state.memberEmail);
}

function showMember(email) {
  const nav = document.getElementById("nav-member");
  const navCta = document.getElementById("nav-cta");
  const memberPanel = document.getElementById("member-panel");

  state.isMember = true;
  state.memberEmail = email;
  setGuestOnly(false);
  if (nav) {
    nav.classList.remove("hidden");
    document.getElementById("nav-member-email").textContent = email;
  }
  if (navCta) navCta.classList.add("hidden");
  if (memberPanel) {
    memberPanel.classList.remove("hidden");
    document.getElementById("member-email").textContent = email;
    document.getElementById("member-avatar").textContent = email.charAt(0).toUpperCase();
  }
  renderMemberPanel();
  renderGames();
  renderDevlog();
}

function showGuest() {
  const nav = document.getElementById("nav-member");
  const navCta = document.getElementById("nav-cta");
  const memberPanel = document.getElementById("member-panel");

  state.isMember = false;
  state.memberEmail = "";
  state.memberPosts = null;
  setGuestOnly(true);
  if (nav) nav.classList.add("hidden");
  if (navCta) navCta.classList.remove("hidden");
  if (memberPanel) memberPanel.classList.add("hidden");
  renderGames();
  renderDevlog();
  loadDevlogTeaser();
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
  loadDevlog(session.session_token);
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

// --- Join / log in forms (same flow for every form on the page) ---
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COOLDOWN_SECONDS = 30;
const LAST_REQUEST_KEY = "dts_last_request";

function setupSignup(root) {
  const form = root.querySelector(".sub-form");
  const input = form.querySelector('input[name="email"]');
  const honeypot = form.querySelector('input[name="website"]');
  const btn = form.querySelector('button[type="submit"]');
  const label = btn.querySelector(".btn-label");
  const status = root.querySelector(".sub-status");
  const note = root.querySelector(".sub-note");
  const success = root.querySelector(".sub-success");
  const echo = root.querySelector(".sub-email-echo");
  const resend = root.querySelector(".sub-resend");
  const change = root.querySelector(".sub-change");
  let currentEmail = "";
  let timer = null;

  function say(text, kind) {
    status.className = "sub-status" + (kind ? " " + kind : "");
    status.textContent = text;
  }

  const resendIn = (left) =>
    tr(`resend in <span class="count">${left}</span>s`, `lähetä uudelleen <span class="count">${left}</span> s`);

  function startCooldown() {
    clearInterval(timer);
    let left = COOLDOWN_SECONDS;
    resend.disabled = true;
    resend.innerHTML = resendIn(left);
    timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        resend.disabled = false;
        resend.textContent = tr("resend the link", "lähetä linkki uudelleen");
      } else {
        resend.innerHTML = resendIn(left);
      }
    }, 1000);
  }

  function showSuccess(email) {
    currentEmail = email;
    echo.textContent = email;
    form.classList.add("hidden");
    status.classList.add("hidden");
    if (note) note.classList.add("hidden");
    success.classList.remove("hidden");
    startCooldown();
  }

  function reset() {
    clearInterval(timer);
    success.classList.add("hidden");
    form.classList.remove("hidden");
    status.classList.remove("hidden");
    if (note) note.classList.remove("hidden");
    say("");
    input.value = "";
    input.focus();
  }

  async function request(email) {
    let last = 0;
    try { last = Number(sessionStorage.getItem(LAST_REQUEST_KEY)) || 0; } catch {}
    const wait = COOLDOWN_SECONDS * 1000 - (Date.now() - last);
    if (wait > 0) {
      return { error: { message: "cooldown", seconds: Math.ceil(wait / 1000) } };
    }
    const result = await db.rpc("request_access", { email_input: email });
    if (!result.error) {
      try { sessionStorage.setItem(LAST_REQUEST_KEY, String(Date.now())); } catch {}
    }
    return result;
  }

  input.addEventListener("input", () => {
    if (status.classList.contains("err")) say("");
    input.removeAttribute("aria-invalid");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = input.value.trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      say(tr("Enter a valid email address, like you@email.com.",
             "Syötä kelvollinen sähköpostiosoite, esimerkiksi sinä@posti.fi."), "err");
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }

    // Bots fill the hidden field. Pretend it worked and send nothing.
    if (honeypot && honeypot.value) {
      showSuccess(email);
      return;
    }

    const idleHtml = label.innerHTML;
    btn.disabled = true;
    btn.classList.add("loading");
    label.textContent = tr("Sending", "Lähetetään");
    say("");

    const { error } = await request(email);

    btn.disabled = false;
    btn.classList.remove("loading");
    label.innerHTML = idleHtml;

    if (error && error.message === "cooldown") {
      say(tr(`You just asked for a link. Check your inbox, or try again in ${error.seconds}s.`,
             `Pyysit juuri linkkiä. Tarkista postilaatikkosi tai yritä uudelleen ${error.seconds} s kuluttua.`), "err");
      return;
    }
    if (error) {
      say(tr("Something went wrong. Please try again in a moment.",
             "Jokin meni pieleen. Yritä hetken kuluttua uudelleen."), "err");
      console.error(error);
      return;
    }

    showSuccess(email);
    launchConfetti();
  });

  resend.addEventListener("click", async () => {
    if (resend.disabled || !currentEmail) return;
    resend.disabled = true;
    resend.textContent = tr("sending...", "lähetetään...");
    const { error } = await request(currentEmail);
    if (error && error.message !== "cooldown") {
      resend.disabled = false;
      resend.textContent = tr("failed, try again", "epäonnistui, yritä uudelleen");
      return;
    }
    startCooldown();
  });

  change.addEventListener("click", reset);
}

document.querySelectorAll("[data-signup]").forEach(setupSignup);

// --- Confetti burst (small delight, no library) ---
function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const colors = ["#e4002b", "#ffffff", "#8c001a", "#9b9ba4", "#e4002b"];
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:999;";
  document.body.appendChild(canvas);

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const pieces = Array.from({ length: 90 }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: window.innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * -9 - 4,
    size: Math.random() * 7 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.3,
  }));

  const gravity = 0.28;
  let frame = 0;
  const maxFrames = 130;

  function tick() {
    frame++;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of pieces) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (frame < maxFrames) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(tick);
}

// --- Easter eggs: type "trouble", or enter the Konami code ---
(function setupEasterEggs() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const word = "trouble";
  const konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let buffer = "";
  let pos = 0;

  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    // Konami code
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = key === konami[pos] ? pos + 1 : (key === konami[0] ? 1 : 0);
    if (pos === konami.length) {
      pos = 0;
      document.body.classList.add("retro-mode");
      if (window.dtToast) window.dtToast(tr("Retro mode unlocked", "Retro-tila avattu"));
      setTimeout(() => document.body.classList.remove("retro-mode"), 7000);
    }

    // "trouble"
    if (e.key.length !== 1) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-word.length);
    if (buffer === word) {
      buffer = "";
      document.body.classList.add("chaos-mode");
      launchConfetti();
      setTimeout(() => document.body.classList.remove("chaos-mode"), 2600);
    }
  });
})();

// --- Devlog ---
function postDate(iso) {
  return new Date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
}

function renderTeaser() {
  const el = document.getElementById("devlog-teaser");
  if (!el) return;
  if (state.isMember || !state.teaser.length) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <p class="teaser-label">${tr("Latest dispatches", "Tuoreimmat tiedotteet")}</p>
    ${state.teaser.map(p => `
      <div class="teaser-item">
        <time datetime="${escapeHtml(p.published_at)}">${postDate(p.published_at)}</time>
        <strong>${escapeHtml(p.title)}</strong>
        <span class="teaser-lock">${tr("Members only", "Vain jäsenille")}</span>
      </div>`).join("")}`;
  el.classList.remove("hidden");
}

function renderDevlog() {
  const list = document.getElementById("devlog-list");
  if (!list) return;

  if (!state.isMember) {
    list.innerHTML = `
      <div class="grid-empty">
        ${tr("Members only. Join the crew below to read the devlog.",
             "Vain jäsenille. Liity jengiin alla lukeaksesi kehityspäiväkirjaa.")}
        <a href="#crew" class="btn btn-primary">${tr("Join the crew", "Liity jengiin")}</a>
      </div>`;
    renderTeaser();
    return;
  }

  renderTeaser();
  if (state.devlogFailed) {
    list.innerHTML = `<div class="grid-empty">${tr("The devlog is unavailable right now. Try again later.",
      "Kehityspäiväkirja ei ole juuri nyt saatavilla. Yritä myöhemmin uudelleen.")}</div>`;
    return;
  }
  if (state.memberPosts === null) return; // still loading
  if (state.memberPosts.length === 0) {
    list.innerHTML = `<div class="grid-empty">${tr("First devlog coming soon.", "Ensimmäinen kehityspäiväkirja tulossa pian.")}</div>`;
    return;
  }

  list.innerHTML = state.memberPosts.map(p => `
    <article class="post">
      <time class="post-date" datetime="${escapeHtml(p.published_at)}">${postDate(p.published_at)}</time>
      <div>
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.body)}</p>
      </div>
    </article>`).join("");
}

async function loadDevlog(sessionToken) {
  const { data, error } = await db.rpc("get_devlog", { session_token_input: sessionToken });
  if (error || !data || !data.ok) {
    state.devlogFailed = true;
  } else {
    state.devlogFailed = false;
    state.memberPosts = data.posts || [];
  }
  renderDevlog();
}

// Titles and dates of the latest posts, shown to guests. Needs supabase_devlog_teaser.sql;
// without it the call just fails and the teaser stays hidden.
async function loadDevlogTeaser() {
  if (state.teaser.length) { renderTeaser(); return; }
  try {
    const { data, error } = await db.rpc("get_devlog_teaser");
    if (!error && Array.isArray(data)) state.teaser = data;
  } catch { /* optional feature */ }
  renderTeaser();
}

// --- Highlight the nav link for the section in view ---
(function setupScrollSpy() {
  if (!("IntersectionObserver" in window)) return;
  const map = new Map();
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(a => {
    const sec = document.getElementById(a.getAttribute("href").slice(1));
    if (sec) map.set(sec, a);
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const link = map.get(entry.target);
      if (link && entry.isIntersecting) {
        map.forEach(l => { l.classList.remove("is-active"); l.removeAttribute("aria-current"); });
        link.classList.add("is-active");
        link.setAttribute("aria-current", "true");
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  map.forEach((_, sec) => io.observe(sec));
})();

// --- Slide sections in as they scroll into view (content stays visible either way) ---
(function setupReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach(el => {
    el.classList.add("armed");
    io.observe(el);
  });
})();

// --- Hide the mobile "join" bar while a signup form is already on screen ---
(function setupMobileCta() {
  if (!("IntersectionObserver" in window)) return;
  const targets = document.querySelectorAll(".signup, #crew");
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target);
    });
    document.body.classList.toggle("signup-in-view", visible.size > 0);
  });
  targets.forEach(t => io.observe(t));
})();

// --- Re-render dynamic content when the language changes ---
document.addEventListener("dt:lang", () => {
  renderGames();
  renderMemberCount();
  renderMemberPanel();
  renderDevlog();
});

loadGames();
loadMemberCount();
checkSession();
