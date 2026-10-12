

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SLIDE_TIME = 9000; // keep in sync with --slide-time in styles.css

/* Run something now, or once the logo loading screen lifts if it's still up
   (so animations play where people can see them, not behind the cover). */
const waitingForCover = [];
function whenUncovered(fn) {
  if (document.documentElement.classList.contains("cover-up")) waitingForCover.push(fn);
  else fn();
}
document.addEventListener("pagecover", (e) => {
  if (!e.detail.up) waitingForCover.splice(0).forEach((fn) => fn());
});

/* ---------- Wrap each word in <span class="w"> so it can animate on its own ---------- */
function splitWords(root) {
  let index = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
        return;
      }
      if (child.nodeType !== Node.TEXT_NODE) return;

      const fragment = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          fragment.append(part);
          return;
        }
        const word = document.createElement("span");
        word.className = "w";
        word.textContent = part;
        word.style.setProperty("--i", index++);
        fragment.append(word);
      });
      child.replaceWith(fragment);
    });
  };
  walk(root);
}

/* ---------- Hero slider ---------- */
function initSlider() {
  const hero = document.querySelector(".hero");
  if (!hero || !hero.querySelector(".hero-slides")) return; // only on the homepage
  const slides = hero.querySelectorAll(".slide");
  const dots = hero.querySelectorAll(".dot");
  let current = 0;
  let timer = null;

  hero.querySelectorAll(".slide-line:not(.btn)").forEach(splitWords);

  const show = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === current);
      slide.setAttribute("aria-hidden", i !== current);
      slide.querySelectorAll("a").forEach((a) => (a.tabIndex = i === current ? 0 : -1));
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === current);
      dot.setAttribute("aria-current", i === current);
    });
  };

  // reasons the slider is paused; it only runs when none of them apply
  const paused = { offscreen: false, tabHidden: document.hidden, keyboard: false, cover: document.documentElement.classList.contains("cover-up"), user: false };
  const canRun = () => !reducedMotion && !Object.values(paused).some(Boolean);

  const stop = () => {
    clearTimeout(timer);
    dots.forEach((dot) => dot.classList.remove("is-timing"));
  };

  // the active dot fills up while the slide waits, then it moves on
  const start = () => {
    stop();
    if (!canRun()) return;
    const dot = dots[current];
    void dot.offsetWidth; // restart the fill animation
    dot.classList.add("is-timing");
    timer = setTimeout(() => { show(current + 1); start(); }, SLIDE_TIME);
  };

  const setPaused = (reason, value) => {
    if (paused[reason] === value) return;
    paused[reason] = value;
    start(); // start() stops first, and only restarts if nothing is pausing it
  };

  const go = (index) => { show(index); start(); };
  hero.querySelector(".prev").addEventListener("click", () => go(current - 1));
  hero.querySelector(".next").addEventListener("click", () => go(current + 1));
  dots.forEach((dot, i) => dot.addEventListener("click", () => go(i)));

  // pause/play button: stays paused until pressed again (also stops the background motion, see CSS)
  const pauseButton = hero.querySelector(".slide-pause");
  if (pauseButton) {
    pauseButton.addEventListener("click", () => {
      const pause = !paused.user;
      hero.classList.toggle("is-paused", pause);
      pauseButton.setAttribute("aria-label", pause ? "Play slideshow" : "Pause slideshow");
      setPaused("user", pause);
    });
  }

  // pause while keyboard users are tabbing through it (mouse clicks don't count)
  hero.addEventListener("focusin", (e) => {
    if (e.target.matches(":focus-visible")) setPaused("keyboard", true);
  });
  hero.addEventListener("focusout", (e) => {
    if (!hero.contains(e.relatedTarget)) setPaused("keyboard", false);
  });

  // pause when the hero is scrolled out of view or the tab is in the background
  new IntersectionObserver(([entry]) => {
    setPaused("offscreen", entry.intersectionRatio < 0.3);
  }, { threshold: [0, 0.3] }).observe(hero);
  document.addEventListener("visibilitychange", () => setPaused("tabHidden", document.hidden));
  document.addEventListener("pagecover", (e) => setPaused("cover", e.detail.up));

  show(0);
  start();
}

/* ---------- Menu ---------- */
function initNav() {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  const links = [...nav.querySelectorAll("a")];

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", open);
    nav.classList.toggle("is-open", open);
    header.classList.toggle("menu-open", open);
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  links.forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  // highlight the menu item for the section on screen
  // (only links to sections on this page; links to other pages are left alone)
  const samePage = links.filter((a) => a.hash && a.pathname === location.pathname);
  const sections = samePage.map((a) => document.querySelector(a.hash)).filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      samePage.forEach((a) => a.classList.toggle("is-current", a.hash === `#${entry.target.id}`));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((section) => observer.observe(section));
}

