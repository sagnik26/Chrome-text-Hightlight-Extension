console.log("Content script loaded!"); // Debug log

// Listen for text selection
document.addEventListener("mouseup", (event) => {
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
  if (request.action === "highlightDeleted") {
    const highlightElements = document.querySelectorAll(
      `.highlighted-text[data-id="${request.highlightId}"]`
    );
    highlightElements.forEach((element) => {
      const parent = element.parentNode;
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
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
  const highlight = {
    text: text,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    id: Date.now().toString(),
  };

  chrome.storage.local.get(["highlights"], (result) => {
    const highlights = result.highlights || [];
    highlights.push(highlight);
    chrome.storage.local.set({ highlights }, () => {
      console.log("Highlight saved:", highlight); // Debug log
      // Add visual feedback
      showSavedNotification();
      applyHighlight(text);
    });
  });
}

// Show saved notification
function showSavedNotification() {
  const notification = document.createElement("div");
  notification.id = "save-notification";
  notification.textContent = "Highlight saved!";
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2000);
}

// Apply highlight to text on the page
function applyHighlight(text) {
  const range = window.getSelection().getRangeAt(0);
  const span = document.createElement("span");
  span.className = "highlighted-text";
  range.surroundContents(span);
}

// Load highlights on page load
function loadHighlights() {
  chrome.storage.local.get(["highlights"], (result) => {
    const highlights = result.highlights || [];
    const currentUrl = window.location.href;

    highlights.forEach((highlight) => {
      if (highlight.url === currentUrl) {
        // Apply highlights to the page
        const regex = new RegExp(highlight.text, "g");
        document.body.innerHTML = document.body.innerHTML.replace(
          regex,
          `<span class="highlighted-text" data-id="${highlight.id}">${highlight.text}</span>`
        );
      }
    });
  });
}

loadHighlights();
