/* Crosshair and character hover adapted from Codrops / Manoela Ilic,
 * CrosshairDistortion (2021), MIT. See licenses/CrosshairDistortion-LICENSE.
 * Scoped to the final section; the existing gallery and Lenis remain independent.
 */
(() => {
  let initialized = false;
  window.WDCCClosing = { init() {
    if (initialized) return;
    initialized = true;
    const section = document.querySelector('.closing');
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (!section || !fine.matches || reduced.matches) return;

    const layer = document.createElement('div');
    layer.className = 'closing__cursor';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = `
      <svg class="closing__cursor-h" viewBox="0 0 200 20" preserveAspectRatio="none">
        <defs><filter id="closing-noise-x" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0" numOctaves="1" result="warp"/>
          <feOffset dx="-30" in="warp" result="offset"/>
          <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="30" in="SourceGraphic" in2="offset"/>
        </filter></defs>
        <line x1="0" y1="10" x2="200" y2="10" vector-effect="non-scaling-stroke"/>
      </svg>
      <svg class="closing__cursor-v" viewBox="0 0 20 200" preserveAspectRatio="none">
        <defs><filter id="closing-noise-y" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0" numOctaves="1" result="warp"/>
          <feOffset dy="-30" in="warp" result="offset"/>
          <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="30" in="SourceGraphic" in2="offset"/>
        </filter></defs>
        <line x1="10" y1="0" x2="10" y2="200" vector-effect="non-scaling-stroke"/>
      </svg>`;
    section.append(layer);
    const [horizontal, vertical] = layer.querySelectorAll('svg');
    const turbulence = [...layer.querySelectorAll('feTurbulence')];
    const dayChars = new SplitText(section.querySelector('.closing__day'), {
      type: 'chars', charsClass: 'closing__day-char', aria: 'none',
    }).chars;
    const states = [...section.querySelectorAll('.closing__row')].map(line => {
      const text = new SplitText(line.querySelector('.credits'), {
        type: 'chars', charsClass: 'closing__char', aria: 'auto',
      });
      const number = new SplitText(line.querySelector('.closing__number'), {
        type: 'chars', charsClass: 'closing__char', aria: 'none',
      });
      return { line, split: { chars: [...text.chars, ...number.chars, ...dayChars] } };
    });
    const noise = { value: 0 };
    const pointer = { x: 0, y: 0, known: false };
    let active = false, frame = 0, hovered = null, x = 0, y = 0;

    function clearNoise() {
      gsap.killTweensOf(noise);
      turbulence.forEach(el => el.setAttribute('baseFrequency', '0'));
      horizontal.style.filter = vertical.style.filter = 'none';
    }
    function distort() {
      clearNoise();
      horizontal.style.filter = 'url(#closing-noise-x)';
      vertical.style.filter = 'url(#closing-noise-y)';
      noise.value = 1;
      gsap.to(noise, {
        value: 0, duration: 0.5, ease: 'power1.out',
        onUpdate: () => turbulence.forEach(el => el.setAttribute('baseFrequency', noise.value)),
        onComplete: clearNoise,
      });
    }
    function restore(state, immediate = false) {
      if (!state) return;
      gsap.killTweensOf(state.split.chars);
      if (immediate) gsap.set(state.split.chars, { x: 0, y: 0, rotation: 0, color: '#f5f5ed' });
      else gsap.to(state.split.chars, { x: 0, y: 0, rotation: 0, color: '#f5f5ed', duration: .25, overwrite: true });
    }
    function hover(state) {
      if (state === hovered) return;
      restore(hovered);
      hovered = state;
      if (!state) { clearNoise(); return; }
      distort();
      const chars = state.split.chars;
      gsap.killTweensOf(chars);
      gsap.set(chars, { x: 0, y: 0, rotation: 0 });
      gsap.to(chars, {
        x: () => gsap.utils.random(-15, 15),
        y: () => gsap.utils.random(-20, 10),
        rotation: () => gsap.utils.random(-5, 5),
        color: () => Math.random() < .5 ? '#ed655b' : '#f5f5ed',
        duration: .05, repeat: 3, repeatRefresh: true, ease: 'power3.out',
        onComplete: () => {
          if (active && hovered === state) gsap.to(chars, {
            x: 0, y: 0, rotation: 0, color: '#ed655b', duration: .1, overwrite: true,
          });
        },
      });
    }
    function render() {
      if (!active) { frame = 0; return; }
      const rect = section.getBoundingClientRect();
      x += (pointer.x - rect.left - x) * .15;
      y += (pointer.y - rect.top - y) * .15;
      gsap.set(vertical, { x });
      gsap.set(horizontal, { y });
      frame = requestAnimationFrame(render);
    }
    function sync() {
      const rect = section.getBoundingClientRect();
      const inside = pointer.known && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= Math.max(0, rect.top) && pointer.y <= Math.min(innerHeight, rect.bottom);
      const next = !document.hidden && fine.matches && !reduced.matches && rect.top <= innerHeight * .15 && rect.bottom >= innerHeight * .85 && inside;
      if (next !== active) {
        active = next;
        gsap.killTweensOf(layer);
        if (active) {
          x = pointer.x - rect.left;
          y = pointer.y - rect.top;
          gsap.set(vertical, { x });
          gsap.set(horizontal, { y });
          gsap.to(layer, { opacity: 1, duration: .35 });
          if (!frame) frame = requestAnimationFrame(render);
        } else {
          cancelAnimationFrame(frame); frame = 0;
          gsap.set(layer, { opacity: 0 });
          clearNoise();
          states.forEach(state => restore(state, true));
          hovered = null;
        }
      }
      if (active) {
        const target = document.elementFromPoint(pointer.x, pointer.y);
        hover(states.find(state => state.line.contains(target)) || null);
      }
    }
    window.addEventListener('pointermove', event => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.known = true;
      sync();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { pointer.known = false; sync(); });
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('blur', () => { pointer.known = false; sync(); });
    window.addEventListener('resize', sync, { passive: true });
    fine.addEventListener('change', sync);
    reduced.addEventListener('change', sync);
    ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', onUpdate: sync, onRefresh: sync });
  } };
})();
