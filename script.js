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
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

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

  function updateQuality() {
    state.reducedMotion = reducedMotionQuery.matches;
    state.coarsePointer = coarsePointerQuery.matches || window.innerWidth < 900;
    state.spacing = state.coarsePointer ? 54 : 44;
    state.baseRadius = state.coarsePointer ? 1.12 : 1.28;
    state.activeRadius = state.coarsePointer ? 1.95 : 2.8;
    state.influenceRadius = state.reducedMotion ? 0 : state.coarsePointer ? 92 : 170;
    state.particleCount = state.reducedMotion ? 0 : state.coarsePointer ? 8 : 18;
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
    if (state.reducedMotion) {
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

    if (consultationStatus) {
      consultationStatus.textContent = defaultConsultationStatus;
      consultationStatus.classList.remove("is-success");
    }

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

  function handleConsultationSubmit(event) {
    event.preventDefault();

    if (!consultationStatus) {
      return;
    }

    consultationStatus.textContent =
      "Consultation request captured in the frontend. The upload and email workflow will be connected when your Google Apps Script endpoint is added.";
    consultationStatus.classList.add("is-success");
  }

  function handleResize() {
    updateCanvasSize();

    if (state.reducedMotion) {
      renderFrame(window.performance.now());
      resetParallax();
    }
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
