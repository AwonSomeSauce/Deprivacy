class DeprivacyContentScript {
  constructor() {
    this.init();
  }

  init() {
    console.log('Deprivacy content script initialized');
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Content script received message:', message);

      switch (message.type) {
        case 'EXTRACT_TEXTAREAS':
          this.handleExtractTextareas(sendResponse);
          return true; // Keep message channel open for async response

        case 'REPLACE_TEXTAREAS':
          this.handleReplaceTextareas(message.textareas, sendResponse);
          return true; // Keep message channel open for async response

        default:
          console.log('Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    });
  }

  handleExtractTextareas(sendResponse) {
    try {
      const textareas = document.querySelectorAll('textarea');
      const extractedData = [];

      textareas.forEach((textarea, index) => {
        const content = textarea.value || '';
        if (content.trim()) { // Only include non-empty textareas
          extractedData.push({
            index: index,
            content: content,
            id: textarea.id || null,
            className: textarea.className || null
          });
        }
      });

      console.log(`Extracted ${extractedData.length} textareas with content`);
      sendResponse({
        success: true,
        textareas: extractedData
      });

    } catch (error) {
      console.error('Error extracting textareas:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  handleReplaceTextareas(processedTextareas, sendResponse) {
    try {
      const textareas = document.querySelectorAll('textarea');
      let replacedCount = 0;
      let totalAttempts = 0;

      processedTextareas.forEach(processedData => {
        totalAttempts++;
        
        if (processedData.index < textareas.length) {
          const textarea = textareas[processedData.index];
          
          // Only replace if content actually changed
          if (processedData.processedContent !== processedData.originalContent) {
            textarea.value = processedData.processedContent;
            
            // Trigger input event to notify any listeners
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            
            replacedCount++;
            
            // Add visual feedback - briefly highlight the textarea
            this.highlightTextarea(textarea);
            
            console.log(`Replaced content in textarea ${processedData.index}`);
          } else {
            console.log(`No changes needed for textarea ${processedData.index}`);
          }
        } else {
          console.warn(`Textarea index ${processedData.index} not found`);
        }
      });

      console.log(`Replacement complete: ${replacedCount}/${totalAttempts} textareas updated`);
      sendResponse({
        success: true,
        replacedCount: replacedCount,
        totalAttempts: totalAttempts
      });

    } catch (error) {
      console.error('Error replacing textareas:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  highlightTextarea(textarea) {
    // Store original styles
    const originalBackgroundColor = textarea.style.backgroundColor;
    const originalBorder = textarea.style.border;
    const originalTransition = textarea.style.transition;

    // Apply highlight effect
    textarea.style.transition = 'all 0.3s ease';
    textarea.style.backgroundColor = '#e8f5e8';
    textarea.style.border = '2px solid #4caf50';

    // Remove highlight after animation
    setTimeout(() => {
      textarea.style.backgroundColor = originalBackgroundColor;
      textarea.style.border = originalBorder;
      
      // Remove transition after animation completes
      setTimeout(() => {
        textarea.style.transition = originalTransition;
      }, 300);
    }, 1000);
  }

  // Utility method to get textarea statistics (for debugging)
  getTextareaStats() {
    const textareas = document.querySelectorAll('textarea');
    const stats = {
      total: textareas.length,
      withContent: 0,
      empty: 0,
      totalCharacters: 0
    };

    textareas.forEach(textarea => {
      const content = textarea.value || '';
      if (content.trim()) {
        stats.withContent++;
        stats.totalCharacters += content.length;
      } else {
        stats.empty++;
      }
    });

    return stats;
  }

  // Debug method to log current page textareas
  debugTextareas() {
    const stats = this.getTextareaStats();
    console.log('Textarea statistics:', stats);
    
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach((textarea, index) => {
      console.log(`Textarea ${index}:`, {
        id: textarea.id,
        className: textarea.className,
        contentLength: (textarea.value || '').length,
        placeholder: textarea.placeholder,
        readonly: textarea.readOnly,
        disabled: textarea.disabled
      });
    });
  }
}

// Initialize content script
new DeprivacyContentScript();

// Debug: Log when script loads
console.log('Deprivacy content script loaded on:', window.location.href);