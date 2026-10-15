import { shuffleQuoteOrder } from '@/lib/quote-order';

interface ReelLink {
  element: HTMLButtonElement;
  title: string;
  description: string;
  url: string;
}

const rowPositions = [
  { tilt: 0, brightness: 1 },
  { tilt: 7, brightness: .86 },
  { tilt: 11, brightness: .69 },
  { tilt: 15, brightness: .54 },
  { tilt: 19, brightness: .46 },
  { tilt: 22, brightness: .46 }
];
const spinFastDuration = 300;
const spinTransitionDuration = 120;
const spinBrakeDuration = 700;
const spinReboundDuration = 600;
const spinBrakeSpeedRatio = .35;
const spinOvershoot = .28;
const spinReboundDecay = .34;
const spinApproachDuration = spinFastDuration + spinTransitionDuration + spinBrakeDuration;
const spinDuration = spinApproachDuration + spinReboundDuration;
const spinTransitionWeight = spinTransitionDuration * (1 + spinBrakeSpeedRatio) / 2;
const spinBrakeWeight = spinBrakeDuration * spinBrakeSpeedRatio / 2;
const spinTravelWeight = spinFastDuration + spinTransitionWeight + spinBrakeWeight;
const paddleSwing = 44;
const wheelPixelsPerBlade = 110;

