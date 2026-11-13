// Interactive parts of the site. Each is an extra: without JavaScript every
// section shows, the filters stay hidden and the footer link goes to the top.
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  // Where supported, a closed panel stays searchable: the browser's find
  // opens it on a match.
  const findable = "onbeforematch" in document.body;

  function icon(paths) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
  }

  // Collapsible sections. Each [data-collapse] heading gets a button that
  // opens and closes the panel it names. Every panel starts open.
  const toggles = [];
  const toggleFor = new Map();

  function setOpen(button, open, animate = false) {
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    button.setAttribute("aria-expanded", String(open));
    if (open) {
      panel.hidden = false;
      if (animate && !reduceMotion.matches) {
        panel.classList.add("opening");
        panel.addEventListener("animationend",
          () => panel.classList.remove("opening"), { once: true });
      }
    } else if (findable) {
      panel.setAttribute("hidden", "until-found");
    } else {
      panel.hidden = true;
    }
  }

  // Opens every closed panel around an element, and the element's own
  // section if it is one, so a link or a search result is never hidden.
  function reveal(element) {
    for (let node = element; node; node = node.parentElement) {
      const button = toggleFor.get(node);
      if (button && button.getAttribute("aria-expanded") === "false") {
        setOpen(button, true);
      }
    }
    const own = element.matches("section, [data-collapse]")
      && element.querySelector(".toggle");
    if (own && own.getAttribute("aria-expanded") === "false") setOpen(own, true);
    syncAll();
  }

  for (const heading of document.querySelectorAll("[data-collapse]")) {
    const panel = document.getElementById(heading.dataset.collapse);
    if (!panel) continue;
    const startOpen = !heading.hasAttribute("data-collapsed");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toggle";
    button.setAttribute("aria-expanded", String(startOpen));
    button.setAttribute("aria-controls", panel.id);
    button.append(...heading.childNodes);
    button.insertAdjacentHTML("beforeend", '<span class="chevron" aria-hidden="true"></span>');
    heading.append(button);
    if (!startOpen) setOpen(button, false);
    button.addEventListener("click", () => {
      setOpen(button, button.getAttribute("aria-expanded") === "false", true);
      syncAll();
    });
    panel.addEventListener("beforematch", () => {
      setOpen(button, true);
      syncAll();
    });
    toggles.push(button);
    toggleFor.set(panel, button);
  }

  // The career timeline's x-axis fits the work lane when study is hidden,
  // and stretches to cover both when study is shown. The figure carries
  // both aria-labels; we swap in the shared-axis one while study is open.
  const careerFigure = document.querySelector(".career[data-shared-aria]");
  const studyToggle = document.querySelector(
    "[data-collapse='career-study-panel'] .toggle");
  if (careerFigure && studyToggle) {
    const workAria = careerFigure.getAttribute("aria-label");
    const sharedAria = careerFigure.dataset.sharedAria;
    const applyAxis = () => {
      const open = studyToggle.getAttribute("aria-expanded") === "true";
      careerFigure.dataset.axis = open ? "shared" : "work";
      careerFigure.setAttribute("aria-label", open ? sharedAria : workAria);
    };
    new MutationObserver(applyAxis).observe(studyToggle,
      { attributes: true, attributeFilter: ["aria-expanded"] });
  }

  // One button opens or closes every panel on the page.
  const allButton = document.querySelector("[data-collapse-all]");
  function syncAll() {
    if (!allButton) return;
    const anyClosed = toggles.some((b) => b.getAttribute("aria-expanded") === "false");
    allButton.textContent = anyClosed ? "Expand all" : "Collapse all";
  }
  allButton?.addEventListener("click", () => {
    const open = allButton.textContent === "Expand all";
    for (const button of toggles) setOpen(button, open);
    syncAll();
  });
  syncAll();

  // Links to a part of this page open whatever holds it.
  function targetOf(hash) {
    return hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
  }
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href*='#']");
    if (!link || link.pathname !== location.pathname) return;
    const target = targetOf(link.hash);
    if (target) reveal(target);
  });
  window.addEventListener("hashchange", () => {
    const target = targetOf(location.hash);
    if (target) reveal(target);
  });

  // Project filters: by area, by a skill from the Skills section and by
  // search text. A match inside a closed group opens it.
  const filters = document.querySelector("[data-filters]");
  if (filters) {
    const cards = [...document.querySelectorAll("[data-card]")];
    const groups = [...document.querySelectorAll("[data-group-section]")];
    const chips = [...filters.querySelectorAll("[data-filter]")];
    const search = filters.querySelector("input");
    const count = filters.querySelector("[data-count]");
    let area = "all";
    let skill = "";

    const apply = () => {
      const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const card of cards) {
        const match = (area === "all" || card.dataset.group === area)
          && (!skill || (card.dataset.skills || "").split(" ").includes(skill))
          && words.every((word) => card.dataset.search.includes(word));
        card.hidden = !match;
        if (match) shown += 1;
      }
      for (const group of groups) {
        const first = group.querySelector("[data-card]:not([hidden])");
        group.hidden = !first;
        if (first && (area !== "all" || skill || words.length)) reveal(first);
      }
      count.textContent = shown === cards.length
        ? `${cards.length} projects`
        : `${shown} of ${cards.length} projects`;
    };

    for (const chip of chips) {
      chip.addEventListener("click", () => {
        area = chip.dataset.filter;
        skill = "";
        for (const other of chips) {
          other.setAttribute("aria-pressed", String(other === chip));
        }
        apply();
      });
    }
    search.addEventListener("input", apply);

    // A skill shows the projects that used it; the link itself jumps to the
    // work section, and focus moves to the count so it is read out.
    for (const link of document.querySelectorAll("[data-skill]")) {
      link.addEventListener("click", () => {
        skill = link.dataset.skill;
        area = "all";
        for (const chip of chips) {
          chip.setAttribute("aria-pressed", String(chip.dataset.filter === "all"));
        }
        search.value = "";
        apply();
        requestAnimationFrame(() => count.focus({ preventScroll: true }));
      });
    }
    apply();
  }

  // Light and dark themes: the system setting until the visitor picks one,
  // then their choice, kept in their own browser.
  const themeButton = document.querySelector(".theme-toggle");
  const theme = () => root.dataset.theme || (prefersDark.matches ? "dark" : "light");
  const syncTheme = () => {
    const current = theme();
    const next = current === "dark" ? "light" : "dark";
    themeButton.dataset.current = current;
    themeButton.setAttribute("aria-label", `Switch to ${next} theme`);
    themeButton.title = `Switch to ${next} theme`;
  };
  if (themeButton) {
    themeButton.addEventListener("click", () => {
      const next = theme() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {
        // Storage can be blocked; the choice then lasts for this page only.
      }
      syncTheme();
    });
    prefersDark.addEventListener("change", syncTheme);
    syncTheme();
  }

  // Copy the email address, where the browser allows it.
  const mail = document.querySelector(".contact a[href^='mailto:']");
  const copy = document.querySelector(".contact .copy");
  const status = document.querySelector(".copy-status");
  if (copy && !(mail && navigator.clipboard && window.isSecureContext)) {
    copy.remove();
    status?.remove();
  } else if (copy) {
    let timer;
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(mail.textContent.trim());
        status.textContent = "Copied";
      } catch {
        status.textContent = "Could not copy";
      }
      clearTimeout(timer);
      timer = setTimeout(() => { status.textContent = ""; }, 2000);
    });
  }

  // Back to top: a button once the first screen has scrolled away, and the
  // footer link, both returning focus to the top of the page.
  const topButton = document.createElement("button");
  topButton.type = "button";
  topButton.className = "to-top-button";
  topButton.setAttribute("aria-label", "Back to top");
  topButton.innerHTML = icon('<path d="M12 19V5M5 12l7-7 7 7"/>');
  document.body.append(topButton);
  const goTop = (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
    document.querySelector(".brand")?.focus({ preventScroll: true });
  };
  topButton.addEventListener("click", goTop);
  for (const link of document.querySelectorAll("a[href='#top']")) {
    link.addEventListener("click", goTop);
  }

  // The header link for the section in view is marked as current.
  const spied = [...document.querySelectorAll(".site-header nav a")]
    .filter((link) => link.pathname === location.pathname)
    .map((link) => [link, targetOf(link.hash)])
    .filter(([, target]) => target);

  function onScroll() {
    topButton.classList.toggle("shown", window.scrollY > window.innerHeight * 0.8);
    const line = window.innerHeight * 0.4;
    const atEnd = window.innerHeight + window.scrollY
      >= document.documentElement.scrollHeight - 2;
    let current = null;
    for (const [link, target] of spied) {
      const box = target.getBoundingClientRect();
      if (box.top <= line && box.bottom > line) current = link;
    }
    if (atEnd && spied.length) current = spied[spied.length - 1][0];
    for (const [link] of spied) {
      if (link === current) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  }
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      onScroll();
      ticking = false;
    });
  }, { passive: true });
  onScroll();
})();
