// Shared UI for every page: language switch (EN/FI), mobile menu,
// scroll progress, back-to-top, toasts and sharing.
(function () {
  document.documentElement.classList.add("js");

  // ---------------------------------------------------------------
  // Language
  // Elements with data-fi="..." swap their innerHTML between the
  // English markup in the page and the Finnish markup in the attribute.
  // data-fi-placeholder / data-fi-aria / data-fi-title work the same way
  // for those attributes. Scripts use window.dtT("English", "Suomi").
  // ---------------------------------------------------------------
  const LANG_KEY = "dts_lang";

  const LABELS = {
    "Games": "Pelit",
    "About": "Tietoa",
    "Roadmap": "Tiekartta",
    "Devlog": "Kehityspäiväkirja",
    "FAQ": "UKK",
    "Contact": "Yhteys",
    "Join the crew": "Liity jengiin",
    "Log out": "Kirjaudu ulos",
    "Explore": "Selaa",
    "Studio": "Studio",
    "Press kit": "Lehdistömateriaali",
    "Privacy": "Tietosuoja"
  };

  function detectLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "fi" || saved === "en") return saved;
    } catch (e) {}
    return (navigator.language || "en").toLowerCase().indexOf("fi") === 0 ? "fi" : "en";
  }

  window.dtLang = detectLang();
  window.dtT = function (en, fi) { return window.dtLang === "fi" ? fi : en; };

  const baseTitle = document.title;
  const labelNodes = [];
  document.querySelectorAll(".nav-links a, .nav-member button, .site-footer a, .site-footer h4").forEach(function (el) {
    const txt = el.textContent.trim();
    if (Object.prototype.hasOwnProperty.call(LABELS, txt) && el.children.length === 0) {
      labelNodes.push({ el: el, en: txt });
    }
  });

  function swapAttr(attr, target) {
    document.querySelectorAll("[data-fi-" + attr + "]").forEach(function (el) {
      const store = "data-en-" + attr;
      if (!el.hasAttribute(store)) el.setAttribute(store, el.getAttribute(target) || "");
      el.setAttribute(target, window.dtLang === "fi" ? el.getAttribute("data-fi-" + attr) : el.getAttribute(store));
    });
  }

  function applyLang(fire) {
    const fi = window.dtLang === "fi";
    document.documentElement.lang = fi ? "fi" : "en";

    document.querySelectorAll("[data-fi]").forEach(function (el) {
      if (!el.hasAttribute("data-en")) el.setAttribute("data-en", el.innerHTML);
      el.innerHTML = fi ? el.getAttribute("data-fi") : el.getAttribute("data-en");
    });
    labelNodes.forEach(function (n) { n.el.textContent = fi ? LABELS[n.en] : n.en; });
    swapAttr("placeholder", "placeholder");
    swapAttr("aria", "aria-label");

    const fiTitle = document.documentElement.getAttribute("data-fi-title");
    document.title = fi && fiTitle ? fiTitle : baseTitle;

    const btn = document.querySelector(".lang-toggle");
    if (btn) {
      btn.textContent = fi ? "EN" : "FI";
      btn.setAttribute("aria-label", fi ? "Switch to English" : "Vaihda suomeksi");
    }
    if (fire) document.dispatchEvent(new CustomEvent("dt:lang", { detail: window.dtLang }));
  }

  function setLang(lang) {
    window.dtLang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    applyLang(true);
  }

  // ---------------------------------------------------------------
  // Toast + share (used by the share buttons and copy actions)
  // ---------------------------------------------------------------
  let toastTimer = null;
  window.dtToast = function (message) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  };

  window.dtCopy = async function (text, okMessage) {
    try {
      await navigator.clipboard.writeText(text);
      window.dtToast(okMessage || window.dtT("Copied", "Kopioitu"));
      return true;
    } catch (e) {
      window.dtToast(window.dtT("Copy failed", "Kopiointi epäonnistui"));
      return false;
    }
  };

  window.dtShare = async function () {
    const data = {
      title: "Double Trouble Studios",
      text: window.dtT("Games with an edge. Built for trouble.", "Pelejä särmällä. Tehty aiheuttamaan harmia."),
      url: location.origin + location.pathname.replace(/[^/]*$/, "")
    };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    window.dtCopy(data.url, window.dtT("Link copied", "Linkki kopioitu"));
  };

  document.addEventListener("click", function (e) {
    const share = e.target.closest("[data-share]");
    if (share) { e.preventDefault(); window.dtShare(); }
    const copy = e.target.closest("[data-copy]");
    if (copy) { e.preventDefault(); window.dtCopy(copy.getAttribute("data-copy")); }
  });

  // ---------------------------------------------------------------
  // Nav: language button + mobile menu
  // ---------------------------------------------------------------
  const nav = document.querySelector(".nav");
  const links = document.querySelector(".nav-links");

  if (nav && links) {
    const lang = document.createElement("button");
    lang.type = "button";
    lang.className = "lang-toggle";
    lang.addEventListener("click", function () { setLang(window.dtLang === "fi" ? "en" : "fi"); });
    links.appendChild(lang);

    const toggle = document.createElement("button");
    toggle.className = "nav-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = "<span></span><span></span><span></span>";
    nav.insertBefore(toggle, links);

    const setOpen = function (open) {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  // ---------------------------------------------------------------
  // Scroll progress, back-to-top, mobile join bar state
  // ---------------------------------------------------------------
  const bar = document.createElement("div");
  bar.className = "scroll-progress";
  document.body.appendChild(bar);

  const top = document.createElement("button");
  top.type = "button";
  top.className = "to-top";
  top.setAttribute("data-fi-aria", "Takaisin ylös");
  top.setAttribute("aria-label", "Back to top");
  top.innerHTML = "&uarr;";
  document.body.appendChild(top);
  top.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  let ticking = false;
  function update() {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    top.classList.toggle("show", y > 900);
    document.body.classList.toggle("past-hero", y > 700);
  }
  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();

  applyLang(false);
})();
