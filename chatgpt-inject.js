/**
 * ChatGPT Sidebar - ChatGPT Injection Script
 * 
 * Runs on chatgpt.com to automatically paste text into the input field.
 * This script is injected into the iframe and listens for messages
 * from the side panel.
 * 
 * @author toastyfawn566
 * @version 1.3.0
 */

(function() {
  // Prevent multiple injections
  if (window.__chatgptSidebarInjected) return;
  window.__chatgptSidebarInjected = true;

  console.log('ChatGPT Sidebar: Inject script loaded');

  // ===========================================================================
  // INPUT FIELD SELECTORS
  // ===========================================================================
  
  /**
   * List of selectors to find ChatGPT's input field
   * Updated as ChatGPT's UI changes
   */
  const INPUT_SELECTORS = [
    '#prompt-textarea',
    'textarea[data-id="root"]',
    'div[contenteditable="true"]',
    'textarea',
    '[contenteditable="true"]'
  ];


  // ===========================================================================
  // MESSAGE LISTENERS
  // ===========================================================================

  /**
   * Listen for postMessage from the side panel
   */
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CHATGPT_SIDEBAR_PASTE') {
      if (event.data.text) {
        pasteIntoInput(event.data.text);
      }
    }
  });

  /**
   * Listen for direct chrome runtime messages
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PASTE_TO_CHATGPT') {
      pasteIntoInput(message.text);
      sendResponse({ success: true });
    }
    return false;
  });

  // ===========================================================================
  // PASTE FUNCTIONALITY
  // ===========================================================================

  /**
   * Finds the ChatGPT input field using multiple selectors
   * @returns {Element|null} The input element or null
   */
  function findInputField() {
    for (const selector of INPUT_SELECTORS) {
      const input = document.querySelector(selector);
      if (input) return input;
    }
    return null;
  }

  /**
   * Pastes text into ChatGPT's input field
   * Handles both textarea and contenteditable elements
   * @param {string} text - Text to paste
   */
  function pasteIntoInput(text) {
    const input = findInputField();

    if (!input) {
      console.log('ChatGPT Sidebar: Input field not found, retrying...');
      setTimeout(() => pasteIntoInput(text), 500);
      return;
    }

    console.log('ChatGPT Sidebar: Pasting text');

    // Handle textarea elements
    if (input.tagName === 'TEXTAREA') {
      input.focus();
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } 
    // Handle contenteditable divs (ChatGPT's current UI)
    else {
      input.focus();
      input.innerHTML = '';
      
      const p = document.createElement('p');
      p.textContent = text;
      input.appendChild(p);
      
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));
    }

    // Move cursor to end
    moveCursorToEnd(input);

    // Visual feedback - brief flash
    flashElement(input);

    // Check if auto-submit is enabled
    maybeAutoSubmit();
  }

  /**
   * Moves cursor to the end of an element
   * @param {Element} element - The input element
   */
  function moveCursorToEnd(element) {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /**
   * Flashes an element green twice with smooth transitions
   * @param {Element} element - Element to flash
   */
  function flashElement(element) {
    // Save original transition
    const originalTransition = element.style.transition;
    
    // Add smooth transition for background color
    element.style.transition = 'background-color 0.2s ease-in-out';
    
    // First flash - fade in
    element.style.backgroundColor = 'rgba(16, 163, 127, 0.25)';
    
    setTimeout(() => {
      // First flash - fade out
      element.style.backgroundColor = 'transparent';
      
      setTimeout(() => {
        // Second flash - fade in
        element.style.backgroundColor = 'rgba(16, 163, 127, 0.25)';
        
        setTimeout(() => {
          // Second flash - fade out
          element.style.backgroundColor = 'transparent';
          
          // Clean up after animation completes
          setTimeout(() => {
            element.style.removeProperty('background-color');
            element.style.transition = originalTransition || '';
            if (!element.style.transition) {
              element.style.removeProperty('transition');
            }
          }, 250);
        }, 350);
      }, 200);
    }, 350);
  }

  /**
   * Submits the prompt by simulating Enter key press
   * This is more reliable than trying to find and click the send button
   */
  function submitPrompt() {
    const input = findInputField();
    if (!input) {
      console.log('ChatGPT Sidebar: Cannot submit - input not found');
      return false;
    }

    // Focus the input
    input.focus();

    // Simulate pressing Enter key
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });

    input.dispatchEvent(enterEvent);
    console.log('ChatGPT Sidebar: Submitted via Enter key');
    return true;
  }

  /**
   * Checks if auto-submit is enabled and triggers send
   */
  async function maybeAutoSubmit() {
    try {
      const result = await chrome.storage.sync.get(['autoSubmit']);
      if (result.autoSubmit === true) {
        // Wait a bit for ChatGPT to process the input
        setTimeout(() => {
          submitPrompt();
        }, 500);
      }
    } catch (e) {
      console.error('ChatGPT Sidebar: Failed to check auto-submit setting', e);
    }
  }

  // ===========================================================================
  // STORAGE LISTENER
  // ===========================================================================

  /**
   * Listen for pendingPaste changes in real-time
   * This catches prompts stored after the page has already loaded
   */
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.pendingPaste && changes.pendingPaste.newValue) {
      console.log('ChatGPT Sidebar: Detected new pendingPaste from storage');
      const text = changes.pendingPaste.newValue;
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        pasteIntoInput(text);
        chrome.storage.local.remove('pendingPaste');
      }, 300);
    }
  });

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Check for pending text on page load
   */
  chrome.storage.local.get(['pendingPaste'], (result) => {
    if (result.pendingPaste) {
      // Wait for page to fully render
      setTimeout(() => {
        pasteIntoInput(result.pendingPaste);
        chrome.storage.local.remove('pendingPaste');
      }, 1000);
    }
  });
})();