function bindBookmarkArchive(): void {
  const root = document.querySelector<HTMLElement>('[data-favorites]:not([data-bound])');
  if (!root) return;
  const reel = root.querySelector<HTMLElement>('[data-favorites-reel]')!;
  const items: ReelLink[] = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-favorites-item]')).map((element) => ({
    element,
    title: element.dataset.title!,
    description: element.dataset.description!,
    url: element.dataset.url!
  }));
  if (!items.length) return;
  root.dataset.bound = '';
  const consoleElement = root;

  const title = root.querySelector<HTMLElement>('[data-favorites-selected]')!;
  const description = root.querySelector<HTMLElement>('[data-favorites-description]')!;
  const status = root.querySelector<HTMLElement>('[data-favorites-status]')!;
  const paddlePlates = Array.from(root.querySelectorAll<HTMLElement>('[data-favorites-arrow] .favorites-reel__paddle-plate'));
  const sparkContacts = paddlePlates.map((plate) => {
    const contact = document.createElement('span');
    contact.className = 'favorites-reel__spark-contact';
    contact.dataset.favoritesSparkContact = '';
    contact.setAttribute('aria-hidden', 'true');
    plate.append(contact);
    return contact;
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const bookmarkIndex = Number(new URLSearchParams(location.search).get('bookmark'));
  let selected = Number.isInteger(bookmarkIndex) && bookmarkIndex >= 0 && bookmarkIndex < items.length ? bookmarkIndex : 0;
  const allIndices = items.map((_, index) => index);
  let randomOrder = shuffleQuoteOrder(allIndices.filter((index) => index !== selected));
  let progress = selected;
  let targetProgress = selected;
  let motion: { kind: 'step' | 'spin'; from: number; to: number; start: number; duration: number; lastIndex: number; direction: number; spinSpeed: number; swing: number; startAngle: number; startWave: number } | undefined;
  let frame: number | undefined;
  let settleTimer: number | undefined;
  let wheelSettleTimer: number | undefined;
  let wheelActive = false;
  let wheelSettling = false;
  let paddleAngle = 0;
  let pointerY: number | undefined;
  let didDrag = false;
  let suppressClickUntil = 0;
  const sparkedSides = paddlePlates.map(() => false);
  const lastSparkAt = paddlePlates.map(() => -Infinity);

  const wrap = (index: number) => (index % items.length + items.length) % items.length;

  function renderPosition(): void {
    // At the measured 850×366 / 224×167 wells, the v5 faces are 84 / 39px tall.
    // The pitches leave narrow seams between the visible blade faces.
    const bladeHeight = items[0].element.offsetHeight;
    const pitch = bladeHeight * (matchMedia('(max-width: 1199px)').matches ? 1 : .88);
    reel.style.setProperty('--blade-pitch', `${pitch}px`);
    reel.dataset.progress = progress.toFixed(4);
    items.forEach(({ element }, index) => {
      let offset = ((index - progress) % items.length + items.length) % items.length;
      if (offset > items.length / 2) offset -= items.length;
      const distance = Math.abs(offset);
      const lower = Math.min(Math.floor(distance), rowPositions.length - 1);
      const upper = Math.min(lower + 1, rowPositions.length - 1);
      const fraction = distance - Math.floor(distance);
      const tilt = rowPositions[lower].tilt + (rowPositions[upper].tilt - rowPositions[lower].tilt) * fraction;
      const brightness = rowPositions[lower].brightness + (rowPositions[upper].brightness - rowPositions[lower].brightness) * fraction;
      const visible = distance <= 5;
      element.style.setProperty('--row-y', `${offset * pitch}px`);
      element.style.setProperty('--row-angle', `${-Math.sign(offset) * tilt}deg`);
      element.style.setProperty('--row-brightness', String(brightness));
      element.style.visibility = visible ? 'visible' : 'hidden';
      element.style.zIndex = String(100 - Math.round(distance * 10) + Number(offset < 0));
      element.dataset.selected = String(index === selected);
      element.setAttribute('aria-pressed', String(index === selected));
      element.setAttribute('aria-label', `${index === selected && distance < .001 && !motion && !wheelActive ? '访问' : '选择'} ${items[index].title}`);
      element.setAttribute('aria-hidden', String(!visible));
      element.tabIndex = index === selected ? 0 : -1;
    });

  }

  function showSelection(announce = true): void {
    const current = items[selected];
    title.textContent = current.title;
    description.textContent = current.description;
    if (announce) status.textContent = `已选中：${current.title}`;
    renderPosition();
  }

  function setPaddles(angle: number): void {
    paddleAngle = angle;
    paddlePlates.forEach((plate, index) => {
      plate.style.transform = `rotate(${angle.toFixed(3)}deg)`;
      sparkContacts[index].style.transform = `rotate(${(-angle).toFixed(3)}deg)`;
    });
  }

  function clearSparks(): void {
    sparkContacts.forEach((contact, index) => {
      contact.replaceChildren();
      sparkedSides[index] = false;
      lastSparkAt[index] = -Infinity;
    });
  }

  function sparkNoise(seed: number): number {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  }

  function emitSpark(side: number, crossing: number, speedRatio: number): void {
    const contact = sparkContacts[side];
    if (contact.childElementCount >= 5) return;
    const extra = sparkNoise(crossing * 7 + side * 29) > .68 ? 1 : 0;
    const count = Math.min(5 - contact.childElementCount, 1 + extra + Number(sparkNoise(crossing * 11 + side * 47) > .95));
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement('span');
      particle.className = 'favorites-reel__spark';
      particle.dataset.favoritesSpark = '';
      particle.style.setProperty('--spark-size', `${(index === 0 ? 2.8 : 1.4) + sparkNoise(crossing + side * 17 + index * 31) * 1.4}px`);
      particle.style.setProperty('--spark-x', `${(sparkNoise(crossing * 3 + side * 23 + index * 19) - .5) * 8}px`);
      particle.style.setProperty('--spark-fall', `${(index === 0 ? 4 : 8) + sparkNoise(crossing * 5 + side * 13 + index * 37) * 7}px`);
      particle.style.setProperty('--spark-duration', `${120 + Math.round(sparkNoise(crossing * 2 + side * 41 + index * 53) * 100)}ms`);
      particle.style.setProperty('--spark-strength', String((.25 + .75 * speedRatio) * (index === 0 ? 1 : .75)));
      particle.addEventListener('animationend', () => particle.remove(), { once: true });
      contact.append(particle);
    }
  }

  function sparkAtCrossing(before: number, after: number, speed: number, fastSpeed: number, now: number): void {
    if (reduced.matches || Math.floor(before) === Math.floor(after)) return;
    const speedRatio = Math.min(1, Math.abs(speed / fastSpeed));
    if (speedRatio < .08) return;
    const crossing = Math.floor(after);
    sparkContacts.forEach((_, side) => {
      if (now - lastSparkAt[side] < 65 + side * 13) return;
      if (sparkedSides[side] && sparkNoise(crossing * 3 + side * 71) >= .32 * speedRatio) return;
      emitSpark(side, crossing, speedRatio);
      sparkedSides[side] = true;
      lastSparkAt[side] = now;
    });
  }

  function setReelBlur(speed: number, fastSpeed: number): void {
    const blur = 5 * (Math.abs(speed / fastSpeed) ** 1.4);
    reel.style.setProperty('--reel-blur', `${blur.toFixed(2)}px`);
  }

  function cancelSpin(resetPaddles = false): void {
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (settleTimer !== undefined) window.clearTimeout(settleTimer);
    if (wheelSettleTimer !== undefined) window.clearTimeout(wheelSettleTimer);
    frame = undefined;
    motion = undefined;
    settleTimer = undefined;
    wheelSettleTimer = undefined;
    wheelActive = false;
    wheelSettling = false;
    if (resetPaddles) setPaddles(0);
    reel.removeAttribute('aria-busy');
    reel.style.removeProperty('--reel-blur');
    clearSparks();
    consoleElement.removeAttribute('data-spinning');
    consoleElement.removeAttribute('data-settling');
  }

  function settle(): void {
    consoleElement.dataset.settling = '';
    settleTimer = window.setTimeout(() => {
      consoleElement.removeAttribute('data-settling');
      settleTimer = undefined;
    }, 420);
  }

  function select(index: number, announce = true): void {
    selected = wrap(index);
    showSelection(announce);
  }

  function animateTo(to: number, kind: 'step' | 'spin', duration: number, swing = paddleSwing): void {
    targetProgress = to;
    const direction = Math.sign(to - progress);
    const spinSpeed = kind === 'spin' ? (to + direction * spinOvershoot - progress) / spinTravelWeight : 0;
    motion = { kind, from: progress, to, start: performance.now(), duration, lastIndex: Math.round(progress), direction,
      spinSpeed, swing,
      startAngle: paddleAngle, startWave: -direction * swing * Math.abs(Math.sin(Math.PI * progress)) };
    if (kind === 'spin') setReelBlur(spinSpeed, spinSpeed);
    const tick = (now: number) => {
      if (!motion) return;
      const current = motion;
      const previousProgress = progress;
      const elapsedMs = Math.min(current.duration, now - current.start);
      const elapsed = elapsedMs / current.duration;
      if (kind === 'spin') {
        let speed = current.spinSpeed;
        if (elapsedMs < spinFastDuration) {
          progress = current.from + speed * elapsedMs;
        } else if (elapsedMs < spinFastDuration + spinTransitionDuration) {
          const transition = (elapsedMs - spinFastDuration) / spinTransitionDuration;
          const drop = 1 - spinBrakeSpeedRatio;
          const distance = spinTransitionDuration * (transition - drop * (transition ** 3 - transition ** 4 / 2));
          progress = current.from + speed * (spinFastDuration + distance);
          speed *= 1 - drop * (3 * transition ** 2 - 2 * transition ** 3);
        } else if (elapsedMs < spinApproachDuration) {
          // Integrated smoothstep keeps speed and acceleration continuous into the turnaround.
          const brake = (elapsedMs - spinFastDuration - spinTransitionDuration) / spinBrakeDuration;
          const distance = spinBrakeDuration * spinBrakeSpeedRatio * (brake - brake ** 3 + brake ** 4 / 2);
          progress = current.from + speed * (spinFastDuration + spinTransitionWeight + distance);
          speed *= spinBrakeSpeedRatio * (1 - 3 * brake ** 2 + 2 * brake ** 3);
        } else {
          const rebound = (elapsedMs - spinApproachDuration) / spinReboundDuration;
          const settled = rebound ** 3 * (10 - 15 * rebound + 6 * rebound ** 2);
          const remaining = 1 - settled;
          const envelope = remaining ** spinReboundDecay;
          const phase = 4 * Math.PI * rebound;
          progress = current.to + current.direction * spinOvershoot * envelope * Math.cos(phase);
          if (rebound < 1) {
            const remainingSpeed = -30 * rebound ** 2 * (1 - rebound) ** 2;
            const envelopeSpeed = spinReboundDecay * remaining ** (spinReboundDecay - 1) * remainingSpeed;
            speed = current.direction * spinOvershoot * (envelopeSpeed * Math.cos(phase) - envelope * 4 * Math.PI * Math.sin(phase)) / spinReboundDuration;
          } else speed = 0;
        }
        setReelBlur(speed, current.spinSpeed);
        sparkAtCrossing(previousProgress, progress, speed, current.spinSpeed, now);
      } else {
        progress = current.from + (current.to - current.from) * (1 - (1 - elapsed) ** 3);
      }
      let wave = -current.direction * current.swing * Math.abs(Math.sin(Math.PI * progress));
      if (kind === 'spin' && elapsedMs >= spinApproachDuration) {
        const overshot = current.to + current.direction * spinOvershoot;
        const overshootWave = -current.direction * current.swing * Math.abs(Math.sin(Math.PI * overshot));
        // The paddles use the same damped displacement as the reel, without a separate clock.
        wave = overshootWave * (progress - current.to) / (overshot - current.to);
      }
      setPaddles(wave + (current.startAngle - current.startWave) * (1 - elapsed) ** 3);
      if (kind === 'spin') {
        const nearest = Math.round(progress);
        if (nearest !== current.lastIndex) {
          current.lastIndex = nearest;
          select(nearest, false);
        }
      }
      renderPosition();
      if (elapsed < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        progress = current.to;
        cancelSpin(true);
        select(Math.round(progress));
        settle();
      }
    };
    frame = requestAnimationFrame(tick);
  }

  function step(direction: number, swing = paddleSwing): void {
    const base = motion?.kind === 'spin' || wheelActive ? Math.round(progress) : Math.round(targetProgress);
    cancelSpin();
    select(base + direction);
    if (reduced.matches) {
      progress = base + direction;
      targetProgress = progress;
      setPaddles(0);
      renderPosition();
      return;
    }
    animateTo(base + direction, 'step', 320, swing);
  }

  function spin(): void {
    cancelSpin();
    const base = Math.round(progress);
    const currentInOrder = randomOrder.indexOf(selected);
    if (currentInOrder >= 0) randomOrder.splice(currentInOrder, 1);
    if (randomOrder.length === 0) randomOrder = shuffleQuoteOrder(allIndices, selected);
    const targetIndex = randomOrder.shift() ?? selected;
    const advance = (wrap(base) - targetIndex + items.length) % items.length;
    const destination = base - items.length * 2 - advance;
    if (reduced.matches) {
      progress = destination;
      targetProgress = destination;
      setPaddles(0);
      select(destination);
      return;
    }
    consoleElement.dataset.spinning = '';
    reel.setAttribute('aria-busy', 'true');
    status.textContent = '正在随机转动…';
    animateTo(destination, 'spin', spinDuration);
  }

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-favorites-random]')) spin();
    else if (target.closest('[data-favorites-previous]')) step(-1);
    else if (target.closest('[data-favorites-next]')) step(1);
    else {
      const item = target.closest<HTMLButtonElement>('[data-favorites-item]');
      if (item && performance.now() >= suppressClickUntil) {
        if (item.dataset.selected === 'true' && !motion && !wheelActive && Math.abs(progress - Math.round(progress)) < .001) {
          if (event.isTrusted) window.open(items[selected].url, '_blank', 'noopener,noreferrer');
          return;
        }
        let offset = Number(item.dataset.index) - wrap(Math.round(progress));
        if (offset > items.length / 2) offset -= items.length;
        if (offset < -items.length / 2) offset += items.length;
        const destination = Math.round(progress) + offset;
        cancelSpin();
        select(destination);
        if (reduced.matches) {
          progress = destination;
          targetProgress = destination;
          setPaddles(0);
          renderPosition();
        } else {
          animateTo(destination, 'step', 320);
        }
        reel.focus({ preventScroll: true });
      }
    }
  }, { signal: abort.signal });

  reel.addEventListener('wheel', (event) => {
    if (!event.deltaY) return;
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? reel.clientHeight : 1);
    if (!wheelActive && wheelSettleTimer === undefined) {
      cancelSpin();
      targetProgress = progress;
    }
    targetProgress += pixels / wheelPixelsPerBlade;
    if (reduced.matches) {
      progress = Math.round(targetProgress);
      setPaddles(0);
      select(progress);
      if (wheelSettleTimer !== undefined) window.clearTimeout(wheelSettleTimer);
      wheelSettleTimer = window.setTimeout(() => {
        wheelSettleTimer = undefined;
        targetProgress = progress;
      }, 130);
      return;
    }
    wheelActive = true;
    wheelSettling = false;
    reel.setAttribute('aria-busy', 'true');
    if (wheelSettleTimer !== undefined) window.clearTimeout(wheelSettleTimer);
    wheelSettleTimer = window.setTimeout(() => {
      wheelSettleTimer = undefined;
      targetProgress = Math.round(targetProgress);
      wheelSettling = true;
    }, 130);
    if (frame !== undefined) return;
    let lastFrame = performance.now();
    const tick = (now: number) => {
      if (!wheelActive) return;
      const previous = progress;
      const elapsed = Math.min(50, now - lastFrame);
      lastFrame = now;
      progress += (targetProgress - progress) * (1 - Math.exp(-elapsed / 55));
      if (wheelSettling && Math.abs(targetProgress - progress) < .001) {
        progress = targetProgress;
        cancelSpin(true);
        select(Math.round(progress));
        settle();
        return;
      }
      const direction = Math.sign(progress - previous);
      setPaddles(-direction * paddleSwing * .6 * Math.abs(Math.sin(Math.PI * progress)));
      const nearest = Math.round(progress);
      if (nearest !== selected) select(nearest, false);
      renderPosition();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }, { passive: false, signal: abort.signal });

  reel.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('[data-favorites-arrow]')) return;
    if (motion || wheelActive) {
      cancelSpin();
      select(Math.round(progress));
    }
    pointerY = event.clientY;
    didDrag = false;
    const item = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-favorites-item]') : null;
    (item ?? reel).setPointerCapture(event.pointerId);
  }, { signal: abort.signal });
  reel.addEventListener('pointermove', (event) => {
    if (pointerY === undefined) return;
    const delta = pointerY - event.clientY;
    if (Math.abs(delta) < (matchMedia('(max-width: 1199px)').matches ? 30 : 42)) return;
    didDrag = true;
    reel.focus({ preventScroll: true });
    step(Math.sign(delta));
    pointerY = event.clientY;
  }, { signal: abort.signal });
  const release = () => {
    if (didDrag) suppressClickUntil = performance.now() + 240;
    else if (!motion && !reduced.matches && Math.abs(progress - Math.round(progress)) > .001) {
      animateTo(Math.round(progress), 'step', 180);
    }
    pointerY = undefined;
  };
  reel.addEventListener('pointerup', release, { signal: abort.signal });
  reel.addEventListener('pointercancel', release, { signal: abort.signal });
  reel.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    step(event.key === 'ArrowDown' ? 1 : -1);
    reel.focus({ preventScroll: true });
  }, { signal: abort.signal });
  root.querySelector<HTMLElement>('.favorites-reel__selectors')?.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    step(event.key === 'ArrowDown' ? 1 : -1);
  }, { signal: abort.signal });
  reduced.addEventListener('change', () => {
    if (reduced.matches && (motion || wheelActive)) {
      const destination = wheelActive ? Math.round(targetProgress) : motion!.to;
      cancelSpin();
      progress = destination;
      targetProgress = destination;
      select(destination);
    }
    if (reduced.matches) setPaddles(0);
  }, { signal: abort.signal });
  const resizeObserver = new ResizeObserver(renderPosition);
  resizeObserver.observe(reel);
  document.addEventListener('astro:before-swap', () => {
    cancelSpin(true);
    resizeObserver.disconnect();
    abort.abort();
  }, { once: true, signal: abort.signal });
  window.addEventListener('pagehide', () => cancelSpin(true), { signal: abort.signal });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || (!motion && !wheelActive)) return;
    cancelSpin(true);
    targetProgress = Math.round(progress);
    progress = targetProgress;
    select(targetProgress);
  }, { signal: abort.signal });

  setPaddles(0);
  showSelection();
}

document.addEventListener('astro:page-load', bindBookmarkArchive);
bindBookmarkArchive();
