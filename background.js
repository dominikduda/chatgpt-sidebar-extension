/**
 * ChatGPT Sidebar - Background Service Worker
 * 
 * This is the main background script that handles:
 * - Context menu creation and management
 * - Side panel interactions
 * - Message passing between components
 * - Prompt formatting and storage
 * 
 * @author toastyfawn566
 * @version 1.3.0
 */

// =============================================================================
// DEFAULT PROMPTS CONFIGURATION
// =============================================================================

/**
 * Default prompts for page-based context menu
 * These appear when right-clicking on a page (not on selected text)
 * 
 * @property {string} id - Unique identifier for the prompt
 * @property {string} name - Display name in context menu
 * @property {string} template - Prompt template (can use {title} and {url} placeholders)
 * @property {boolean} includeUrl - Whether to auto-append page title/URL
 * @property {boolean} enabled - Whether the prompt is active
 */
const DEFAULT_PAGE_PROMPTS = [
  { id: 'page-summarize', name: 'Summarize this page', template: 'Please summarize this webpage:', includeUrl: true, enabled: true },
  { id: 'page-explain', name: 'Explain this page', template: 'Please explain what this webpage is about:', includeUrl: true, enabled: true },
  { id: 'page-questions', name: 'What questions should I ask?', template: 'What are some good questions I should ask about this webpage?', includeUrl: true, enabled: true },
  { id: 'page-send-url', name: 'Send page URL', template: '', includeUrl: true, enabled: true }
];

/**
 * Default prompts for text selection context menu
 * These appear when right-clicking on selected text
 * 
 * @property {string} id - Unique identifier for the prompt
 * @property {string} name - Display name in context menu
 * @property {string} template - Prompt template (use {text} for selected text)
 * @property {boolean} enabled - Whether the prompt is active
 */
const DEFAULT_SELECTION_PROMPTS = [
  { id: 'chatgpt-explain', name: 'Explain this', template: 'Explain this:\n\n{text}', enabled: true },
  { id: 'chatgpt-summarize', name: 'Summarize', template: 'Summarize this:\n\n{text}', enabled: true },
  { id: 'chatgpt-translate', name: 'Translate to English', template: 'Translate this to English:\n\n{text}', enabled: true },
  { id: 'chatgpt-grammar', name: 'Fix grammar', template: 'Fix the grammar in this:\n\n{text}', enabled: true },
  { id: 'chatgpt-code', name: 'Explain code', template: 'Explain what this code does:\n\n{text}', enabled: true },
  { id: 'chatgpt-bugs', name: 'Find bugs', template: 'Find bugs in this code:\n\n{text}', enabled: true }
];

// =============================================================================
// INITIALIZATION
// =============================================================================

// Configure side panel to open when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set panel behavior:', error));

// Build context menus when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  buildContextMenus();
  console.log('ChatGPT Sidebar: Extension installed');
});

// Rebuild menus on browser startup
chrome.runtime.onStartup.addListener(() => {
  buildContextMenus();
});

// =============================================================================
// CONTEXT MENU MANAGEMENT
// =============================================================================

/**
 * Builds all context menus based on saved prompts
 * Removes existing menus and recreates them from storage
 */
async function buildContextMenus() {
  await chrome.contextMenus.removeAll();
  
  // Load saved prompts or use defaults
  const result = await chrome.storage.sync.get(['pagePrompts', 'selectionPrompts']);
  const pagePrompts = result.pagePrompts || DEFAULT_PAGE_PROMPTS;
  const selectionPrompts = result.selectionPrompts || DEFAULT_SELECTION_PROMPTS;
  
  // Build text selection menus
  buildSelectionMenus(selectionPrompts);
  
  // Build page menus
  buildPageMenus(pagePrompts);
  
  console.log('ChatGPT Sidebar: Context menus built');
}

/**
 * Creates context menu items for text selection
 * @param {Array} prompts - Array of selection prompt objects
 */
function buildSelectionMenus(prompts) {
  const enabledPrompts = prompts.filter(p => p.enabled !== false);
  
  if (enabledPrompts.length === 0) return;
  
  // Parent menu
  chrome.contextMenus.create({
    id: 'ask-chatgpt',
    title: 'Ask ChatGPT',
    contexts: ['selection']
  });
  
  // Add each enabled prompt
  enabledPrompts.forEach((prompt, index) => {
    chrome.contextMenus.create({
      id: `sel_${index}`,
      parentId: 'ask-chatgpt',
      title: prompt.name,
      contexts: ['selection']
    });
  });
  
  // Separator and raw send option
  chrome.contextMenus.create({
    id: 'selection-separator',
    parentId: 'ask-chatgpt',
    type: 'separator',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'chatgpt-raw',
    parentId: 'ask-chatgpt',
    title: 'Just send to ChatGPT',
    contexts: ['selection']
  });
}

/**
 * Creates context menu items for page actions
 * @param {Array} prompts - Array of page prompt objects
 */
function buildPageMenus(prompts) {
  const enabledPrompts = prompts.filter(p => p.enabled !== false);
  
  // Parent menu
  chrome.contextMenus.create({
    id: 'page-chatgpt',
    title: 'Ask ChatGPT about this page',
    contexts: ['page']
  });
  
  // Add each enabled prompt
  enabledPrompts.forEach((prompt, index) => {
    chrome.contextMenus.create({
      id: `page_${index}`,
      parentId: 'page-chatgpt',
      title: prompt.name,
      contexts: ['page']
    });
  });
  
  // Separator (only if there are prompts)
  if (enabledPrompts.length > 0) {
    chrome.contextMenus.create({
      id: 'page-separator-1',
      parentId: 'page-chatgpt',
      type: 'separator',
      contexts: ['page']
    });
  }
  
  // Custom prompt option
  chrome.contextMenus.create({
    id: 'page-custom-input',
    parentId: 'page-chatgpt',
    title: 'Custom prompt...',
    contexts: ['page']
  });
  
  // Utility options
  chrome.contextMenus.create({
    id: 'page-separator-2',
    parentId: 'page-chatgpt',
    type: 'separator',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'open-chatgpt',
    parentId: 'page-chatgpt',
    title: 'Open sidebar',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'open-settings',
    parentId: 'page-chatgpt',
    title: 'Settings...',
    contexts: ['page']
  });
}