/* ---------- Everything that reacts to scrolling, batched into one frame ---------- */
function initScrollEffects() {
  const header = document.querySelector(".site-header");
  const hero = document.querySelector(".hero");
  const heroBg = document.querySelector(".hero .hero-bg"); // homepage only
  const toTop = document.querySelector(".to-top");
  let ticking = false;

  const update = () => {
    const y = window.scrollY;

    header.classList.toggle("is-scrolled", y > 40);
    toTop.classList.toggle("is-visible", y > window.innerHeight * 0.8);

    // the hero photo moves slower than the page
    if (heroBg && !reducedMotion && y < hero.offsetHeight) {
      heroBg.style.setProperty("--parallax", `${y * 0.35}px`);
    }
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener("resize", update);
  update();
}

/* ---------- Animate things in as they scroll into view ---------- */
function initReveal() {
  document.querySelectorAll(".reveal-words p").forEach(splitWords);

  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      whenUncovered(() => entry.target.classList.add("is-visible"));
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  items.forEach((item) => observer.observe(item));
}

/* ---------- Prices count up when they come into view ---------- */
function initCountUp() {
  const numbers = document.querySelectorAll("[data-count]");
  if (reducedMotion || !("IntersectionObserver" in window)) return;

  const format = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const run = (el) => {
    const target = Number(el.dataset.count);
    const duration = 1400;
    const startTime = performance.now();
    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      el.textContent = format(target * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      whenUncovered(() => setTimeout(() => run(entry.target), 300)); // let the tile start rising first
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.6 });

  numbers.forEach((el) => {
    el.textContent = format(0);
    observer.observe(el);
  });
}

/* ---------- Screenshot slider on the project page ----------
   js/portfolio.js puts the screenshots in; this adds the dots
   and makes the arrows work.                                  */
function initShotSliders() {
  document.querySelectorAll("[data-slider]").forEach((slider) => {
    const slides = [...slider.querySelectorAll(".slide-img")];
    const arrows = slider.querySelectorAll(".slider-arrow");
    if (slides.length < 2) {
      arrows.forEach((a) => a.remove());
      return;
    }

    let current = Math.max(0, slides.findIndex((s) => s.classList.contains("is-active")));
    const dotsBox = slider.querySelector(".slider-dots");
    const dots = slides.map((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "dot";
      dot.setAttribute("aria-label", `Screenshot ${i + 1}`);
      dot.addEventListener("click", () => show(i));
      dotsBox.append(dot);
      return dot;
    });

    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle("is-active", i === current));
      dots.forEach((d, i) => d.classList.toggle("is-active", i === current));
    }

    slider.querySelector(".slider-arrow.prev").addEventListener("click", () => show(current - 1));
    slider.querySelector(".slider-arrow.next").addEventListener("click", () => show(current + 1));

    // swipe left/right on touch screens (up/down still scrolls the page)
    let start = null;
    slider.addEventListener("touchstart", (e) => {
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    slider.addEventListener("touchend", (e) => {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1));
      start = null;
    });

    show(current);
  });
}

/* ---------- Logo loading screen ---------- */
function initPageCover() {
  const cover = document.querySelector(".page-cover");
  if (!cover) return;
  const root = document.documentElement;
  const fill = cover.querySelector(".page-cover-fill");
  const FADE_IN = 260;  // ms for the cover to fade in before leaving or jumping
  const MIN_SHOW = 400; // on page load, keep the logo up at least this long
  const HOLD = 450;     // after a jump on the same page, how long the logo stays up

  // slide the bar to `to` (0 to 1), starting from `from` or from wherever it is right now
  const moveBar = (from, to, duration) => {
    const start = from === null ? getComputedStyle(fill).transform : `scaleX(${from})`;
    fill.style.animation = "none"; // stop the CSS fill-while-loading animation, if it's running
    fill.getAnimations().forEach((a) => a.cancel());
    const move = fill.animate(
      [{ transform: start === "none" ? "scaleX(0)" : start }, { transform: `scaleX(${to})` }],
      { duration, easing: "cubic-bezier(.25, .7, .3, 1)", fill: "forwards" }
    );
    // done when it finishes, or on time anyway (background tabs can pause animations);
    // a newer move can cancel this one, and that's fine
    return Promise.race([move.finished.catch(() => {}), new Promise((r) => setTimeout(r, duration + 50))]);
  };

  const setCover = (up) => {
    cover.classList.toggle("is-on", up);
    if (!up) {
      cover.classList.remove("is-loading");
      // once it has faded out, empty the bar for next time
      setTimeout(() => { if (!cover.classList.contains("is-on")) fill.getAnimations().forEach((a) => a.cancel()); }, 400);
    }
    root.classList.toggle("cover-up", up);
    document.dispatchEvent(new CustomEvent("pagecover", { detail: { up } }));
  };

  // page load: wait for everything (images too), but never more than 2.5s
  let lifted = false;
  const lift = () => {
    if (lifted) return;
    lifted = true;
    // arriving at a section (like index.html#services): jump there before lifting
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
    setTimeout(async () => {
      await moveBar(null, 1, 250); // finish the bar
      setCover(false);
    }, Math.max(0, MIN_SHOW - performance.now()));
  };
  if (document.readyState === "complete") lift();
  else window.addEventListener("load", lift, { once: true });
  setTimeout(lift, 2500);

  // the back button can bring a page back exactly as it was left, cover and all
  let busy = false;
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    busy = false;
    setCover(false);
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || busy || event.defaultPrevented || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; // opening in a new tab
    if (link.target === "_blank" || link.hasAttribute("download") || link.classList.contains("skip-link")) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return; // other sites, email and phone links

    const samePage = url.pathname === location.pathname && url.search === location.search;
    if (samePage && url.hash) {
      // a section on this page: cover, jump straight there, uncover
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      event.preventDefault();
      busy = true;
      setCover(true);
      moveBar(0, 1, FADE_IN + HOLD);
      setTimeout(() => {
        target.scrollIntoView({ behavior: "instant", block: "start" });
        history.pushState(null, "", url.hash);
        // keyboard users: move focus to the section they jumped to
        if (event.detail === 0) {
          target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
        }
        setTimeout(() => { setCover(false); busy = false; }, HOLD);
      }, FADE_IN);
      return;
    }

    // another page on the site: cover first, then go (the next page starts covered)
    event.preventDefault();
    busy = true;
    setCover(true);
    moveBar(0, 0.3, FADE_IN);
    try { sessionStorage.setItem("coverContinue", "1"); } catch (e) {}
    setTimeout(() => { location.href = url.href; }, FADE_IN);
  });
}

