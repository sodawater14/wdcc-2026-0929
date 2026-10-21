// Native image preload replaces the original imagesLoaded dependency.
export const preloadImages = async () => {
  const urls = [...new Set(window.WDCC.images.map(item => item.src))];
  await Promise.allSettled(urls.map(src => new Promise(resolve => {
    const image = new Image();
    image.onload = image.onerror = resolve;
    image.src = src;
    if (image.complete) resolve();
  })));
  await document.fonts.ready;
};
