class DeprivacyPopup {
  constructor() {
    this.isProcessing = false;
    this.init();
  }

  init() {
    this.setupEventListeners();
    console.log('Deprivacy popup initialized');
  }

  setupEventListeners() {
    const deprivatizeBtn = document.getElementById('deprivatize-btn');
    deprivatizeBtn.addEventListener('click', () => this.handleDeprivatize());
  }

  async handleDeprivatize() {
    if (this.isProcessing) return;

    try {
      this.setProcessingState(true);
      this.showStatus('Processing textareas...', 'info');

      // Get the current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        throw new Error('No active tab found');
      }

      // Send message to content script to extract textarea content
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'EXTRACT_TEXTAREAS'
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to extract textareas');
      }

      const textareas = response.textareas;
      if (textareas.length === 0) {
        this.showStatus('No textareas found on this page', 'error');
        return;
      }

      this.showStatus(`Found ${textareas.length} textarea(s). Processing...`, 'info');

      // Process each textarea through the backend
      const processedTextareas = [];
      for (let i = 0; i < textareas.length; i++) {
        const textarea = textareas[i];
        this.showStatus(`Processing textarea ${i + 1}/${textareas.length}...`, 'info');
        
        try {
          const processedText = await this.processTextWithBackend(textarea.content);
          processedTextareas.push({
            index: textarea.index,
            originalContent: textarea.content,
            processedContent: processedText
          });
        } catch (error) {
          console.error(`Error processing textarea ${i + 1}:`, error);
          // Keep original content if processing fails
          processedTextareas.push({
            index: textarea.index,
            originalContent: textarea.content,
            processedContent: textarea.content
          });
        }
      }

      // Send processed content back to content script for replacement
      const replaceResponse = await chrome.tabs.sendMessage(tab.id, {
        type: 'REPLACE_TEXTAREAS',
        textareas: processedTextareas
      });

      if (!replaceResponse || !replaceResponse.success) {
        throw new Error(replaceResponse?.error || 'Failed to replace textarea content');
      }

      const replacementCount = processedTextareas.filter(
        t => t.processedContent !== t.originalContent
      ).length;

      this.showStatus(
        `✅ Complete! ${replacementCount} textarea(s) processed with privacy protection.`,
        'success'
      );

    } catch (error) {
      console.error('Error in deprivatize process:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.setProcessingState(false);
    }
  }

  async processTextWithBackend(text) {
    if (!text || !text.trim()) {
      return text;
    }

    try {
      const response = await fetch('http://127.0.0.1:5000/deprivatize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          epsilon: 5.0
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Backend processing failed');
      }

      return result.processed_text || text;

    } catch (error) {
      console.error('Backend processing error:', error);
      throw new Error(`Backend communication failed: ${error.message}`);
    }
  }

  setProcessingState(isProcessing) {
    this.isProcessing = isProcessing;
    
    const button = document.getElementById('deprivatize-btn');
    const spinner = document.getElementById('spinner');
    const buttonText = document.getElementById('button-text');
    
    if (isProcessing) {
      button.disabled = true;
      spinner.style.display = 'block';
      buttonText.textContent = 'Processing...';
    } else {
      button.disabled = false;
      spinner.style.display = 'none';
      buttonText.textContent = 'Deprivatize';
    }
  }

  showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 5000);
    }
  }

  hideStatus() {
    const statusElement = document.getElementById('status-message');
    statusElement.style.display = 'none';
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new DeprivacyPopup();
});