class PopupManager {
  constructor() {
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
    await this.loadSettings();
    await this.loadStats();
    this.setupEventListeners();
    this.updateUI();
    this.startStatsPolling();
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

  async saveSettings() {
    try {
      await chrome.storage.sync.set({ privacyGuardSettings: this.settings });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  async loadStats() {
    try {
      const result = await chrome.storage.local.get(["privacyGuardStats"]);
      if (result.privacyGuardStats) {
        this.stats = { ...this.stats, ...result.privacyGuardStats };
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }

  async saveStats() {
    try {
      await chrome.storage.local.set({ privacyGuardStats: this.stats });
    } catch (error) {
      console.error("Error saving stats:", error);
    }
  }

  setupEventListeners() {
    // Protection toggle
    const protectionToggle = document.getElementById("protection-toggle");
    protectionToggle.addEventListener("click", () => {
      this.settings.protectionEnabled = !this.settings.protectionEnabled;
      this.saveSettings();
      this.updateUI();
      this.notifyContentScript();
    });

    // Privacy level slider
    const privacySlider = document.getElementById("privacy-slider");
    privacySlider.addEventListener("input", (e) => {
      this.settings.privacyLevel = parseFloat(e.target.value);
      this.saveSettings();
      this.updateUI();
      this.notifyContentScript();
    });

    // Auto-replace toggle
    const autoReplaceToggle = document.getElementById("auto-replace-toggle");
    autoReplaceToggle.addEventListener("click", () => {
      this.settings.autoReplace = !this.settings.autoReplace;
      this.saveSettings();
      this.updateUI();
      this.notifyContentScript();
    });

    // Reset budget button
    const resetBudgetBtn = document.getElementById("reset-budget");
    resetBudgetBtn.addEventListener("click", () => {
      this.resetPrivacyBudget();
    });

    // Clear stats button
    const clearStatsBtn = document.getElementById("clear-stats");
    clearStatsBtn.addEventListener("click", () => {
      this.clearStats();
    });
  }

  updateUI() {
    // Update protection status
    const protectionStatus = document.getElementById("protection-status");
    const protectionText = document.getElementById("protection-text");

    if (this.settings.protectionEnabled) {
      protectionStatus.className = "status-indicator active";
      protectionText.textContent = "Active";
    } else {
      protectionStatus.className = "status-indicator inactive";
      protectionText.textContent = "Disabled";
    }

    // Update privacy budget
    const privacyBudget = document.getElementById("privacy-budget");
    privacyBudget.textContent = `ε = ${this.settings.privacyLevel}`;

    // Update toggles
    const protectionToggle = document.getElementById("protection-toggle");
    protectionToggle.className = this.settings.protectionEnabled
      ? "toggle-switch active"
      : "toggle-switch";

    const autoReplaceToggle = document.getElementById("auto-replace-toggle");
    autoReplaceToggle.className = this.settings.autoReplace
      ? "toggle-switch active"
      : "toggle-switch";

    // Update privacy slider
    const privacySlider = document.getElementById("privacy-slider");
    const privacyValue = document.getElementById("privacy-value");
    privacySlider.value = this.settings.privacyLevel;
    privacyValue.textContent = this.settings.privacyLevel;

    // Update stats
    document.getElementById("detected-count").textContent = this.stats.detected;
    document.getElementById("protected-count").textContent =
      this.stats.protected;
    document.getElementById("replaced-count").textContent = this.stats.replaced;
    document.getElementById("censored-count").textContent = this.stats.censored;
  }

  async notifyContentScript() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          type: "SETTINGS_UPDATE",
          settings: this.settings,
        });
      }
    } catch (error) {
      console.error("Error notifying content script:", error);
    }
  }

  async resetPrivacyBudget() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          type: "RESET_PRIVACY_BUDGET",
          epsilon: this.settings.privacyLevel,
        });
      }

      // Show feedback
      this.showNotification("Privacy budget reset successfully!");
    } catch (error) {
      console.error("Error resetting privacy budget:", error);
      this.showNotification("Error resetting privacy budget", true);
    }
  }

  async clearStats() {
    this.stats = {
      detected: 0,
      protected: 0,
      replaced: 0,
      censored: 0,
    };

    await this.saveStats();
    this.updateUI();
    this.showNotification("Statistics cleared successfully!");
  }

  showNotification(message, isError = false) {
    // Create notification element
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      ${
        isError
          ? "background: #dc3545; color: white;"
          : "background: #28a745; color: white;"
      }
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  startStatsPolling() {
    // Poll for stats updates every 2 seconds
    setInterval(async () => {
      await this.loadStats();
      this.updateUI();
    }, 2000);
  }

  // Listen for messages from content script
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "STATS_UPDATE") {
        this.stats = { ...this.stats, ...message.stats };
        this.saveStats();
        this.updateUI();
      }

      if (message.type === "PRIVACY_BUDGET_UPDATE") {
        const privacyBudget = document.getElementById("privacy-budget");
        privacyBudget.textContent = `ε = ${message.remainingBudget.toFixed(2)}`;

        if (message.remainingBudget <= 0.1) {
          privacyBudget.style.color = "#dc3545";
          this.showNotification("Privacy budget is running low!", true);
        }
      }

      sendResponse({ success: true });
    });
  }
}

// Add CSS animation for notifications
const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

// Initialize popup manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const popupManager = new PopupManager();
  popupManager.setupMessageListener();
});
