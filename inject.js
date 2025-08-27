const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const url = args[0]?.toString() || '';
  if (url.includes('backend.wplace.live') && url.includes('tiles')) {
    console.log('WPlace tile:', url);
  }
  return originalFetch.apply(this, args);
};
