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
  const highlight = {
    text: text,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    id: Date.now().toString(),
  };

  // Apply highlight to the current selection IMMEDIATELY
  const selection = window.getSelection();
  let highlightApplied = false;

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    // Apply the highlight right away before any async operations
    highlightRange(range, highlight.id);
    highlightApplied = true;
    // selection.removeAllRanges();
  }

  // THEN save to storage (this can happen in the background)
  chrome.storage.local.get(["highlights"], (result) => {
    const highlights = result.highlights || [];
    highlights.push(highlight);
    chrome.storage.local.set({ highlights }, () => {
      console.log("Highlight saved:", highlight);
      // Only show notification after storage is updated
      showSavedNotification();
    });
  });
}

// Improved function to highlight a range with better multi-line support
function highlightRange(range, highlightId) {
  try {
    // Create a span to wrap the highlighted text
    const span = document.createElement("span");
    span.className = "highlighted-text";
    span.dataset.id = highlightId;

    // Use surroundContents to highlight the selection
    range.surroundContents(span);
  } catch (e) {
    console.error("Failed to highlight using surroundContents:", e);

    // Fallback for complex selections (spanning multiple elements)
    try {
      // Extract all contents from the range
      const contents = range.extractContents();

      // Create a new span for highlighting
      const span = document.createElement("span");
      span.className = "highlighted-text";
      span.dataset.id = highlightId;

      // Add the extracted contents to the span
      span.appendChild(contents);

      // Insert the highlighted span into the range
      range.insertNode(span);
    } catch (fallbackError) {
      console.error("Fallback highlighting also failed:", fallbackError);

      // Ultimate fallback - just try to mark the text without proper structure
      try {
        // Get the text content
        const textContent = range.toString();

        // Create a highlighted element
        const highlightElement = document.createElement("span");
        highlightElement.className = "highlighted-text";
        highlightElement.dataset.id = highlightId;
        highlightElement.textContent = textContent;

        // Clear the range and insert our element
        range.deleteContents();
        range.insertNode(highlightElement);
      } catch (lastResortError) {
        console.error("All highlighting methods failed:", lastResortError);
      }
    }
  }
}

// Show saved notification
function showSavedNotification() {
  const notification = document.createElement("div");
  notification.id = "save-notification";
  notification.textContent = "Highlight saved!";
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

// Completely revamped loadHighlights function for better multi-line support
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

      // Try the improved text finder approach
      if (!findAndHighlightTextImproved(text, highlight.id)) {
        console.log(
          `Could not find exact match for: ${text.substring(0, 30)}...`
        );
      }
    });
  });
}

// Improved text finder function for multi-line text
function findAndHighlightTextImproved(text, highlightId) {
  // Clean the text for comparison
  const searchText = text.trim();
  if (!searchText) return false;

  // Normalize whitespace in search text (treat multiple whitespace as single space)
  const normalizedSearchText = searchText.replace(/\s+/g, " ");

  // Prepare for fuzzy searching
  const searchWords = normalizedSearchText
    .split(" ")
    .filter((word) => word.length > 2);
  if (searchWords.length === 0) return false;

  // Try an exact match first with TextRange search
  const found = findWithWindowFind(searchText, highlightId);
  if (found) return true;

  // If exact match failed, try a more flexible approach
  return findBySimilarityScoring(searchText, searchWords, highlightId);
}

// Use the browser's built-in text finding functionality
function findWithWindowFind(searchText, highlightId) {
  // Save current selection
  const savedSelection = saveSelection();

  // Clear current selection
  if (window.getSelection) {
    if (window.getSelection().empty) {
      window.getSelection().empty();
    } else if (window.getSelection().removeAllRanges) {
      window.getSelection().removeAllRanges();
    }
  }

  // Try to find the text
  const found = window.find(searchText, false, false, true, false, true, false);

  if (found) {
    // Get the current selection after find
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      highlightRange(range, highlightId);
      selection.removeAllRanges();
      return true;
    }
  }

  // Restore original selection if search failed
  restoreSelection(savedSelection);
  return false;
}

