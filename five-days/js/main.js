const data = window.WDCC;
const story = document.querySelector('#story-grid');
const overview = document.querySelector('#overview-grid');

function createFigure(item, full = false) {
  const figure = document.createElement('figure');
  figure.className = 'grid__item';
  figure.dataset.order = item.order;
  const image = document.createElement('div');
  image.className = 'grid__item-img';
  image.style.backgroundImage = `url("${item.src}")`;
  image.setAttribute('role', 'img');
  image.setAttribute('aria-label', item.alt);
  if (full) {
    figure.append(image);
  } else {
    const wrap = document.createElement('div');
    wrap.className = 'grid__item-imgwrap';
    wrap.append(image);
    figure.append(wrap);
  }
  return figure;
}

data.images.forEach(item => {
  story.append(createFigure(item));
  overview.append(createFigure(item, true));
});

data.keywords.flat().forEach(word => {
  const span = document.createElement('span');
  span.textContent = word;
  document.querySelector('#keywords').append(span);
});

const dayWord = document.createElement('div');
dayWord.className = 'closing__day';
for (const letter of 'DAY') {
  const span = document.createElement('span');
  span.textContent = letter;
  dayWord.append(span);
}
dayWord.setAttribute('aria-hidden', 'true');
document.querySelector('#closing-lines').append(dayWord);
const dayNumbers = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];
data.closing.forEach((line, index) => {
  const row = document.createElement('div');
  row.className = 'closing__row';
  const paragraph = document.createElement('p');
  paragraph.className = 'credits font-alt';
  paragraph.textContent = line;
  const number = document.createElement('span');
  number.className = 'closing__number';
  number.textContent = dayNumbers[index];
  number.setAttribute('aria-hidden', 'true');
  row.append(paragraph, number);
  document.querySelector('#closing-lines').append(row);
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduceMotion) {
  // Use the locally installed Lenis version; original Codrops timing is preserved.
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', event => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { duration: 1.2 });
    });
  });
  await import('./effects.js');
} else {
  document.body.classList.remove('loading');
}
