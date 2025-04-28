document.addEventListener("DOMContentLoaded", () => {
  loadHighlights();

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.highlights) {
      loadHighlights();
    }
  });
});

function loadHighlights() {
  chrome.storage.local.get(["highlights"], (result) => {
    console.log("Loading highlights:", result.highlights); // Debug log
    const highlights = result.highlights || [];
    const highlightsList = document.getElementById("highlights-list");

    if (highlights.length === 0) {
      highlightsList.innerHTML =
        '<p id="no-highlights">No highlights saved yet.</p>';
      return;
    }

    highlightsList.innerHTML = "";

    // Sort highlights by date (newest first)
    highlights.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    highlights.forEach((highlight) => {
      const highlightElement = createHighlightElement(highlight);
      highlightsList.appendChild(highlightElement);
    });
  });
}

function createHighlightElement(highlight) {
  const div = document.createElement("div");
  div.className = "highlight-item";

  const text = document.createElement("div");
  text.className = "highlight-text";
  text.textContent = highlight.text;

  const url = document.createElement("div");
  url.className = "highlight-url";
  url.textContent = highlight.url;
  url.title = highlight.url;

  const date = document.createElement("div");
  date.className = "highlight-date";
  date.textContent = new Date(highlight.timestamp).toLocaleString();

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.textContent = "Remove";
  deleteButton.addEventListener("click", () => deleteHighlight(highlight.id));

  div.appendChild(text);
  div.appendChild(url);
  div.appendChild(date);
  div.appendChild(deleteButton);

  return div;
}

function deleteHighlight(highlightId) {
  chrome.storage.local.get(["highlights"], (result) => {
    let highlights = result.highlights || [];
    highlights = highlights.filter((h) => h.id !== highlightId);

    chrome.storage.local.set({ highlights }, () => {
      loadHighlights();

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
