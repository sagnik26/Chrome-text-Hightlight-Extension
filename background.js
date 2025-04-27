chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage
  chrome.storage.local.get(["highlights"], (result) => {
    if (!result.highlights) {
      chrome.storage.local.set({ highlights: [] });
    }
  });
});
