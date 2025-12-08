/**
 * ChatGPT Sidebar - Custom Prompt Input Dialog
 * 
 * Handles the popup window for entering custom prompts.
 * Retrieves page info from storage and sends the formatted
 * prompt to the background script.
 * 
 * @author toastyfawn566
 * @version 1.3.0
 */

// =============================================================================
// DOM ELEMENTS
// =============================================================================

const pageTitleEl = document.getElementById('page-title');
const pageUrlEl = document.getElementById('page-url');
const promptInput = document.getElementById('custom-prompt');
const sendBtn = document.getElementById('send-btn');
const cancelBtn = document.getElementById('cancel-btn');

// =============================================================================
// STATE
// =============================================================================

let pageInfo = { title: '', url: '' };

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initializes the dialog by loading page info from storage
 */
async function init() {
  const result = await chrome.storage.local.get(['promptInputPageInfo']);
  
  if (result.promptInputPageInfo) {
    pageInfo = result.promptInputPageInfo;
    pageTitleEl.textContent = pageInfo.title || 'Untitled';
    pageUrlEl.textContent = pageInfo.url || '';
    
    // Clear storage after reading
    chrome.storage.local.remove('promptInputPageInfo');
  }
  
  promptInput.focus();
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handles send button click
 * Formats the prompt and sends to background script
 */
sendBtn.addEventListener('click', () => {
  const userPrompt = promptInput.value.trim();
  
  if (!userPrompt) {
    promptInput.focus();
    return;
  }
  
  let finalPrompt = userPrompt;
  
  // Check if user used placeholders manually
  if (finalPrompt.includes('{title}') || finalPrompt.includes('{url}')) {
    // Replace placeholders with actual values
    finalPrompt = finalPrompt
      .replace(/{title}/g, pageInfo.title)
      .replace(/{url}/g, pageInfo.url);
  } else {
    // Auto-append page info if no placeholders used
    finalPrompt += `\n\nPage: ${pageInfo.title}\nURL: ${pageInfo.url}`;
  }
  
  // Send to background script
  chrome.runtime.sendMessage({
    type: 'CUSTOM_PROMPT_SUBMIT',
    prompt: finalPrompt
  });
  
  window.close();
});

/**
 * Handles cancel button click
 */
cancelBtn.addEventListener('click', () => {
  window.close();
});

/**
 * Keyboard shortcuts:
 * - Ctrl/Cmd+Enter: Send prompt
 * - Escape: Close dialog
 */
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    sendBtn.click();
  }
  if (e.key === 'Escape') {
    window.close();
  }
});

// =============================================================================
// START
// =============================================================================

init();
