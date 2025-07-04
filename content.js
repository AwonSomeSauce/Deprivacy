class PrivacyGuard {
  constructor() {
    this.sensitivePatterns = [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone number
      /\b(?:sk|pk)_[a-zA-Z0-9]{24,}\b/g, // API keys
      /\b[A-Za-z0-9]{32,}\b/g, // Tokens/hashes
    ];

    this.activeInput = null;
    this.overlay = null;
    this.wordClusteringManager = null;
    this.differentialPrivacyManager = null;
    this.settings = {
      protectionEnabled: true,
      privacyLevel: 1.0,
      autoReplace: false,
    };
    this.stats = {
      detected: 0,
      protected: 0,
      replaced: 0,
      censored: 0,
    };
    this.init();
  }

  async init() {
    console.log("Privacy Guard: Initializing...");
    this.setupEventListeners();
    await this.loadSettings();
    await this.initializeComponents();
    this.setupMessageListener();
    console.log("Privacy Guard: Initialization complete");
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(["privacyGuardSettings"]);
      if (result.privacyGuardSettings) {
        this.settings = { ...this.settings, ...result.privacyGuardSettings };
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  async initializeComponents() {
    // Initialize word clustering manager
    this.wordClusteringManager = new WordClusteringManager();
    await this.wordClusteringManager.initializeClusters();

    // Initialize differential privacy manager
    this.differentialPrivacyManager = new DifferentialPrivacyManager(
      this.settings.privacyLevel,
      0.001
    );
    this.differentialPrivacyManager.setWordClusteringManager(
      this.wordClusteringManager
    );
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "SETTINGS_UPDATE") {
        this.settings = { ...this.settings, ...message.settings };
        this.differentialPrivacyManager.epsilon = this.settings.privacyLevel;
      } else if (message.type === "RESET_PRIVACY_BUDGET") {
        this.differentialPrivacyManager.resetPrivacyBudget(message.epsilon);
      }
      sendResponse({ success: true });
    });
  }

  setupEventListeners() {
    document.addEventListener("input", (e) => this.handleInput(e));
    document.addEventListener("keyup", (e) => this.handleKeyUp(e));
    document.addEventListener("click", (e) => this.handleClick(e));
    document.addEventListener("paste", (e) => this.handlePaste(e));

    // For Google Docs and other complex editors
    document.addEventListener("DOMSubtreeModified", (e) =>
      this.handleDOMChange(e)
    );

    // MutationObserver for modern browsers
    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "childList" ||
            mutation.type === "characterData"
          ) {
            this.handleContentChange(mutation.target);
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  handleInput(event) {
    console.log("Privacy Guard: Input event detected");
    const target = event.target;
    console.log(
      "Privacy Guard: Target element:",
      target.tagName,
      target.className
    );

    if (this.isTextInput(target)) {
      console.log("Privacy Guard: Valid text input detected");
      this.activeInput = target;
      const text = target.value || target.textContent || target.innerText || "";
      console.log("Privacy Guard: Text content:", text.substring(0, 100));
      this.analyzeText(text, target);
    } else {
      console.log("Privacy Guard: Not a valid text input");
    }
  }

  handleKeyUp(event) {
    if (event.key === "Escape") {
      this.hideOverlay();
    }
  }

  handleClick(event) {
    if (!this.overlay || !this.overlay.contains(event.target)) {
      this.hideOverlay();
    }
  }

  handlePaste(event) {
    setTimeout(() => {
      const target = event.target;
      if (this.isTextInput(target)) {
        this.activeInput = target;
        const text = target.value || target.textContent || target.innerText;
        this.analyzeText(text, target);
      }
    }, 100); // Small delay to allow paste to complete
  }

  handleDOMChange(event) {
    const target = event.target;
    if (this.isTextInput(target)) {
      this.activeInput = target;
      const text = target.value || target.textContent || target.innerText;
      if (text && text.length > 0) {
        this.analyzeText(text, target);
      }
    }
  }

  handleContentChange(element) {
    if (this.isTextInput(element)) {
      this.activeInput = element;
      const text = element.value || element.textContent || element.innerText;
      if (text && text.length > 0) {
        this.analyzeText(text, element);
      }
    }
  }

  isTextInput(element) {
    if (!element) return false;

    // Standard input elements
    if (
      element.tagName === "INPUT" &&
      ["text", "email", "password", "search", "url"].includes(element.type)
    ) {
      return true;
    }

    // Textarea elements
    if (element.tagName === "TEXTAREA") {
      return true;
    }

    // Content editable elements
    if (element.isContentEditable || element.contentEditable === "true") {
      return true;
    }

    // Google Docs specific elements
    if (
      element.classList &&
      (element.classList.contains("kix-lineview-text-block") ||
        element.classList.contains("docs-text-block") ||
        element.classList.contains("kix-wordhtmlgenerator-word-node"))
    ) {
      return true;
    }

    // ChatGPT specific elements
    if (
      element.classList &&
      (element.classList.contains("ProseMirror") ||
        element.classList.contains("chat-input"))
    ) {
      return true;
    }

    // Any element with role="textbox"
    if (element.getAttribute && element.getAttribute("role") === "textbox") {
      return true;
    }

    return false;
  }

  analyzeText(text, inputElement) {
    console.log(
      "Privacy Guard: Analyzing text:",
      text.substring(0, 100) + "..."
    );

    if (!this.settings.protectionEnabled) {
      console.log("Privacy Guard: Protection disabled");
      return;
    }

    const words = text.split(/\s+/);
    const sensitiveWords = [];

    words.forEach((word, index) => {
      if (this.isSensitiveToken(word)) {
        console.log("Privacy Guard: Found sensitive word:", word);
        const position = this.getWordPosition(text, word, index);
        sensitiveWords.push({
          word,
          index,
          position,
          element: inputElement,
        });
      }
    });

    if (sensitiveWords.length > 0) {
      console.log(
        "Privacy Guard: Processing",
        sensitiveWords.length,
        "sensitive words"
      );
      this.updateStats("detected", this.stats.detected + 1);

      if (this.settings.autoReplace) {
        this.autoReplaceWord(sensitiveWords[0]);
      } else {
        this.showPrivacyAlert(sensitiveWords[0]);
      }
    } else {
      console.log("Privacy Guard: No sensitive words found");
    }
  }

  isSensitiveToken(word) {
    return this.sensitivePatterns.some((pattern) => pattern.test(word));
  }

  getWordPosition(text, word, wordIndex) {
    const words = text.split(/\s+/);
    let position = 0;
    for (let i = 0; i < wordIndex; i++) {
      position += words[i].length + 1; // +1 for space
    }
    return position;
  }

  showPrivacyAlert(sensitiveWord) {
    this.hideOverlay();

    const rect = sensitiveWord.element.getBoundingClientRect();
    this.overlay = this.createOverlay(rect, sensitiveWord);
    document.body.appendChild(this.overlay);
  }

  createOverlay(rect, sensitiveWord) {
    const overlay = document.createElement("div");
    overlay.className = "privacy-guard-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 5}px;
      left: ${rect.left}px;
      background: #fff;
      border: 2px solid #ff4444;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
    `;

    const title = document.createElement("div");
    title.textContent = "🔒 Sensitive Data Detected";
    title.style.cssText =
      "font-weight: bold; color: #ff4444; margin-bottom: 8px;";

    const message = document.createElement("div");
    message.textContent = `Found: "${sensitiveWord.word}"`;
    message.style.cssText = "margin-bottom: 12px; color: #666;";

    const buttons = document.createElement("div");
    buttons.style.cssText = "display: flex; gap: 8px; flex-wrap: wrap;";

    const eraseBtn = this.createButton("Erase", "#ff4444", () => {
      this.eraseWord(sensitiveWord);
      this.hideOverlay();
    });

    const censorBtn = this.createButton("Censor", "#ff8800", () => {
      this.censorWord(sensitiveWord);
      this.hideOverlay();
    });

    const replaceBtn = this.createButton("Replace", "#4444ff", () => {
      this.replaceWord(sensitiveWord);
      this.hideOverlay();
    });

    buttons.appendChild(eraseBtn);
    buttons.appendChild(censorBtn);
    buttons.appendChild(replaceBtn);

    overlay.appendChild(title);
    overlay.appendChild(message);
    overlay.appendChild(buttons);

    return overlay;
  }

  createButton(text, color, onClick) {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.cssText = `
      background: ${color};
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: opacity 0.2s;
    `;
    button.addEventListener("click", onClick);
    button.addEventListener("mouseenter", () => (button.style.opacity = "0.8"));
    button.addEventListener("mouseleave", () => (button.style.opacity = "1"));
    return button;
  }

  eraseWord(sensitiveWord) {
    const element = sensitiveWord.element;
    const text = element.value || element.textContent;
    const words = text.split(/\s+/);
    words[sensitiveWord.index] = "";
    const newText = words.join(" ").replace(/\s+/g, " ").trim();
    this.updateElementText(element, newText);
    this.updateStats("protected", this.stats.protected + 1);
  }

  censorWord(sensitiveWord) {
    const element = sensitiveWord.element;
    const text = element.value || element.textContent;
    const words = text.split(/\s+/);
    words[sensitiveWord.index] = "*".repeat(sensitiveWord.word.length);
    const newText = words.join(" ");
    this.updateElementText(element, newText);
    this.updateStats("censored", this.stats.censored + 1);
    this.updateStats("protected", this.stats.protected + 1);
  }

  replaceWord(sensitiveWord) {
    const element = sensitiveWord.element;
    const text = element.value || element.textContent;
    const words = text.split(/\s+/);
    const replacement = this.getDifferentialPrivacyReplacement(
      sensitiveWord.word,
      text
    );
    words[sensitiveWord.index] = replacement;
    const newText = words.join(" ");
    this.updateElementText(element, newText);
    this.updateStats("replaced", this.stats.replaced + 1);
    this.updateStats("protected", this.stats.protected + 1);
  }

  autoReplaceWord(sensitiveWord) {
    const element = sensitiveWord.element;
    const text = element.value || element.textContent;
    const words = text.split(/\s+/);
    const replacement = this.getDifferentialPrivacyReplacement(
      sensitiveWord.word,
      text
    );
    words[sensitiveWord.index] = replacement;
    const newText = words.join(" ");
    this.updateElementText(element, newText);
    this.updateStats("replaced", this.stats.replaced + 1);
    this.updateStats("protected", this.stats.protected + 1);
  }

  updateElementText(element, newText) {
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      element.value = newText;
    } else {
      element.textContent = newText;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  getDifferentialPrivacyReplacement(word, context) {
    if (!this.differentialPrivacyManager) {
      return "*".repeat(word.length);
    }

    try {
      return this.differentialPrivacyManager.getPrivateReplacement(
        word,
        context
      );
    } catch (error) {
      console.error("Error getting differential privacy replacement:", error);
      return "*".repeat(word.length);
    }
  }

  updateStats(type, value) {
    this.stats[type] = value;

    // Send stats to background script
    chrome.runtime
      .sendMessage({
        type: "STATS_UPDATE",
        stats: this.stats,
      })
      .catch((error) => {
        console.error("Error updating stats:", error);
      });
  }

  hideOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

// Initialize the privacy guard
const privacyGuard = new PrivacyGuard();
