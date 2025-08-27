const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const requestInfo = args[0];
  // console.log("Fetch called:", requestInfo);
  const url = requestInfo.url || "";
  if (url.includes("backend.wplace.live") && url.includes("tiles")) {
    console.log("WPlace tile:", url);
  }
  return originalFetch.apply(this, args);
};
