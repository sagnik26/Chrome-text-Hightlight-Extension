// popup.js
document.addEventListener("DOMContentLoaded", () => {
  loadHighlightsByUrl();
  setupColorSelector();
  setupSearch();

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.highlights) {
      loadHighlightsByUrl();
    }
  });
});

// Setup color selector
function setupColorSelector() {
  const colorSelector = document.getElementById("highlight-color");

  // Load saved color preference
  chrome.storage.local.get(["highlightColor"], (result) => {
    if (result.highlightColor) {
      colorSelector.value = result.highlightColor;
    }
  });

  // Save color preference when changed
  colorSelector.addEventListener("change", (e) => {
    const selectedColor = e.target.value;
    chrome.storage.local.set({ highlightColor: selectedColor });

    // Update all highlight elements with new color
    const highlightElements = document.querySelectorAll(".highlight-text");
    highlightElements.forEach((element) => {
      element.style.backgroundColor = selectedColor;
    });
  });
}

// Setup search functionality
function setupSearch() {
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterHighlights(searchTerm);
  });
}

// Filter highlights based on search term
function filterHighlights(searchTerm) {
  const urlSections = document.querySelectorAll(".url-section");
  const urlHeaders = document.querySelectorAll(".url-header");
  const highlightItems = document.querySelectorAll(".highlight-item");
  const currentPageHeader = document.querySelector(".url-header.current-url");
  const currentPageHighlights = document.querySelectorAll(
    ".highlight-item:not(.url-section .highlight-item)"
  );
  let hasVisibleHighlights = false;

  // First hide all sections and headers
  urlSections.forEach((section) => (section.style.display = "none"));
  urlHeaders.forEach((header) => (header.style.display = "none"));
  highlightItems.forEach((item) => (item.style.display = "none"));

  // If search term is empty, show everything
  if (!searchTerm) {
    urlSections.forEach((section) => (section.style.display = ""));
    urlHeaders.forEach((header) => (header.style.display = ""));
    highlightItems.forEach((item) => (item.style.display = ""));
    return;
  }

  // Check current page URL
  if (currentPageHeader) {
    const currentUrlText = currentPageHeader.textContent.toLowerCase();
    if (currentUrlText.includes(searchTerm)) {
      hasVisibleHighlights = true;
      currentPageHeader.style.display = "";
      currentPageHighlights.forEach(
        (highlight) => (highlight.style.display = "")
      );
    }
  }

  // Check other URL sections
  urlHeaders.forEach((header) => {
    if (header.classList.contains("current-url")) return; // Skip current page header as it's already handled

    const urlText = header.textContent.toLowerCase();
    if (urlText.includes(searchTerm)) {
      hasVisibleHighlights = true;
      header.style.display = "";

      // Show the parent URL section
      const urlSection = header.closest(".url-section");
      if (urlSection) {
        urlSection.style.display = "";

        // Show all highlights in this section
        const sectionHighlights =
          urlSection.querySelectorAll(".highlight-item");
        sectionHighlights.forEach(
          (highlight) => (highlight.style.display = "")
        );
      }
    }
  });

  // Show/hide "no highlights" message
  const noHighlights = document.getElementById("no-highlights");
  if (noHighlights) {
    noHighlights.style.display = hasVisibleHighlights ? "none" : "";
  }

  // Show/hide "no highlights on this page" message
  const currentPageMessage = document.querySelector(".current-page-message");
  if (currentPageMessage) {
    currentPageMessage.style.display = hasVisibleHighlights ? "none" : "";
  }
}

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

      // Apply any existing search filter
      const searchInput = document.getElementById("search-input");
      if (searchInput && searchInput.value) {
        filterHighlights(searchInput.value.toLowerCase());
      }
    });
  });
}

// Display section for current URL
function displayCurrentUrlSection(highlights, url) {
  const highlightsList = document.getElementById("highlights-list");

  // Sort highlights by date (newest first)
  highlights.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const currPageHeader = document.createElement("h3");
  currPageHeader.className = "other-pages-header";
  currPageHeader.textContent = "Current Page";

  // Add header for current URL
  const urlHeader = document.createElement("div");
  urlHeader.className = "url-header current-url";
  urlHeader.textContent = formatUrl(url);
  highlightsList.appendChild(currPageHeader);
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
    urlHeader.textContent = formatUrl(url);

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

  // Apply saved color preference
  chrome.storage.local.get(["highlightColor"], (result) => {
    if (result.highlightColor) {
      text.style.backgroundColor = result.highlightColor;
    }
  });

  const timestamp = document.createElement("div");
  timestamp.className = "highlight-date";
  timestamp.textContent = formatDate(highlight.timestamp);

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "highlight-buttons";

  const copyButton = document.createElement("button");
  copyButton.className = "copy-button";
  copyButton.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  copyButton.addEventListener("click", () => {
    navigator.clipboard.writeText(highlight.text).then(() => {
      // Show copied feedback
      copyButton.classList.add("copied");
      copyButton.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      setTimeout(() => {
        copyButton.classList.remove("copied");
        copyButton.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
      }, 1000);
    });
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  deleteButton.addEventListener("click", () => deleteHighlight(highlight.id));

  buttonContainer.appendChild(copyButton);
  buttonContainer.appendChild(deleteButton);

  div.appendChild(text);
  div.appendChild(timestamp);
  div.appendChild(buttonContainer);

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

function formatUrl(url) {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    let path = urlObj.pathname;

    // Limit path length more aggressively
    if (path.length > 20) {
      path = path.substring(0, 20) + "...";
    }

    // For very long hostnames, truncate them too
    let displayHost = host;
    if (host.length > 40) {
      // Keep the domain but truncate subdomains
      const parts = host.split(".");
      if (parts.length > 2) {
        // For subdomains, shorten them
        displayHost =
          parts
            .slice(0, 1)
            .map((p) => p.substring(0, 3) + "...")
            .join(".") +
          "." +
          parts.slice(-2).join(".");
      } else {
        // Just truncate if it's a long domain
        displayHost = host.substring(0, 40) + "...";
      }
    }

    return displayHost + path;
  } catch (e) {
    // For invalid URLs, just return a short version
    if (url.length > 30) {
      return url.substring(0, 27) + "...";
    }
    return url;
  }
}

// Format date for display
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}
