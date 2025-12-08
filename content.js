/**
 * ChatGPT Sidebar - Content Script
 * 
 * Runs on all pages (except ChatGPT) to:
 * - Capture selected text when requested
 * - Handle keyboard shortcut (Alt+G) for quick send
 * 
 * @author toastyfawn566
 * @version 1.3.0
 */

// =============================================================================
// MESSAGE HANDLER
// =============================================================================

/**
 * Responds to selection requests from the background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    sendResponse({ text: selectedText });
  }
  return false;
});

// =============================================================================
// KEYBOARD SHORTCUT
// =============================================================================

/**
 * Alt+G keyboard shortcut to quickly send selected text to ChatGPT
 * This supplements the context menu option for faster workflow
 */
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'g') {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    
    if (selectedText) {
      chrome.runtime.sendMessage({
        type: 'OPEN_SIDEBAR_WITH_TEXT',
        text: selectedText
      }).catch(err => {
        // Extension context may be invalidated on some pages
        console.log('ChatGPT Sidebar: Could not send message', err);
      });
    }
  }
});
