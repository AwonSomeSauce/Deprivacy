class PrivacyGuard {
  constructor() {
    this.overlay = null;
    this.backendUrl = 'http://127.0.0.1:5000/detect-pii';
    this.debounceTimer = null;
    this.lastProcessedText = new WeakMap();
    this.init();
  }

  init() {
    console.log('PrivacyGuard: Initialized');
    this.setupEventListeners();
  }

  setupEventListeners() {
    ['input', 'paste'].forEach((evt) =>
      document.addEventListener(evt, (e) => this.handleInput(e))
    );
    document.addEventListener('click', (e) => this.handleClick(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  isTextInput(el) {
    if (!el || typeof el !== 'object' || !(el instanceof HTMLElement))
      return false;

    return (
      (el.tagName === 'INPUT' &&
        ['text', 'email', 'password', 'search', 'url'].includes(el.type)) ||
      el.tagName === 'TEXTAREA' ||
      el.isContentEditable ||
      el.getAttribute('role') === 'textbox'
    );
  }

  handleInput({ target }) {
    if (!this.isTextInput(target)) return;
    const text = target.value ?? target.textContent ?? '';
    if (!text.trim()) return;
    
    // Debounce and avoid duplicate processing
    if (this.lastProcessedText.get(target) === text) return;
    
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.lastProcessedText.set(target, text);
      this.detectPII(text, target);
    }, 300);
  }

  handleClick(e) {
    if (this.overlay && !this.overlay.contains(e.target)) this.hideOverlay();
  }

  handleKeyUp(e) {
    if (e.key === 'Escape') this.hideOverlay();
  }

  async detectPII(text, element) {
    try {
      const resp = await fetch(this.backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = await resp.json();
      console.log('Response from Flask:', json);

      const entities = json.entities || [];
      if (entities.length) this.showOverlay(element, entities[0]);
    } catch (err) {
      console.error('PrivacyGuard: detectPII error', err);
    }
  }

  showOverlay(element, entity) {
    this.hideOverlay();
    const rect = element.getBoundingClientRect();
    this.overlay = this.createOverlay(rect, entity, element);
    console.log('Received entity from backend:', entity);
    document.body.appendChild(this.overlay);
  }

  createOverlay(rect, entity, element) {
    const overlay = document.createElement('div');
    overlay.className = 'privacy-guard-overlay';
    
    // Store reference for cleanup
    this.currentElement = element;
    this.currentEntity = entity;
    
    // Apply styles for proper visibility
    this.applyOverlayStyles(overlay, rect);
    
    // Create content using safe DOM methods
    this.createOverlayContent(overlay, entity);
    
    // Add event listeners
    this.attachOverlayListeners(overlay);
    
    return overlay;
  }

  applyOverlayStyles(overlay, rect) {
    // Calculate position with viewport bounds checking
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const overlayWidth = 280;
    const overlayHeight = 120;
    
    let left = rect.left;
    let top = rect.bottom + 8;
    
    // Adjust horizontal position if overlay would go off-screen
    if (left + overlayWidth > viewportWidth) {
      left = viewportWidth - overlayWidth - 10;
    }
    if (left < 10) left = 10;
    
    // Adjust vertical position if overlay would go off-screen
    if (top + overlayHeight > viewportHeight) {
      top = rect.top - overlayHeight - 8;
    }
    
    Object.assign(overlay.style, {
      position: 'fixed',
      top: `${Math.max(10, top)}px`,
      left: `${left}px`,
      width: `${overlayWidth}px`,
      minHeight: '80px',
      background: '#ffffff',
      border: '2px solid #e74c3c',
      borderRadius: '8px',
      padding: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)',
      zIndex: '2147483647',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
      color: '#333',
      boxSizing: 'border-box'
    });
  }

  createOverlayContent(overlay, entity) {
    // Safely escape text content
    const safeText = this.escapeHtml(entity?.text || 'Unknown PII');
    const safeSuggestion = this.escapeHtml(entity?.suggestion || '[REDACTED]');
    const entityType = this.escapeHtml(entity?.type || 'UNKNOWN');
    
    // Create header
    const header = document.createElement('div');
    header.style.cssText = 'font-weight: bold; color: #e74c3c; margin-bottom: 8px; font-size: 12px;';
    header.textContent = `🔒 ${entityType} DETECTED`;
    
    // Create detected text section
    const detectedSection = document.createElement('div');
    detectedSection.style.cssText = 'margin-bottom: 6px;';
    
    const detectedLabel = document.createElement('strong');
    detectedLabel.textContent = 'Found: ';
    detectedLabel.style.color = '#666';
    
    const detectedText = document.createElement('span');
    detectedText.textContent = safeText;
    detectedText.style.cssText = 'background: #fff3cd; padding: 2px 4px; border-radius: 3px; font-family: monospace;';
    
    detectedSection.appendChild(detectedLabel);
    detectedSection.appendChild(detectedText);
    
    // Create suggestion section
    const suggestionSection = document.createElement('div');
    suggestionSection.style.cssText = 'margin-bottom: 12px;';
    
    const suggestionLabel = document.createElement('em');
    suggestionLabel.textContent = 'Replace with: ';
    suggestionLabel.style.color = '#666';
    
    const suggestionText = document.createElement('span');
    suggestionText.textContent = safeSuggestion;
    suggestionText.style.cssText = 'background: #d1ecf1; padding: 2px 4px; border-radius: 3px; font-family: monospace;';
    
    suggestionSection.appendChild(suggestionLabel);
    suggestionSection.appendChild(suggestionText);
    
    // Create buttons container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';
    
    // Accept button
    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Replace';
    acceptBtn.style.cssText = 'background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;';
    acceptBtn.setAttribute('data-action', 'accept');
    
    // Ignore button
    const ignoreBtn = document.createElement('button');
    ignoreBtn.textContent = 'Ignore';
    ignoreBtn.style.cssText = 'background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;';
    ignoreBtn.setAttribute('data-action', 'ignore');
    
    buttonContainer.appendChild(ignoreBtn);
    buttonContainer.appendChild(acceptBtn);
    
    // Assemble overlay
    overlay.appendChild(header);
    overlay.appendChild(detectedSection);
    overlay.appendChild(suggestionSection);
    overlay.appendChild(buttonContainer);
  }

  attachOverlayListeners(overlay) {
    // Store event listeners for cleanup
    this.overlayListeners = [];
    
    const handleClick = (e) => {
      const action = e.target.getAttribute('data-action');
      if (action === 'accept') {
        this.replaceEntityInElement(this.currentElement, this.currentEntity);
        this.hideOverlay();
      } else if (action === 'ignore') {
        this.hideOverlay();
      }
    };
    
    const handleMouseOver = (e) => {
      if (e.target.tagName === 'BUTTON') {
        e.target.style.opacity = '0.8';
      }
    };
    
    const handleMouseOut = (e) => {
      if (e.target.tagName === 'BUTTON') {
        e.target.style.opacity = '1';
      }
    };
    
    overlay.addEventListener('click', handleClick);
    overlay.addEventListener('mouseover', handleMouseOver);
    overlay.addEventListener('mouseout', handleMouseOut);
    
    // Store for cleanup
    this.overlayListeners.push(
      { element: overlay, type: 'click', handler: handleClick },
      { element: overlay, type: 'mouseover', handler: handleMouseOver },
      { element: overlay, type: 'mouseout', handler: handleMouseOut }
    );
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  replaceEntityInElement(el, entity) {
    const text = el.value ?? el.textContent ?? '';
    if (el.value !== undefined) {
      el.value = text.replace(entity.text, entity.suggestion);
    } else {
      el.textContent = text.replace(entity.text, entity.suggestion);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  hideOverlay() {
    if (this.overlay) {
      // Clean up event listeners
      if (this.overlayListeners) {
        this.overlayListeners.forEach(({ element, type, handler }) => {
          element.removeEventListener(type, handler);
        });
        this.overlayListeners = [];
      }
      
      // Remove overlay from DOM
      this.overlay.remove();
      this.overlay = null;
      this.currentElement = null;
      this.currentEntity = null;
    }
  }
}

// Initialize the privacy guard
new PrivacyGuard();