// Find text by calculating similarity scores
function findBySimilarityScoring(searchText, searchWords, highlightId) {
  const textNodes = getAllVisibleTextNodes(document.body);
  const searchLength = searchText.length;

  // Group adjacent text nodes to handle text that spans multiple nodes
  const textGroups = createTextGroups(textNodes);

  for (const group of textGroups) {
    // Get combined text content
    const content = group.text;

    // Check if content approximately matches our search text
    const similarity = calculateSimilarity(content, searchText);
    if (similarity > 0.8) {
      // 80% or higher similarity threshold
      try {
        // Create a range spanning this text group
        const range = document.createRange();
        range.setStart(group.nodes[0], 0);
        range.setEnd(
          group.nodes[group.nodes.length - 1],
          group.nodes[group.nodes.length - 1].length
        );

        // Highlight this range
        highlightRange(range, highlightId);
        return true;
      } catch (e) {
        console.error("Error highlighting text group:", e);
      }
    }
  }

  return false;
}

// Calculate similarity between two text strings
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  // Simple contains check first
  if (longer.includes(shorter)) return 0.9;

  // Normalize both strings for comparison
  const normalizedLonger = longer.replace(/\s+/g, " ").toLowerCase();
  const normalizedShorter = shorter.replace(/\s+/g, " ").toLowerCase();

  // Check if normalized strings match
  if (normalizedLonger.includes(normalizedShorter)) return 0.85;

  // Calculate Levenshtein distance for edit similarity
  const distance = levenshteinDistance(normalizedLonger, normalizedShorter);
  return (
    1 - distance / Math.max(normalizedLonger.length, normalizedShorter.length)
  );
}

// Simple Levenshtein distance implementation
function levenshteinDistance(str1, str2) {
  const track = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) track[0][i] = i;
  for (let j = 0; j <= str2.length; j++) track[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const ind = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // insertion
        track[j - 1][i] + 1, // deletion
        track[j - 1][i - 1] + ind // substitution
      );
    }
  }

  return track[str2.length][str1.length];
}

// Get all visible text nodes
function getAllVisibleTextNodes(node) {
  const textNodes = [];

  function getNodes(node) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      // Only include if the node is visible
      const parentElement = node.parentElement;
      if (parentElement) {
        const style = window.getComputedStyle(parentElement);
        if (style.display !== "none" && style.visibility !== "hidden") {
          textNodes.push(node);
        }
      } else {
        textNodes.push(node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const nodeName = node.nodeName.toLowerCase();
      if (
        nodeName !== "script" &&
        nodeName !== "style" &&
        !node.classList.contains("highlighted-text")
      ) {
        for (let i = 0; i < node.childNodes.length; i++) {
          getNodes(node.childNodes[i]);
        }
      }
    }
  }

  getNodes(node);
  return textNodes;
}

// Group adjacent text nodes
function createTextGroups(textNodes) {
  const groups = [];
  let currentGroup = null;

  textNodes.forEach((node) => {
    if (!currentGroup) {
      currentGroup = {
        nodes: [node],
        text: node.textContent,
      };
    } else {
      // Check if nodes are adjacent
      const lastNode = currentGroup.nodes[currentGroup.nodes.length - 1];
      const isAdjacent = areNodesAdjacent(lastNode, node);

      if (isAdjacent) {
        currentGroup.nodes.push(node);
        currentGroup.text += node.textContent;
      } else {
        groups.push(currentGroup);
        currentGroup = {
          nodes: [node],
          text: node.textContent,
        };
      }
    }
  });

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

// Check if two text nodes are adjacent
function areNodesAdjacent(node1, node2) {
  // Simple check: same parent, consecutive indices
  if (node1.parentNode === node2.parentNode) {
    const childNodes = Array.from(node1.parentNode.childNodes);
    const index1 = childNodes.indexOf(node1);
    const index2 = childNodes.indexOf(node2);
    return Math.abs(index1 - index2) === 1;
  }
  return false;
}

// Save current selection
function saveSelection() {
  if (window.getSelection) {
    const sel = window.getSelection();
    if (sel.getRangeAt && sel.rangeCount) {
      return sel.getRangeAt(0);
    }
  }
  return null;
}

// Restore selection
function restoreSelection(range) {
  if (range) {
    if (window.getSelection) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
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