/* ---------- Message box: our own drag handle to make it taller or shorter ---------- */
function initMessageGrip() {
  document.querySelectorAll(".textarea-grip").forEach((grip) => {
    const box = grip.parentElement.querySelector("textarea");
    const min = parseFloat(getComputedStyle(box).minHeight) || 150;
    const max = 640;

    grip.addEventListener("pointerdown", (event) => {
      event.preventDefault(); // don't start selecting text
      try { grip.setPointerCapture(event.pointerId); } catch (e) {}
      grip.classList.add("is-dragging");
      const startY = event.clientY;
      const startHeight = box.offsetHeight;

      const move = (e) => {
        box.style.height = `${Math.min(max, Math.max(min, startHeight + e.clientY - startY))}px`;
      };
      const stop = () => {
        grip.classList.remove("is-dragging");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
      // listen on the whole window, so the drag keeps working even when the pointer leaves the handle
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    });
  });
}

/* ---------- Links that open a new tab say so (for screen readers) ---------- */
function initNewTabNotes() {
  const note = " (opens in a new tab)";
  document.querySelectorAll('a[target="_blank"]').forEach((link) => {
    const label = link.getAttribute("aria-label");
    if (label) {
      if (!label.includes("new tab")) link.setAttribute("aria-label", label + note);
    } else if (!link.querySelector(".sr-only")) {
      const hidden = document.createElement("span");
      hidden.className = "sr-only";
      hidden.textContent = note;
      link.append(hidden);
    }
  });
}

/* ---------- Pricing buttons prefill the subject ---------- */
function initSubjectPrefill() {
  document.querySelectorAll("[data-subject]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("subject").value = btn.dataset.subject;
    });
  });
}

/* ---------- Contact form ----------
   Same behaviour as the old jQuery version: validate, POST the
   fields to email.php, and expect the text "sent" back.          */
function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return; // only on the homepage
  const button = document.getElementById("send_message");
  const status = document.getElementById("form-status");

  const checks = [
    { id: "name",         error: "name_error",    valid: (v) => v.length > 0 },
    { id: "email",        error: "email_error",   valid: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
    { id: "subject",      error: "subject_error", valid: (v) => v.length > 0 },
    { id: "your_message", error: "message_error", valid: (v) => v.length > 0 },
  ];

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    status.className = "form-status";

    let firstInvalid = null;
    checks.forEach(({ id, error, valid }) => {
      const input = document.getElementById(id);
      const ok = valid(input.value.trim());
      input.setAttribute("aria-invalid", !ok);
      if (ok) input.removeAttribute("aria-describedby");
      else input.setAttribute("aria-describedby", error); // screen readers read the error with the field
      document.getElementById(error).classList.toggle("is-visible", !ok);
      if (!ok && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    button.disabled = true;
    button.textContent = "Sending…";

    try {
      const response = await fetch(form.action, { method: "POST", body: new FormData(form) });
      const result = (await response.text()).trim();
      if (result !== "sent") throw new Error(result);

      form.reset();
      status.textContent = "Your message has been sent successfully.";
      status.classList.add("is-success");
    } catch {
      status.textContent = "Sorry, an error occurred sending your message. Please email houghe@bavts.org directly.";
      status.classList.add("is-error");
    } finally {
      button.disabled = false;
      button.textContent = "Send Message";
    }
  });
}

/* ---------- Init ---------- */
document.getElementById("year").textContent = new Date().getFullYear();
initSlider();
initNav();
initScrollEffects();
initReveal();
initCountUp();
initShotSliders();
initPageCover();
initNewTabNotes();
initSubjectPrefill();
initMessageGrip();
initContactForm();
