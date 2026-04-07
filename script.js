(function () {
  const canvas = document.getElementById("dotGrid");

  if (!canvas) {
    return;
  }

  const ctx =
    canvas.getContext("2d", { alpha: true, desynchronized: true }) ||
    canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  const revealElements = Array.from(document.querySelectorAll("[data-reveal]"));
  const parallaxElements = Array.from(document.querySelectorAll("[data-parallax-depth]"));
  const rotatingItems = Array.from(document.querySelectorAll("[data-rotate-item]"));
  const openConsultationButtons = Array.from(document.querySelectorAll("[data-open-consultation]"));
  const consultationModal = document.getElementById("consultationModal");
  const closeConsultationButtons = Array.from(document.querySelectorAll("[data-close-consultation]"));
  const consultationForm = document.getElementById("consultationForm");
  const consultationStatus = document.getElementById("consultationStatus");
  const consultationSubmitButton = consultationForm
    ? consultationForm.querySelector('button[type="submit"]')
    : null;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
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

  const state = {
    width: 0,
    height: 0,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    spacing: 44,
    baseRadius: 1.28,
    activeRadius: 2.8,
    influenceRadius: 170,
    particleCount: 18,
    frameInterval: 1000 / 36,
    reducedMotion: reducedMotionQuery.matches,
    coarsePointer: coarsePointerQuery.matches || window.innerWidth < 900,
    mobileStaticBackground: false,
    parallaxEnabled: false,
    points: [],
    particles: [],
    pointer: {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      active: false
    },
    rafId: 0,
    lastFrameTime: 0,
    rotationTimerId: 0,
    activeHighlightIndex: 0
  };
  const defaultConsultationStatus = consultationStatus ? consultationStatus.textContent : "";
  const defaultConsultationSubmitLabel = consultationSubmitButton ? consultationSubmitButton.textContent : "";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  function smoothstep(value) {
    return value * value * (3 - 2 * value);
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

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
    const whatsapp = String(formData.get("whatsapp") || "").trim();
    const company = String(formData.get("company") || "").trim();
    const projectDescription = String(formData.get("project_description") || "").trim();
    const referenceLinks = String(formData.get("reference_links") || "").trim();
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

    return {
      source: window.location.hostname || "sumoaisolutions.com",
      pageUrl: window.location.href,
      firstName: firstName,
      lastName: lastName,
      fullName: (firstName + " " + lastName).trim(),
      email: email,
      phone: phone,
      whatsapp: whatsapp,
      company: company,
      message: projectDescription,
      projectDescription: projectDescription,
      referenceLinks: referenceLinks,
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

  function updateQuality() {
    state.reducedMotion = reducedMotionQuery.matches;
    state.coarsePointer = coarsePointerQuery.matches || window.innerWidth < 900;
    state.mobileStaticBackground = state.coarsePointer;
    state.spacing = state.coarsePointer ? 54 : 44;
    state.baseRadius = state.coarsePointer ? 1.12 : 1.28;
    state.activeRadius = state.coarsePointer ? 1.95 : 2.8;
    state.influenceRadius = state.reducedMotion ? 0 : state.coarsePointer ? 92 : 170;
    state.particleCount = state.reducedMotion ? 0 : state.coarsePointer ? 0 : 18;
    state.frameInterval = state.coarsePointer ? 1000 / 24 : 1000 / 36;
    state.parallaxEnabled = !state.reducedMotion && !state.coarsePointer;
  }

  function buildGrid() {
    state.points = [];

    const cols = Math.ceil(state.width / state.spacing) + 1;
    const rows = Math.ceil(state.height / state.spacing) + 1;
    const offsetX = (state.width - (cols - 1) * state.spacing) / 2;
    const offsetY = (state.height - (rows - 1) * state.spacing) / 2;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        state.points.push({
          x: offsetX + col * state.spacing,
          y: offsetY + row * state.spacing,
          phase: row * 0.31 + col * 0.23
        });
      }
    }
  }

  function createParticle() {
    return {
      x: randomBetween(0, state.width),
      y: randomBetween(0, state.height),
      vx: randomBetween(-0.08, 0.08),
      vy: randomBetween(-0.06, 0.06),
      size: randomBetween(1.1, 2),
      alpha: randomBetween(0.18, 0.42),
      phase: randomBetween(0, Math.PI * 2)
    };
  }

  function buildParticles() {
    state.particles = [];

    for (let index = 0; index < state.particleCount; index += 1) {
      state.particles.push(createParticle());
    }
  }

  function updateCanvasSize() {
    updateQuality();

    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = state.width + "px";
    canvas.style.height = state.height + "px";

    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    buildGrid();
    buildParticles();

    if (state.pointer.x === 0 && state.pointer.y === 0) {
      state.pointer.x = state.width * 0.64;
      state.pointer.y = state.height * 0.32;
      state.pointer.targetX = state.pointer.x;
      state.pointer.targetY = state.pointer.y;
    } else {
      state.pointer.x = clamp(state.pointer.x, 0, state.width);
      state.pointer.y = clamp(state.pointer.y, 0, state.height);
      state.pointer.targetX = clamp(state.pointer.targetX, 0, state.width);
      state.pointer.targetY = clamp(state.pointer.targetY, 0, state.height);
    }
  }

  function getIdleTarget(time) {
    return {
      x: state.width * 0.66 + Math.sin(time * 0.00018) * state.width * (state.coarsePointer ? 0.04 : 0.08),
      y: state.height * 0.32 + Math.cos(time * 0.00022) * state.height * (state.coarsePointer ? 0.035 : 0.06)
    };
  }

  function setPointer(x, y) {
    if (state.reducedMotion || state.coarsePointer) {
      return;
    }

    state.pointer.targetX = x;
    state.pointer.targetY = y;
    state.pointer.active = true;
  }

  function clearPointer() {
    state.pointer.active = false;
  }

  function updatePointer(time) {
    if (state.reducedMotion) {
      state.pointer.x = state.width * 0.62;
      state.pointer.y = state.height * 0.34;
      state.pointer.targetX = state.pointer.x;
      state.pointer.targetY = state.pointer.y;
      return;
    }

    if (!state.pointer.active) {
      const idleTarget = getIdleTarget(time);

      state.pointer.targetX = idleTarget.x;
      state.pointer.targetY = idleTarget.y;
    }

    state.pointer.x = lerp(state.pointer.x, state.pointer.targetX, state.coarsePointer ? 0.04 : 0.09);
    state.pointer.y = lerp(state.pointer.y, state.pointer.targetY, state.coarsePointer ? 0.04 : 0.09);
  }

  function drawAmbientGlow(time) {
    const pointerRadius = state.coarsePointer ? 170 : 240;
    const pointerGradient = ctx.createRadialGradient(
      state.pointer.x,
      state.pointer.y,
      0,
      state.pointer.x,
      state.pointer.y,
      pointerRadius
    );

    pointerGradient.addColorStop(0, "rgba(206, 244, 255, 0.15)");
    pointerGradient.addColorStop(0.34, "rgba(140, 198, 255, 0.1)");
    pointerGradient.addColorStop(1, "rgba(11, 16, 32, 0)");

    ctx.fillStyle = pointerGradient;
    ctx.fillRect(0, 0, state.width, state.height);

    const ambientX = state.width * 0.82 + Math.sin(time * 0.00012) * state.width * 0.03;
    const ambientY = state.height * 0.2 + Math.cos(time * 0.00015) * state.height * 0.04;
    const ambientGradient = ctx.createRadialGradient(
      ambientX,
      ambientY,
      0,
      ambientX,
      ambientY,
      state.width * 0.32
    );

    ambientGradient.addColorStop(0, "rgba(120, 228, 255, 0.11)");
    ambientGradient.addColorStop(1, "rgba(11, 16, 32, 0)");

    ctx.fillStyle = ambientGradient;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function updateAndDrawParticles(time) {
    if (!state.particles.length) {
      return;
    }

    const influenceRadius = state.coarsePointer ? 0 : 140;

    for (let index = 0; index < state.particles.length; index += 1) {
      const particle = state.particles[index];
      const swayX = Math.cos(time * 0.00024 + particle.phase) * 0.018;
      const swayY = Math.sin(time * 0.00026 + particle.phase) * 0.018;

      particle.x += particle.vx + swayX;
      particle.y += particle.vy + swayY;

      if (influenceRadius > 0) {
        const dx = state.pointer.x - particle.x;
        const dy = state.pointer.y - particle.y;
        const distance = Math.hypot(dx, dy);

        if (distance < influenceRadius && distance > 0) {
          const pull = (1 - distance / influenceRadius) * 0.012;

          particle.x += dx * pull;
          particle.y += dy * pull;
        }
      }

      if (particle.x < -18) {
        particle.x = state.width + 18;
      } else if (particle.x > state.width + 18) {
        particle.x = -18;
      }

      if (particle.y < -18) {
        particle.y = state.height + 18;
      } else if (particle.y > state.height + 18) {
        particle.y = -18;
      }

      const dx = particle.x - state.pointer.x;
      const dy = particle.y - state.pointer.y;
      const distance = Math.hypot(dx, dy);
      const influence = influenceRadius
        ? smoothstep(clamp(1 - distance / influenceRadius, 0, 1))
        : 0;

      if (influence > 0.2) {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size + influence * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(145, 226, 255, " + (0.05 + influence * 0.12) + ")";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(211, 238, 255, " + (particle.alpha + influence * 0.18) + ")";
      ctx.fill();
    }
  }

  function drawGrid(time) {
    const timeWave = time * 0.0005;

    for (let index = 0; index < state.points.length; index += 1) {
      const point = state.points[index];
      const dx = point.x - state.pointer.x;
      const dy = point.y - state.pointer.y;
      const distance = Math.hypot(dx, dy);
      const influence = state.influenceRadius
        ? smoothstep(clamp(1 - distance / state.influenceRadius, 0, 1))
        : 0;
      const safeDistance = distance || 1;
      const ambient = 0.03 + Math.sin(point.phase + timeWave) * 0.02;
      const warp = influence * (state.coarsePointer ? 1.6 : 3.8);
      const drawX = point.x - (dx / safeDistance) * warp;
      const drawY = point.y - (dy / safeDistance) * warp;
      const radius = state.baseRadius + (state.activeRadius - state.baseRadius) * influence;
      const alpha = clamp(0.12 + ambient + influence * 0.54, 0.1, 0.86);

      if (influence > 0.28) {
        ctx.beginPath();
        ctx.arc(drawX, drawY, radius + influence * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(150, 226, 255, " + (0.05 + influence * 0.14) + ")";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(210, 226, 250, " + alpha + ")";
      ctx.fill();
    }
  }

  function renderScene(time) {
    ctx.clearRect(0, 0, state.width, state.height);
    drawAmbientGlow(time);
    updateAndDrawParticles(time);
    drawGrid(time);
  }

  function resetParallax() {
    for (let index = 0; index < parallaxElements.length; index += 1) {
      parallaxElements[index].style.transform = "";
    }
  }

  function applyParallax() {
    if (!state.parallaxEnabled || window.scrollY > state.height * 0.85) {
      resetParallax();
      return;
    }

    const pointerX = state.width ? state.pointer.x / state.width - 0.5 : 0;
    const pointerY = state.height ? state.pointer.y / state.height - 0.5 : 0;
    const scrollFactor = clamp(window.scrollY / Math.max(state.height, 1), 0, 1);

    for (let index = 0; index < parallaxElements.length; index += 1) {
      const element = parallaxElements[index];
      const depth = Number(element.dataset.parallaxDepth || 0);
      const translateX = -pointerX * depth * 1.8;
      const translateY = -pointerY * depth * 1.5 - scrollFactor * depth * 0.18;

      element.style.transform =
        "translate3d(" + translateX.toFixed(2) + "px, " + translateY.toFixed(2) + "px, 0)";
    }
  }

  function renderFrame(time) {
    updatePointer(time);
    renderScene(time);
    applyParallax();
  }

  function stopAnimation() {
    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  function animate(time) {
    if (document.hidden) {
      state.rafId = window.requestAnimationFrame(animate);
      return;
    }

    if (time - state.lastFrameTime < state.frameInterval) {
      state.rafId = window.requestAnimationFrame(animate);
      return;
    }

    state.lastFrameTime = time;
    renderFrame(time);
    state.rafId = window.requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (state.reducedMotion || state.mobileStaticBackground) {
      stopAnimation();
      renderFrame(window.performance.now());
      resetParallax();
      return;
    }

    if (state.rafId) {
      return;
    }

    state.lastFrameTime = 0;
    state.rafId = window.requestAnimationFrame(animate);
  }

  function initRevealObserver() {
    if (state.reducedMotion || !("IntersectionObserver" in window)) {
      for (let index = 0; index < revealElements.length; index += 1) {
        revealElements[index].classList.add("is-visible");
      }

      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        for (let index = 0; index < entries.length; index += 1) {
          const entry = entries[index];

          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -12% 0px"
      }
    );

    for (let index = 0; index < revealElements.length; index += 1) {
      const element = revealElements[index];

      if (element.closest(".hero")) {
        window.setTimeout(function () {
          element.classList.add("is-visible");
        }, 40);
      } else {
        observer.observe(element);
      }
    }
  }

  function initHighlightRotation() {
    if (!rotatingItems.length) {
      return;
    }

    rotatingItems[0].classList.add("is-active");

    if (state.reducedMotion) {
      return;
    }

    state.rotationTimerId = window.setInterval(function () {
      rotatingItems[state.activeHighlightIndex].classList.remove("is-active");
      state.activeHighlightIndex = (state.activeHighlightIndex + 1) % rotatingItems.length;
      rotatingItems[state.activeHighlightIndex].classList.add("is-active");
    }, 3200);
  }

  function resetHighlightRotation() {
    if (state.rotationTimerId) {
      window.clearInterval(state.rotationTimerId);
      state.rotationTimerId = 0;
    }

    for (let index = 0; index < rotatingItems.length; index += 1) {
      rotatingItems[index].classList.remove("is-active");
    }

    state.activeHighlightIndex = 0;
    initHighlightRotation();
  }

  function openConsultationModal() {
    if (!consultationModal) {
      return;
    }

    consultationModal.hidden = false;
    document.body.classList.add("is-modal-open");

    setConsultationStatus(defaultConsultationStatus, "");
    setConsultationSubmitting(false);

    const firstInput = consultationModal.querySelector("input, textarea");

    if (firstInput) {
      window.setTimeout(function () {
        firstInput.focus();
      }, 40);
    }
  }

  function closeConsultationModal() {
    if (!consultationModal) {
      return;
    }

    consultationModal.hidden = true;
    document.body.classList.remove("is-modal-open");
  }

  async function handleConsultationSubmit(event) {
    event.preventDefault();

    if (!consultationForm) {
      return;
    }

    try {
      setConsultationSubmitting(true);
      setConsultationStatus("Uploading your details and preparing attachments...", "pending");

      const payload = await buildConsultationPayload();
      const response = await submitConsultationPayload(payload);

      consultationForm.reset();
      setConsultationStatus(
        (response && response.message) ||
          "Consultation request sent. We received your details and attachments.",
        "success"
      );
    } catch (error) {
      setConsultationStatus(
        (error && error.message) || "The consultation request could not be sent.",
        "error"
      );
    } finally {
      setConsultationSubmitting(false);
    }
  }

  function handleResize() {
    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;

    if (
      state.coarsePointer &&
      Math.abs(nextWidth - state.width) < 4 &&
      Math.abs(nextHeight - state.height) < 120
    ) {
      return;
    }

    updateCanvasSize();

    if (state.reducedMotion) {
      renderFrame(window.performance.now());
      resetParallax();
      return;
    }

    if (state.mobileStaticBackground) {
      renderFrame(window.performance.now());
      resetParallax();
      return;
    }

    startAnimation();
  }

  function handlePointerMove(event) {
    setPointer(event.clientX, event.clientY);
  }

  function handlePointerDown(event) {
    setPointer(event.clientX, event.clientY);
  }

  function handleMotionPreferenceChange() {
    updateCanvasSize();
    resetHighlightRotation();

    if (state.reducedMotion) {
      for (let index = 0; index < revealElements.length; index += 1) {
        revealElements[index].classList.add("is-visible");
      }
    }

    startAnimation();
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stopAnimation();
      return;
    }

    startAnimation();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape" && consultationModal && !consultationModal.hidden) {
      closeConsultationModal();
    }
  }

  function addMediaChangeListener(query, handler) {
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handler);
    } else if (typeof query.addListener === "function") {
      query.addListener(handler);
    }
  }

  updateCanvasSize();
  initRevealObserver();
  initHighlightRotation();
  startAnimation();

  for (let index = 0; index < openConsultationButtons.length; index += 1) {
    openConsultationButtons[index].addEventListener("click", openConsultationModal);
  }

  for (let index = 0; index < closeConsultationButtons.length; index += 1) {
    closeConsultationButtons[index].addEventListener("click", closeConsultationModal);
  }

  if (consultationForm) {
    consultationForm.addEventListener("submit", handleConsultationSubmit);
  }

  window.addEventListener("resize", handleResize);
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  window.addEventListener("pointerleave", clearPointer);
  window.addEventListener("blur", clearPointer);
  window.addEventListener("keydown", handleKeyDown);
  document.addEventListener("mouseleave", clearPointer);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  addMediaChangeListener(reducedMotionQuery, handleMotionPreferenceChange);
  addMediaChangeListener(coarsePointerQuery, handleMotionPreferenceChange);
})();
