// Local-file compatible entry; generated from main.js, utils.js and effects.js.
(async () => {
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

data.closing.forEach(line => {
  const paragraph = document.createElement('p');
  paragraph.className = 'credits font-alt';
  paragraph.textContent = line;
  document.querySelector('#closing-lines').append(paragraph);
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
  await startEffects();
} else {
  document.body.classList.remove('loading');
}

async function startEffects() {
// Native image preload replaces the original imagesLoaded dependency.
const preloadImages = async () => {
  const urls = [...new Set(window.WDCC.images.map(item => item.src))];
  await Promise.allSettled(urls.map(src => new Promise(resolve => {
    const image = new Image();
    image.onload = image.onerror = resolve;
    image.src = src;
    if (image.complete) resolve();
  })));
  await document.fonts.ready;
};

// Adapted from Codrops / Manoela Ilic, MIT. Original retained in reference/js-index.js.

gsap.registerPlugin(ScrollTrigger); // Register GSAP's ScrollTrigger plugin
gsap.registerPlugin(SplitText);     // Register GSAP's SplitText plugin

const grid = document.querySelector('.grid'); // Select the container that holds all grid items
const gridImages = grid.querySelectorAll('.grid__item-imgwrap'); // Select all elements with the class '.grid__item-imgwrap'

const marqueeInner = document.querySelector('.mark > .mark__inner'); // Select the inner element of the marquee

const textElement = document.querySelector('.text'); // Select the text element
var splitTextEl = textElement ? new SplitText(textElement, {type: 'chars'}) : null; // Split the text into individual characters for animation

const gridFull = document.querySelector('.grid--full'); // Select the full grid container

const creditsTexts = document.querySelectorAll('.credits'); // Select all elements with the class '.credits'

// Helper function to determine if the element is on the left or right side of the viewport
const isLeftSide = (element) => {
  const elementCenter = element.getBoundingClientRect().left + element.offsetWidth / 2; // Calculate the center of the element
  const viewportCenter = window.innerWidth / 2; // Calculate the center of the viewport
  return elementCenter < viewportCenter; // Return true if the element's center is to the left of the viewport's center
};

// Function to animate the grid items as they scroll into and out of view
const animateScrollGrid = () => {
  gridImages.forEach(imageWrap => {
    const imgEl = imageWrap.querySelector('.grid__item-img'); // Select the image element inside the grid item
    const leftSide = isLeftSide(imageWrap); // Check if the element is on the left side of the viewport

    // Create a GSAP timeline with ScrollTrigger for each grid item
    gsap.timeline({
      scrollTrigger: {
        trigger: imageWrap,               // Trigger the animation when this element enters the viewport
        start: 'top bottom+=10%',         // Start when the top of the element is 10% past the bottom of the viewport
        end: 'bottom top-=25%',           // End when the bottom of the element is 25% past the top of the viewport
        scrub: true,                      // Smooth scrub animation
      }
    })
    .from(imageWrap, {
      // Initial state when the element enters the viewport
      startAt: { filter: 'blur(0px) brightness(100%) contrast(100%)' }, // Ensure no blur or brightness adjustments at the start
      z: 300,                             // Translate the item 300px closer on the Z-axis
      rotateX: 70,                        // Start with a rotation of 70 degrees on the X-axis
      rotateZ: leftSide ? 5 : -5,         // Rotate 5 degrees if on the left, -5 degrees if on the right
      xPercent: leftSide ? -40 : 40,      // Horizontal translation: -40% if on the left, 40% if on the right
      skewX: leftSide ? -20 : 20,         // Skew the element on the X-axis
      yPercent: 100,                      // Start with the element below the viewport
      filter: 'blur(7px) brightness(0%) contrast(400%)', // Start with a blur, low brightness, and high contrast
      ease: 'sine',                       
    })
    .to(imageWrap, {
      // Animation when the element exits the viewport
      z: 300,                             // Move back to original Z-translation (300px)
      rotateX: -50,                       // Rotate -50 degrees on the X-axis
      rotateZ: leftSide ? -1 : 1,         // Slightly rotate on the Z-axis (-1 or 1 depending on side)
      xPercent: leftSide ? -20 : 20,      // Move slightly left (-20%) or right (20%) on exit
      skewX: leftSide ? 10 : -10,         // Skew slightly on exit
      filter: 'blur(4px) brightness(0%) contrast(500%)', // Add blur and reduce brightness on exit
      ease: 'sine.in',                    
    })
    .from(imgEl, {
      // Additional animation on the image itself (scale along the Y-axis)
      scaleY: 1.8,                        // Scale Y-axis by 1.8
      ease: 'sine',                       
    }, 0)
    .to(imgEl, {
      scaleY: 1.8,                        // Return to normal scaling
      ease: 'sine.in'                     
    }, '>');
  });
};

// Function to animate the horizontal marquee as the user scrolls
const animateMarquee = () => {
  gsap.timeline({
    scrollTrigger: {
      trigger: grid,                     // Trigger the animation based on the grid's position
      start: 'top bottom',               // Start the animation when the top of the grid is at the bottom of the viewport
      end: 'bottom top',                 // End the animation when the bottom of the grid is at the top of the viewport
      scrub: true,                       // Smooth scrub
    }
  })
  .fromTo(marqueeInner, {
    x: '100vw'                           // Start the marquee off-screen to the right
  }, {
    x: '-100%',                          // Move the marquee to the left (completely across the screen)
    ease: 'sine',
  });
};

// Function to animate text (split into characters) as it scrolls into view
const animateTextElement = () => {
  if (!textElement) return;
  gsap.timeline({
    scrollTrigger: {
      trigger: textElement,              // Trigger the animation when the text element enters the viewport
      start: 'top bottom',               // Start when the top of the text hits the bottom of the viewport
      end: 'center center-=25%',         // End when the center of the text is near the center of the viewport
      scrub: true,                       // Smooth scrub
    }
  })
  .from(splitTextEl.chars, {
    // Animate each character individually
    ease: 'sine',
    yPercent: 300,                       // Move characters from below the viewport
    autoAlpha: 0,                        // Start with opacity 0
    stagger: {                           // Stagger the animation for each character
      each: 0.04,                        // 0.04 seconds between each character's animation
      from: 'center'                     // Animate characters from the center outward
    }
  });
};

// Function to animate the full grid with staggered delays per column
const animateGridFull = () => {
  const gridFullItems = gridFull.querySelectorAll('.grid__item'); // Select all items in the full grid
  
  // Calculate the number of columns in the grid--full
  const numColumns = getComputedStyle(gridFull).getPropertyValue('grid-template-columns').split(' ').length;
  const middleColumnIndex = Math.floor(numColumns / 2); // Find the index of the center column

  // Organize items by columns
  const columns = Array.from({ length: numColumns }, () => []); // Initialize empty arrays for each column
  gridFullItems.forEach((item, index) => {
    const columnIndex = index % numColumns; // Determine which column the item belongs to
    columns[columnIndex].push(item); // Add the item to the respective column
  });

  // Animate each column, starting from the center column, with staggered delays for adjacent columns
  columns.forEach((columnItems, columnIndex) => {
    const delayFactor = Math.abs(columnIndex - middleColumnIndex) * 0.2; // Delay based on distance from the center column

    // GSAP timeline for the entire column
    gsap.timeline({
      scrollTrigger: {
        trigger: gridFull,               // Trigger the animation when the full grid section comes into view
        start: 'top bottom',             // Start when the top of the grid hits the bottom of the viewport
        end: 'center center',            // End when the bottom of the grid hits the center of the viewport
        scrub: true,                     // Smooth scrub
      }
    })
    .from(columnItems, {
      // Animate the column items into view
      yPercent: 450,                     // Start with items far below the viewport
      autoAlpha: 0,                      // Fade in from opacity 0
      delay: delayFactor,                // Delay based on distance from the center
      ease: 'sine',
    })
    .from(columnItems.map(item => item.querySelector('.grid__item-img')), {
      // Apply rotation to the images inside each grid item
      transformOrigin: '50% 0%',          // Set the transform origin for the 3D effect
      ease: 'sine',
    }, 0); // Start the rotation at the same time as the translation
  });
};

// Move all five lines together so their horizontal alignment stays centered.
const animateCredits = () => {
  gsap.from('.closing__lines', {
    y: 24,
    autoAlpha: 0,
    ease: 'sine.out',
    scrollTrigger: {
      trigger: '.closing',
      start: 'top 85%',
      end: 'top 35%',
      scrub: true,
    },
  });
};

// Main initialization function
const init = () => {
  animateScrollGrid();    // Animate the grid items on scroll
  animateMarquee();       // Animate the marquee on scroll
  animateTextElement();   // Animate the split text on scroll
  animateGridFull();      // Animate the full grid with staggered delay
  animateCredits();       // Call the credits animation
};

// Preload images and initialize animations after the images have loaded
preloadImages('.grid__item-img').then(() => {
  document.body.classList.remove('loading'); // Remove the 'loading' class from the body
  init(); // Initialize the animations
  ScrollTrigger.refresh(); // Refresh after local images and Chinese fonts are ready
});
}
})();
