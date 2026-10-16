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

  const gamesStat = document.getElementById("stat-games");
  if (gamesStat) gamesStat.textContent = !error && data ? String(data.length) : "\u2013";

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

// --- Member count (social proof) ---
async function loadMemberCount() {
  const el = document.getElementById("member-count");
  if (!el) return;

  const { data, error } = await db.rpc("get_member_count");
  if (error || !data || typeof data.count !== "number" || data.count < 1) return;

  const noun = data.count === 1 ? "troublemaker" : "troublemakers";
  el.textContent = `${data.count.toLocaleString("en-US")} ${noun} already causing chaos with us`;
  el.classList.remove("hidden");

  const statWrap = document.getElementById("stat-members-wrap");
  const statNum = document.getElementById("stat-members");
  if (statWrap && statNum) {
    statNum.textContent = data.count.toLocaleString("en-US");
    statWrap.classList.remove("hidden");
  }
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

function writeSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* private mode etc — ignore, membership still works this visit */ }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

function setGuestOnly(visible) {
  document.querySelectorAll(".guest-only").forEach(el => el.classList.toggle("hidden", !visible));
}

function showMember(email) {
  const nav = document.getElementById("nav-member");
  const navCta = document.getElementById("nav-cta");
  const memberPanel = document.getElementById("member-panel");

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
}

function showGuest() {
  showDevlogLocked();
  const nav = document.getElementById("nav-member");
  const navCta = document.getElementById("nav-cta");
  const memberPanel = document.getElementById("member-panel");

  setGuestOnly(true);
  if (nav) nav.classList.add("hidden");
  if (navCta) navCta.classList.remove("hidden");
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
  const count = root.querySelector(".count");
  const change = root.querySelector(".sub-change");
  const idleLabel = label.textContent;
  let currentEmail = "";
  let timer = null;

  function say(text, kind) {
    status.className = "sub-status" + (kind ? " " + kind : "");
    status.textContent = text;
  }

  function startCooldown() {
    clearInterval(timer);
    let left = COOLDOWN_SECONDS;
    resend.disabled = true;
    resend.innerHTML = 'resend in <span class="count">' + left + "</span>s";
    timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        resend.disabled = false;
        resend.textContent = "resend the link";
      } else {
        resend.innerHTML = 'resend in <span class="count">' + left + "</span>s";
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
      say("Enter a valid email address, like you@email.com.", "err");
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }

    // Bots fill the hidden field. Pretend it worked and send nothing.
    if (honeypot && honeypot.value) {
      showSuccess(email);
      return;
    }

    btn.disabled = true;
    btn.classList.add("loading");
    label.textContent = "Sending";
    say("");

    const { error } = await request(email);

    btn.disabled = false;
    btn.classList.remove("loading");
    label.textContent = idleLabel;

    if (error && error.message === "cooldown") {
      say("You just asked for a link. Check your inbox, or try again in " + error.seconds + "s.", "err");
      return;
    }
    if (error) {
      say("Something went wrong. Please try again in a moment.", "err");
      console.error(error);
      return;
    }

    showSuccess(email);
    launchConfetti();
  });

  resend.addEventListener("click", async () => {
    if (resend.disabled || !currentEmail) return;
    resend.disabled = true;
    resend.textContent = "sending...";
    const { error } = await request(currentEmail);
    if (error && error.message !== "cooldown") {
      resend.disabled = false;
      resend.textContent = "failed, try again";
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

// --- Easter egg: type "trouble" anywhere on the page ---
(function setupTroubleEgg() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const target = "trouble";
  let buffer = "";

  window.addEventListener("keydown", (e) => {
    if (e.key.length !== 1) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-target.length);
    if (buffer === target) {
      buffer = "";
      document.body.classList.add("chaos-mode");
      launchConfetti();
      setTimeout(() => document.body.classList.remove("chaos-mode"), 2600);
    }
  });
})();

// --- Devlog ---
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function showDevlogLocked() {
  const list = document.getElementById("devlog-list");
  if (!list) return;
  list.innerHTML = `
    <div class="grid-empty">
      Members only — join the crew below to read the devlog.
      <a href="#crew" class="btn btn-primary">Join the crew</a>
    </div>
  `;
}

async function loadDevlog(sessionToken) {
  const list = document.getElementById("devlog-list");
  if (!list) return;

  const { data, error } = await db.rpc("get_devlog", { session_token_input: sessionToken });

  if (error || !data || !data.ok) {
    list.innerHTML = `<div class="grid-empty">The devlog is unavailable right now. Try again later.</div>`;
    return;
  }

  if (!data.posts || data.posts.length === 0) {
    list.innerHTML = `<div class="grid-empty">First devlog coming soon.</div>`;
    return;
  }

  list.innerHTML = data.posts.map(p => {
    const date = new Date(p.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return `
      <article class="post">
        <time class="post-date" datetime="${escapeHtml(p.published_at)}">${date}</time>
        <div>
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.body)}</p>
        </div>
      </article>
    `;
  }).join("");
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
        map.forEach(l => l.classList.remove("is-active"));
        link.classList.add("is-active");
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

loadGames();
loadMemberCount();
checkSession();
