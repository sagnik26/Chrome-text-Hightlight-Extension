chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage
  chrome.storage.local.get(["highlights"], (result) => {
    if (!result.highlights) {
      chrome.storage.local.set({ highlights: [] });
    }
  });
});

// Listen for messages from popup and relay to tabs
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "deleteHighlight") {
    // Send the message to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs
          .sendMessage(tab.id, {
            action: "deleteHighlight",
            highlightId: request.highlightId,
          })
          .catch(() => {
            // Ignore errors if message can't be sent to a tab
          });
      });
    });
  }
});
