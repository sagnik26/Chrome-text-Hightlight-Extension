// popup.js
document.addEventListener("DOMContentLoaded", () => {
  loadHighlightsByUrl();

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.highlights) {
      loadHighlightsByUrl();
    }
  });
});

// Load highlights and group them by URL
function loadHighlightsByUrl() {
  chrome.storage.local.get(["highlights"], (result) => {
    const highlights = result.highlights || [];
    console.log("Loading all highlights:", highlights);

    // Get the current tab's URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0]?.url || "";

      // Group highlights by URL
      const highlightsByUrl = {};

      highlights.forEach((highlight) => {
        if (!highlightsByUrl[highlight.url]) {
          highlightsByUrl[highlight.url] = [];
        }
        highlightsByUrl[highlight.url].push(highlight);
      });

      // Clear the highlights list first
      const highlightsList = document.getElementById("highlights-list");
      highlightsList.innerHTML = "";

      // If we have no highlights at all
      if (Object.keys(highlightsByUrl).length === 0) {
        const noHighlights = document.createElement("p");
        noHighlights.id = "no-highlights";
        noHighlights.textContent = "No highlights saved yet.";
        highlightsList.appendChild(noHighlights);
        return;
      }

      // Get highlights for current URL
      const currentUrlHighlights = highlightsByUrl[currentUrl] || [];

      // Display current URL section if it has highlights
      if (currentUrlHighlights.length > 0) {
        displayCurrentUrlSection(currentUrlHighlights, currentUrl);
      } else {
        // Show a message for the current page
        const currentPageMessage = document.createElement("div");
        currentPageMessage.className = "current-page-message";
        currentPageMessage.textContent = "No highlights on this page yet.";
        highlightsList.appendChild(currentPageMessage);
      }

      // Always display other URL sections
      displayOtherUrlSections(highlightsByUrl, currentUrl);
    });
  });
}

// Display section for current URL
function displayCurrentUrlSection(highlights, url) {
  const highlightsList = document.getElementById("highlights-list");

  // Sort highlights by date (newest first)
  highlights.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Add header for current URL
  const urlHeader = document.createElement("div");
  urlHeader.className = "url-header current-url";
  urlHeader.textContent = "Current Page: " + formatUrl(url);
  highlightsList.appendChild(urlHeader);

  // Add each highlight
  highlights.forEach((highlight) => {
    const highlightElement = createHighlightElement(highlight);
    highlightsList.appendChild(highlightElement);
  });
}

// Display sections for other URLs with highlights
function displayOtherUrlSections(highlightsByUrl, currentUrl) {
  const highlightsList = document.getElementById("highlights-list");

  // Get other URLs (exclude current URL)
  const otherUrls = Object.keys(highlightsByUrl).filter(
    (url) => url !== currentUrl
  );

  // Skip if there are no other URLs
  if (otherUrls.length === 0) {
    return;
  }

  // Add separator and header
  const separator = document.createElement("hr");
  highlightsList.appendChild(separator);

  const otherPagesHeader = document.createElement("h3");
  otherPagesHeader.className = "other-pages-header";
  otherPagesHeader.textContent = "Highlights from other pages";
  highlightsList.appendChild(otherPagesHeader);

  // Add each URL section
  otherUrls.forEach((url) => {
    const urlHighlights = highlightsByUrl[url];

    // Sort highlights by date (newest first)
    urlHighlights.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Create URL section
    const urlSection = document.createElement("div");
    urlSection.className = "url-section";

    // Add URL header
    const urlHeader = document.createElement("div");
    urlHeader.className = "url-header other-url";
    urlHeader.textContent = formatUrl(url) + ` (${urlHighlights.length})`;

    // Make URL clickable
    urlHeader.addEventListener("click", () => {
      chrome.tabs.update({ url: url });
    });

    urlSection.appendChild(urlHeader);

    // Add the first 2 highlights for this URL
    const previewCount = Math.min(2, urlHighlights.length);
    for (let i = 0; i < previewCount; i++) {
      const highlight = urlHighlights[i];
      const highlightElement = createHighlightElement(highlight);
      urlSection.appendChild(highlightElement);
    }

    // Add "Show more" link if there are more than 2 highlights
    if (urlHighlights.length > 2) {
      const showMoreLink = document.createElement("div");
      showMoreLink.className = "show-more-link";
      showMoreLink.textContent = `Show ${urlHighlights.length - 2} more...`;

      showMoreLink.addEventListener("click", () => {
        chrome.tabs.update({ url: url });
      });

      urlSection.appendChild(showMoreLink);
    }

    highlightsList.appendChild(urlSection);
  });
}

// Create a highlight element
function createHighlightElement(highlight) {
  const div = document.createElement("div");
  div.className = "highlight-item";

  const text = document.createElement("div");
  text.className = "highlight-text";
  text.textContent = highlight.text;

  const timestamp = document.createElement("div");
  timestamp.className = "highlight-date";
  timestamp.textContent = formatDate(highlight.timestamp);

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.textContent = "Remove";
  deleteButton.addEventListener("click", () => deleteHighlight(highlight.id));

  div.appendChild(text);
  div.appendChild(timestamp);
  div.appendChild(deleteButton);

  return div;
}

// Delete a highlight
function deleteHighlight(highlightId) {
  chrome.storage.local.get(["highlights"], (result) => {
    let highlights = result.highlights || [];
    highlights = highlights.filter((h) => h.id !== highlightId);

    chrome.storage.local.set({ highlights }, () => {
      loadHighlightsByUrl();

      // Send message to all tabs to remove this highlight
      chrome.tabs.query({}, function (tabs) {
        tabs.forEach((tab) => {
          chrome.tabs
            .sendMessage(tab.id, {
              action: "deleteHighlight",
              highlightId: highlightId,
            })
            .catch(() => {
              // Ignore errors if some tabs can't receive the message
            });
        });
      });
    });
  });
}

// Format URL for display
function formatUrl(url) {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    const path = urlObj.pathname;

    // Limit path length
    const displayPath = path.length > 15 ? path.substring(0, 15) + "..." : path;
    return host + displayPath;
  } catch (e) {
    return url;
  }
}

// Format date for display
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}
