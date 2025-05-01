console.log("Content script loaded!"); // Debug log

// Listen for text selection
document.addEventListener("mouseup", (event) => {
  console.log("Mouseup event fired!");
  // Small delay to ensure selection is complete
  setTimeout(() => {
    const selectedText = window.getSelection().toString().trim();
    console.log("Selected text:", selectedText); // Debug log

    if (selectedText.length > 0) {
      showHighlightButton(event.pageX, event.pageY, selectedText);
    } else {
      removeHighlightButton();
    }
  }, 10);
});

// Listen for messages from popup about deleted highlights
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in content script:", request);

  if (request.action === "deleteHighlight") {
    const highlightElements = document.querySelectorAll(
      `.highlighted-text[data-id="${request.highlightId}"]`
    );
    console.log(`Found ${highlightElements.length} elements to delete`);

    highlightElements.forEach((element) => {
      // Replace the span with its contents
      const parent = element.parentNode;
      const text = element.textContent;
      const textNode = document.createTextNode(text);
      parent.replaceChild(textNode, element);
    });
  }
});

// Show highlight button
function showHighlightButton(x, y, selectedText) {
  removeHighlightButton(); // Remove any existing button

  const button = document.createElement("div");
  button.id = "highlight-button";
  button.textContent = "Save Highlight?";
  button.style.position = "absolute";
  button.style.left = `${x}px`;
  button.style.top = `${y + 10}px`;
  button.style.zIndex = "9999"; // Make sure it's on top

  button.addEventListener("click", (e) => {
    e.preventDefault(); // Prevent default behavior
    e.stopPropagation(); // Stop event bubbling
    saveHighlight(selectedText);
    removeHighlightButton();
  });

  document.body.appendChild(button);
}

// Remove highlight button
function removeHighlightButton() {
  const existingButton = document.getElementById("highlight-button");
  if (existingButton) {
    existingButton.remove();
  }
}

// Save highlight to storage
function saveHighlight(text) {
  // Get the current highlight color
  chrome.storage.local.get(["highlightColor"], (colorResult) => {
    const highlightColor = colorResult.highlightColor || "#ffeb3b"; // Default to yellow if no color set

    const highlight = {
      text: text,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      id: Date.now().toString(),
      color: highlightColor,
    };

    // save to storage
    chrome.storage.local.get(["highlights"], (result) => {
      const highlights = result.highlights || [];
      const isHighlightExist = highlights.find(
        (h) => h.text === text && h.url === window.location.href
      );
      if (isHighlightExist) {
        showNotification("Already Exists!");
        return;
      }

      highlights.push(highlight);
      chrome.storage.local.set({ highlights }, () => {
        console.log("Highlight saved:", highlight);
        // Only show notification after storage is updated
        showNotification("Highlight saved!");
      });
    });
  });
}

// Show saved notification
function showNotification(text) {
  const notification = document.createElement("div");
  notification.id = "save-notification";
  notification.textContent = text;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = "0";

    // After transition is complete, remove from DOM
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300); // Wait for fade transition
  }, 2000);
}

function loadHighlights() {
  chrome.storage.local.get(["highlights"], (result) => {
    const highlights = result.highlights || [];
    const currentUrl = window.location.href;

    console.log("HHHH", highlights);

    // Filter highlights for the current page
    const pageHighlights = highlights.filter((h) => h.url === currentUrl);

    if (pageHighlights.length === 0) return;

    console.log(`Found ${pageHighlights.length} highlights for this page`);

    // Process each highlight
    pageHighlights.forEach((highlight) => {
      // Skip if already highlighted
      if (
        document.querySelector(`.highlighted-text[data-id="${highlight.id}"]`)
      ) {
        return;
      }

      const text = highlight.text.trim();
      if (!text) return;

      console.log(`Trying to apply highlight: ${text.substring(0, 30)}...`);
    });
  });
}

// Load highlights on page load
loadHighlights();

// Also reload highlights when the DOM changes significantly
const observer = new MutationObserver(function (mutations) {
  // Debounce the loadHighlights call
  if (observer.timeout) {
    clearTimeout(observer.timeout);
  }
  observer.timeout = setTimeout(loadHighlights, 1000);
});

// Start observing the document for significant changes
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: false,
  attributes: false,
});