// =============================================================================
// PROMPT FORMATTING
// =============================================================================

/**
 * Replaces template placeholders with actual values
 * @param {string} template - Template string with placeholders
 * @param {Object} data - Data object with values to insert
 * @returns {string} Formatted string
 */
function formatTemplate(template, data) {
  let result = template || '';
  if (data.title) result = result.replace(/{title}/g, data.title);
  if (data.url) result = result.replace(/{url}/g, data.url);
  if (data.text) result = result.replace(/{text}/g, data.text);
  return result;
}

/**
 * Formats a page prompt, optionally appending URL info
 * @param {Object} prompt - Prompt configuration object
 * @param {Object} tab - Chrome tab object
 * @returns {string} Formatted prompt string
 */
function formatPagePrompt(prompt, tab) {
  let result = formatTemplate(prompt.template, { title: tab.title, url: tab.url });
  
  // Append page info if includeUrl is enabled
  if (prompt.includeUrl !== false) {
    const pageInfo = `\n\nTitle: ${tab.title}\nURL: ${tab.url}`;
    result = result.trim() + pageInfo;
  }
  
  return result.trim();
}

/**
 * Stores formatted text for the sidepanel to pick up
 * @param {string} text - The formatted prompt text
 */
function storePromptForSidepanel(text) {
  chrome.storage.local.set({
    selectedText: { text, promptType: null },
    pendingPaste: text
  });
}

// =============================================================================
// CONTEXT MENU CLICK HANDLER
// =============================================================================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = info.menuItemId;
  
  // Handle settings
  if (menuId === 'open-settings') {
    chrome.runtime.openOptionsPage();
    return;
  }
  
  // Handle custom prompt input popup
  if (menuId === 'page-custom-input') {
    // IMPORTANT: Open sidebar NOW during the user gesture, not later!
    // sidePanel.open() requires a user gesture context which is lost after the popup opens
    chrome.sidePanel.open({ tabId: tab.id }).catch(err => {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
    });
    
    await chrome.storage.local.set({
      promptInputPageInfo: { title: tab.title, url: tab.url },
      promptInputTabId: tab.id
    });
    chrome.windows.create({
      url: 'prompt-input.html',
      type: 'popup',
      width: 450,
      height: 350,
      top: 100,
      left: 100
    });
    return;
  }
  
  // Handle simple sidebar open
  if (menuId === 'open-chatgpt') {
    chrome.sidePanel.open({ tabId: tab.id }).catch(console.error);
    return;
  }
  
  // For all other actions, open sidebar first
  chrome.sidePanel.open({ tabId: tab.id }).catch(err => {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
  });
  
  // Handle raw text send (no template)
  if (menuId === 'chatgpt-raw') {
    if (info.selectionText) {
      storePromptForSidepanel(info.selectionText);
    }
    return;
  }
  
  // Load prompts from storage
  const result = await chrome.storage.sync.get(['pagePrompts', 'selectionPrompts']);
  const pagePrompts = result.pagePrompts || DEFAULT_PAGE_PROMPTS;
  const selectionPrompts = result.selectionPrompts || DEFAULT_SELECTION_PROMPTS;
  
  // Handle page prompts (page_0, page_1, etc.)
  if (menuId.startsWith('page_')) {
    const index = parseInt(menuId.replace('page_', ''));
    const enabledPrompts = pagePrompts.filter(p => p.enabled !== false);
    const prompt = enabledPrompts[index];
    if (prompt) {
      storePromptForSidepanel(formatPagePrompt(prompt, tab));
    }
    return;
  }
  
  // Handle selection prompts (sel_0, sel_1, etc.)
  if (menuId.startsWith('sel_') && info.selectionText) {
    const index = parseInt(menuId.replace('sel_', ''));
    const enabledPrompts = selectionPrompts.filter(p => p.enabled !== false);
    const prompt = enabledPrompts[index];
    if (prompt) {
      const formatted = formatTemplate(prompt.template, { text: info.selectionText });
      storePromptForSidepanel(formatted);
    }
  }
});

// =============================================================================
// MESSAGE HANDLERS
// =============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Rebuild menus when settings change
  if (message.type === 'REBUILD_MENUS') {
    buildContextMenus();
    sendResponse({ success: true });
    return false;
  }
  
  // Handle custom prompt submission from popup
  if (message.type === 'CUSTOM_PROMPT_SUBMIT') {
    // Sidebar is already open (opened when Custom prompt... was clicked)
    // Just store the prompt for the sidepanel to pick up
    storePromptForSidepanel(message.prompt);
    chrome.storage.local.remove(['promptInputTabId', 'promptInputPageInfo']);
    sendResponse({ success: true });
    return false;
  }
  
  // Handle keyboard shortcut (Alt+G) from content script
  if (message.type === 'OPEN_SIDEBAR_WITH_TEXT') {
    if (message.text && sender.tab) {
      storePromptForSidepanel(message.text);
      chrome.sidePanel.open({ tabId: sender.tab.id })
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
    }
  }
  
  return false;
});
