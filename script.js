(function () {
  "use strict";

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const consultationModal = document.getElementById("consultationModal");
  const consultationForm = document.getElementById("consultationForm");
  const consultationStatus = document.getElementById("consultationStatus");
  const consultationSubmitButton = consultationForm
    ? consultationForm.querySelector('button[type="submit"]')
    : null;
  const portfolioPreviewModal = document.getElementById("portfolioPreviewModal");
  const portfolioPreviewImage = document.getElementById("portfolioPreviewImage");
  const portfolioPreviewTitle = document.getElementById("portfolioPreviewTitle");
  const portfolioPreviewDomain = document.getElementById("portfolioPreviewDomain");
  const portfolioPreviewLiveLink = document.getElementById("portfolioPreviewLiveLink");

  const consultationConfig = {
    endpoint: consultationForm ? String(consultationForm.dataset.endpoint || "").trim() : "",
    maxAttachmentBytes: 10 * 1024 * 1024,
    requestTimeoutMs: 30000,
    allowedExtensions: ["pdf", "doc", "docx", "txt", "jpg", "jpeg", "png", "zip"],
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "image/jpeg",
      "image/png",
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream"
    ]
  };

  const defaultConsultationStatus = consultationStatus ? consultationStatus.textContent : "";
  const defaultConsultationSubmitLabel = consultationSubmitButton ? consultationSubmitButton.textContent : "";
  const defaultConsultationEyebrow = "Book a Consultation";
  let activeConsultationTopic = "";
  let consultationReturnFocus = null;
  let portfolioReturnFocus = null;

  function prefersReducedMotion() {
    return reducedMotionQuery.matches;
  }

  /* ---------------------------------------------------------------
   * Consultation form (submission logic preserved from the previous
   * version: same endpoint, payload fields, limits, and conversion).
   * ------------------------------------------------------------- */

  function getFileExtension(fileName) {
    const segments = String(fileName || "").split(".");

    return segments.length > 1 ? segments.pop().toLowerCase() : "";
  }

  function guessMimeType(extension) {
    switch (extension) {
      case "pdf":
        return "application/pdf";
      case "doc":
        return "application/msword";
      case "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "txt":
        return "text/plain";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "zip":
        return "application/zip";
      default:
        return "application/octet-stream";
    }
  }

  function setConsultationStatus(message, tone) {
    if (!consultationStatus) {
      return;
    }

    consultationStatus.textContent = message;
    consultationStatus.classList.remove("is-success", "is-error", "is-pending");

    if (tone) {
      consultationStatus.classList.add("is-" + tone);
    }
  }

  function setConsultationSubmitting(isSubmitting) {
    if (!consultationSubmitButton) {
      return;
    }

    consultationSubmitButton.disabled = isSubmitting;
    consultationSubmitButton.textContent = isSubmitting
      ? "Sending Consultation Request..."
      : defaultConsultationSubmitLabel;
  }

  function trackAdsLeadFormConversion() {
    if (typeof window.gtag === "function") {
      window.gtag("event", "conversion", {
        send_to: "AW-17948229197/VZTvCKPwzogcEM38sO5C"
      });
      return;
    }

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: "conversion",
        send_to: "AW-17948229197/VZTvCKPwzogcEM38sO5C"
      });
    }
  }

  function validateConsultationFiles(files) {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const extension = getFileExtension(file.name);
      const mimeType = String(file.type || guessMimeType(extension)).toLowerCase();

      if (!consultationConfig.allowedExtensions.includes(extension)) {
        throw new Error(
          "Unsupported attachment type for " +
            file.name +
            ". Use PDF, DOC, DOCX, TXT, JPG, PNG, or ZIP."
        );
      }

      if (file.size > consultationConfig.maxAttachmentBytes) {
        throw new Error(file.name + " exceeds the 10 MB file size limit.");
      }

      if (mimeType && !consultationConfig.allowedMimeTypes.includes(mimeType)) {
        throw new Error("Unsupported attachment format for " + file.name + ".");
      }
    }
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();

      reader.onload = function () {
        const result = String(reader.result || "");
        const commaIndex = result.indexOf(",");

        if (commaIndex === -1) {
          reject(new Error("Could not process attachment " + file.name + "."));
          return;
        }

        resolve(result.slice(commaIndex + 1));
      };

      reader.onerror = function () {
        reject(new Error("Could not read attachment " + file.name + "."));
      };

      reader.readAsDataURL(file);
    });
  }

  async function serializeAttachments(files) {
    const attachments = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const extension = getFileExtension(file.name);

      attachments.push({
        name: file.name,
        size: file.size,
        mimeType: String(file.type || guessMimeType(extension)).toLowerCase(),
        base64: await readFileAsBase64(file)
      });
    }

    return attachments;
  }

  async function buildConsultationPayload() {
    if (!consultationForm) {
      throw new Error("Consultation form is not available.");
    }

    const formData = new FormData(consultationForm);
    const firstName = String(formData.get("first_name") || "").trim();
    const lastName = String(formData.get("last_name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const projectDescription = String(formData.get("project_description") || "").trim();
    const files = Array.from(
      (consultationForm.querySelector('input[name="attachments"]') || {}).files || []
    );

    if (!firstName) {
      throw new Error("First name is required.");
    }

    if (!lastName) {
      throw new Error("Last name is required.");
    }

    if (!email) {
      throw new Error("Email address is required.");
    }

    if (!projectDescription) {
      throw new Error("Project details are required.");
    }

    validateConsultationFiles(files);

    const interest = String(formData.get("interest") || "").trim();
    const contextLines = [];
    if (interest) contextLines.push("Interested in: " + interest);
    if (activeConsultationTopic && activeConsultationTopic !== interest) {
      contextLines.push("Started from: " + activeConsultationTopic);
    }
    const fullDescription = contextLines.length
      ? contextLines.join("\n") + "\n\n" + projectDescription
      : projectDescription;

    return {
      source: window.location.hostname || "sumoaisolutions.com",
      pageUrl: window.location.href,
      firstName: firstName,
      lastName: lastName,
      fullName: (firstName + " " + lastName).trim(),
      email: email,
      phone: phone,
      message: fullDescription,
      projectDescription: fullDescription,
      interest: interest,
      topic: activeConsultationTopic,
      attachments: await serializeAttachments(files)
    };
  }

  async function postConsultationPayload(endpoint, payload, mode) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller
      ? window.setTimeout(function () {
          controller.abort();
        }, consultationConfig.requestTimeoutMs)
      : 0;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        mode: mode,
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });

      if (mode === "no-cors") {
        return {
          success: true,
          opaque: true,
          message:
            "Consultation request sent. The browser could not read the Google Apps Script confirmation, but the request was submitted."
        };
      }

      let data = null;

      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }

      if (!response.ok || !data || data.success !== true) {
        throw new Error(
          (data && data.message) || "The consultation request could not be processed."
        );
      }

      return data;
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("The consultation request timed out. Please try again.");
      }

      throw error;
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  async function submitConsultationPayload(payload) {
    const endpoint = consultationConfig.endpoint;

    if (!/^https?:\/\//.test(endpoint)) {
      throw new Error(
        "Add your deployed Google Apps Script web app URL to the form's data-endpoint attribute before sending live requests."
      );
    }

    try {
      return await postConsultationPayload(endpoint, payload, "cors");
    } catch (error) {
      const isCorsLikeError =
        error &&
        (error.name === "TypeError" ||
          /fetch|cors|network/i.test(String(error.message || "")));

      if (!isCorsLikeError) {
        throw error;
      }

      return postConsultationPayload(endpoint, payload, "no-cors");
    }
  }

  /* ---------------------------------------------------------------
   * Modals
   * ------------------------------------------------------------- */

  function syncModalState() {
    const isOpen = Boolean(
      (consultationModal && !consultationModal.hidden) ||
      (portfolioPreviewModal && !portfolioPreviewModal.hidden)
    );
    document.body.classList.toggle("is-modal-open", isOpen);
    const pageShell = $(".page-shell");
    if (pageShell) pageShell.inert = isOpen;
    const mobileCta = $("[data-mobile-cta]");
    if (mobileCta) mobileCta.inert = isOpen;
  }

  function restoreFocus(element) {
    if (element && element.isConnected) element.focus({ preventScroll: true });
  }

  function selectInterest(value) {
    if (!consultationForm) return;
    const radios = $$('input[name="interest"]', consultationForm);
    radios.forEach(function (radio) {
      radio.checked = Boolean(value) && radio.value === value;
    });
  }

  function openConsultationModal(event) {
    if (!consultationModal) return;

    const source = event && event.currentTarget;
    consultationReturnFocus = document.activeElement;

    if (portfolioPreviewModal && !portfolioPreviewModal.hidden) {
      consultationReturnFocus = portfolioReturnFocus;
      closePortfolioPreviewModal({ restore: false });
    }

    const topic = source && source.dataset ? String(source.dataset.consultationTopic || "") : "";
    const interest = source && source.dataset ? String(source.dataset.interest || "") : "";
    activeConsultationTopic = topic;

    const label = $(".consultation-head .eyebrow", consultationModal);
    if (label) label.textContent = topic || defaultConsultationEyebrow;
    if (interest) selectInterest(interest);

    consultationModal.hidden = false;
    syncModalState();
    setConsultationStatus(defaultConsultationStatus, "");
    setConsultationSubmitting(false);

    const title = document.getElementById("consultationTitle");
    if (title) title.focus({ preventScroll: true });
  }

  function closeConsultationModal() {
    if (!consultationModal || consultationModal.hidden) return;
    consultationModal.hidden = true;
    syncModalState();
    restoreFocus(consultationReturnFocus);
  }

  function openPortfolioPreviewModal(trigger) {
    if (!portfolioPreviewModal || !trigger || !trigger.dataset) return;

    const previewUrl = String(trigger.dataset.previewUrl || "").trim();
    const previewTitle = String(trigger.dataset.previewTitle || "Project").trim();
    const previewDomain = String(trigger.dataset.previewDomain || "Website preview").trim();
    const previewImageUrl = String(trigger.dataset.previewImage || "").trim();

    if (!/^https?:\/\//.test(previewUrl) || !previewImageUrl) return;

    const imageUrl = new URL(previewImageUrl, document.baseURI);
    if (!/^https?:$/.test(imageUrl.protocol)) return;

    portfolioReturnFocus = trigger;
    if (portfolioPreviewTitle) portfolioPreviewTitle.textContent = previewTitle;
    if (portfolioPreviewDomain) portfolioPreviewDomain.textContent = previewDomain;
    if (portfolioPreviewLiveLink) portfolioPreviewLiveLink.href = previewUrl;
    if (portfolioPreviewImage) {
      portfolioPreviewImage.src = imageUrl.href;
      portfolioPreviewImage.alt = previewTitle + " full page preview";
      portfolioPreviewImage.hidden = false;
    }

    portfolioPreviewModal.hidden = false;
    syncModalState();
    const frameWrap = $(".portfolio-preview-frame-wrap", portfolioPreviewModal);
    if (frameWrap) frameWrap.scrollTop = 0;
    if (portfolioPreviewTitle) portfolioPreviewTitle.focus({ preventScroll: true });
  }

  function closePortfolioPreviewModal(options) {
    if (!portfolioPreviewModal || portfolioPreviewModal.hidden) return;
    portfolioPreviewModal.hidden = true;
    if (portfolioPreviewImage) {
      portfolioPreviewImage.hidden = true;
      portfolioPreviewImage.removeAttribute("src");
      portfolioPreviewImage.alt = "";
    }
    syncModalState();
    if (!options || options.restore !== false) restoreFocus(portfolioReturnFocus);
  }

  async function handleConsultationSubmit(event) {
    event.preventDefault();
    if (!consultationForm) return;

    try {
      setConsultationSubmitting(true);
      setConsultationStatus("Sending your details...", "pending");

      const payload = await buildConsultationPayload();
      await submitConsultationPayload(payload);

      consultationForm.reset();
      setConsultationStatus("Thank you! Your request was sent. We'll be in touch soon.", "success");
      trackAdsLeadFormConversion();
    } catch (error) {
      setConsultationStatus(
        (error && error.message) || "The consultation request could not be sent.",
        "error"
      );
    } finally {
      setConsultationSubmitting(false);
    }
  }

  function handleKeyDown(event) {
    const activeModal = consultationModal && !consultationModal.hidden
      ? consultationModal
      : portfolioPreviewModal && !portfolioPreviewModal.hidden ? portfolioPreviewModal : null;

    if (!activeModal) return;

    if (event.key === "Escape") {
      if (activeModal === portfolioPreviewModal) closePortfolioPreviewModal();
      else closeConsultationModal();
      return;
    }

    if (event.key !== "Tab") return;

    const controls = $$(
      'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      activeModal
    ).filter(function (element) { return element.getClientRects().length > 0; });
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) return;

    if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------------------------------------------------------------
   * Hero showcase: rotates through real projects
   * ------------------------------------------------------------- */

  function initShowcase() {
    const showcase = $("[data-showcase]");
    if (!showcase) return;

    const tabs = $$("[data-showcase-tab]", showcase);
    const desktops = $$("[data-showcase-desktop]", showcase);
    const mobiles = $$("[data-showcase-mobile]", showcase);
    const title = $("[data-showcase-title]", showcase);
    const type = $("[data-showcase-type]", showcase);
    const url = $("[data-showcase-url]", showcase);
    const opener = $("[data-showcase-open]", showcase);
    const rotateMs = 5200;
    let index = 0;
    let timer = 0;
    let paused = false;

    showcase.style.setProperty("--rotate-ms", rotateMs + "ms");

    function show(nextIndex, fromUser) {
      index = (nextIndex + tabs.length) % tabs.length;
      tabs.forEach(function (tab, i) {
        const active = i === index;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        // restart progress animation
        const bar = $(".progress", tab);
        if (bar && active) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; }
      });
      desktops.forEach(function (img, i) { img.classList.toggle("is-active", i === index); });
      mobiles.forEach(function (img, i) { img.classList.toggle("is-active", i === index); });

      const tab = tabs[index];
      if (title) title.textContent = tab.dataset.title;
      if (type) type.textContent = tab.dataset.type;
      if (url) url.textContent = tab.dataset.url;
      if (opener) opener.setAttribute("aria-label", "Preview the " + tab.dataset.title + " website");
      if (fromUser) restart();
    }

    function stop() {
      window.clearTimeout(timer);
      timer = 0;
    }

    function restart() {
      stop();
      if (prefersReducedMotion() || paused) {
        showcase.classList.remove("is-rotating");
        return;
      }
      showcase.classList.add("is-rotating");
      timer = window.setTimeout(function () { show(index + 1); restart(); }, rotateMs);
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { show(i, true); });
      tab.addEventListener("keydown", function (event) {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          show(index + (event.key === "ArrowRight" ? 1 : -1), true);
          tabs[index].focus();
        }
      });
    });

    if (opener) {
      opener.addEventListener("click", function () {
        const tab = tabs[index];
        openPortfolioPreviewModal({
          dataset: {
            previewUrl: tab.dataset.live,
            previewTitle: tab.dataset.title,
            previewDomain: tab.dataset.url,
            previewImage: tab.dataset.full
          }
        });
        portfolioReturnFocus = opener;
      });
    }

    function setPaused(value) {
      paused = value;
      showcase.classList.toggle("is-paused", value);
      if (value) stop(); else restart();
    }

    showcase.addEventListener("mouseenter", function () { setPaused(true); });
    showcase.addEventListener("mouseleave", function () { setPaused(false); });
    showcase.addEventListener("focusin", function () { setPaused(true); });
    showcase.addEventListener("focusout", function (event) {
      if (!showcase.contains(event.relatedTarget)) setPaused(false);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else restart();
    });

    // Only rotate while the showcase is on screen.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) restart(); else stop();
        });
      }, { threshold: 0.2 }).observe(showcase);
    } else {
      restart();
    }
  }

  /* ---------------------------------------------------------------
   * "What do you need?" picker (ARIA tabs)
   * ------------------------------------------------------------- */

  function initPicker() {
    $$("[data-picker]").forEach(function (picker) {
      const tabs = $$("[data-picker-tab]", picker);
      const panels = $$("[data-picker-panel]", picker);

      function select(nextTab, moveFocus) {
        tabs.forEach(function (tab) {
          const active = tab === nextTab;
          tab.setAttribute("aria-selected", String(active));
          tab.tabIndex = active ? 0 : -1;
        });
        panels.forEach(function (panel) {
          const active = panel.id === nextTab.getAttribute("aria-controls");
          panel.hidden = !active;
          if (active && !prefersReducedMotion()) {
            panel.classList.remove("is-swapping");
            void panel.offsetWidth;
            panel.classList.add("is-swapping");
          }
        });
        if (moveFocus) nextTab.focus();

        // On narrow screens, bring the answer into view.
        if (window.innerWidth < 1080) {
          const panel = document.getElementById(nextTab.getAttribute("aria-controls"));
          if (panel) {
            const rect = panel.getBoundingClientRect();
            if (rect.top > window.innerHeight * 0.75 || rect.top < 0) {
              panel.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
            }
          }
        }
      }

      tabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () { select(tab, false); });
        tab.addEventListener("keydown", function (event) {
          let next = null;
          if (event.key === "ArrowDown" || event.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
          if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
          if (event.key === "Home") next = tabs[0];
          if (event.key === "End") next = tabs[tabs.length - 1];
          if (next) {
            event.preventDefault();
            select(next, true);
          }
        });
      });
    });
  }

  /* ---------------------------------------------------------------
   * Portfolio cards: hover-scroll distance + filters
   * ------------------------------------------------------------- */

  function updateScrollDistances() {
    $$(".work-window").forEach(function (frame) {
      const img = $("img", frame);
      if (!img) return;
      const apply = function () {
        const visible = frame.clientHeight - 22;
        const rendered = img.getBoundingClientRect().height;
        const distance = Math.max(0, rendered - visible);
        frame.parentElement.style.setProperty("--scroll-distance", "-" + Math.round(distance) + "px");
        img.style.transitionDuration = Math.min(9, Math.max(1.5, distance / 450)) + "s";
      };
      if (img.complete) apply(); else img.addEventListener("load", apply, { once: true });
    });
  }

  function initFilters() {
    const chips = $$("[data-filter]");
    if (!chips.length) return;
    const cards = $$("[data-category]");
    const status = $("[data-filter-status]");

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        const filter = chip.dataset.filter;
        chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        let shown = 0;
        cards.forEach(function (card) {
          const match = filter === "all" || card.dataset.category === filter;
          card.hidden = !match;
          if (match) {
            shown += 1;
            if (!prefersReducedMotion()) {
              card.classList.remove("is-entering");
              void card.offsetWidth;
              card.classList.add("is-entering");
            }
          }
        });
        if (status) {
          status.textContent = filter === "all"
            ? "Showing all " + shown + " projects."
            : "Showing " + shown + " project" + (shown === 1 ? "" : "s") + " in " + chip.firstChild.textContent.trim() + ".";
        }
        updateScrollDistances();
      });
    });
  }

  /* ---------------------------------------------------------------
   * Page chrome: reveal on scroll, header shadow, mobile CTA
   * ------------------------------------------------------------- */

  function initReveal() {
    const elements = $$("[data-reveal]");
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      elements.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    document.documentElement.classList.add("motion-ready");
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    elements.forEach(function (el) {
      if (el.closest(".hero, .page-intro")) {
        window.setTimeout(function () { el.classList.add("is-visible"); }, 40);
      } else {
        observer.observe(el);
      }
    });
  }

  function initScrollChrome() {
    const header = $("[data-header]");
    const mobileCta = $("[data-mobile-cta]");
    const footer = $(".site-footer");
    let ticking = false;

    function update() {
      ticking = false;
      const y = window.scrollY;
      if (header) header.classList.toggle("is-scrolled", y > 12);
      if (mobileCta) {
        const nearFooter = footer ? footer.getBoundingClientRect().top < window.innerHeight - 40 : false;
        mobileCta.classList.toggle("is-visible", y > window.innerHeight * 0.6 && !nearFooter);
      }
    }

    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------------
   * Wire up
   * ------------------------------------------------------------- */

  $$("[data-open-consultation]").forEach(function (button) {
    button.addEventListener("click", openConsultationModal);
  });
  $$("[data-close-consultation]").forEach(function (button) {
    button.addEventListener("click", closeConsultationModal);
  });
  $$("[data-open-preview]").forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      openPortfolioPreviewModal(event.currentTarget);
    });
  });
  $$("[data-close-portfolio-preview]").forEach(function (button) {
    button.addEventListener("click", function () { closePortfolioPreviewModal(); });
  });
  if (consultationForm) consultationForm.addEventListener("submit", handleConsultationSubmit);
  window.addEventListener("keydown", handleKeyDown);

  initShowcase();
  initPicker();
  initFilters();
  initReveal();
  initScrollChrome();
  updateScrollDistances();

  let resizeTimer = 0;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(updateScrollDistances, 150);
  });
})();
