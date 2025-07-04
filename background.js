class BackgroundManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializeDefaultSettings();
  }

  setupEventListeners() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.handleInstall();
      } else if (details.reason === "update") {
        this.handleUpdate(details.previousVersion);
      }
    });

    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Handle tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) {
        this.handleTabUpdate(tabId, tab);
      }
    });
  }

  async handleInstall() {
    console.log("Privacy Guard extension installed");

    // Set default settings
    await this.setDefaultSettings();

    // Initialize statistics
    await this.initializeStats();

    // Show welcome notification
    this.showNotification("Privacy Guard installed successfully!");
  }

  async handleUpdate(previousVersion) {
    console.log(`Privacy Guard updated from ${previousVersion}`);

    // Migrate settings if needed
    await this.migrateSettings(previousVersion);

    this.showNotification("Privacy Guard updated successfully!");
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case "STATS_UPDATE":
          await this.updateStats(message.stats);
          sendResponse({ success: true });
          break;

        case "GET_SETTINGS":
          const settings = await this.getSettings();
          sendResponse({ settings });
          break;

        case "SAVE_SETTINGS":
          await this.saveSettings(message.settings);
          sendResponse({ success: true });
          break;

        case "RESET_PRIVACY_BUDGET":
          await this.resetPrivacyBudget(message.epsilon);
          sendResponse({ success: true });
          break;

        case "LOG_DETECTION":
          await this.logDetection(message.detection);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ error: error.message });
    }
  }

  async handleTabUpdate(tabId, tab) {
    // Inject content script if needed
    if (tab.url && !tab.url.startsWith("chrome://")) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"],
        });
      } catch (error) {
        console.error("Error injecting content script:", error);
      }
    }
  }

  async setDefaultSettings() {
    const defaultSettings = {
      protectionEnabled: true,
      privacyLevel: 1.0,
      autoReplace: false,
      detectionPatterns: {
        creditCard: true,
        ssn: true,
        email: true,
        phone: true,
        apiKeys: true,
        tokens: true,
      },
      privacyParameters: {
        epsilon: 1.0,
        delta: 0.001,
        sensitivity: 1.0,
      },
    };

    await chrome.storage.sync.set({ privacyGuardSettings: defaultSettings });
  }

  async initializeStats() {
    const defaultStats = {
      detected: 0,
      protected: 0,
      replaced: 0,
      censored: 0,
      sessionsStarted: 0,
      lastReset: Date.now(),
    };

    await chrome.storage.local.set({ privacyGuardStats: defaultStats });
  }

  async getSettings() {
    const result = await chrome.storage.sync.get(["privacyGuardSettings"]);
    return result.privacyGuardSettings || {};
  }

  async saveSettings(settings) {
    await chrome.storage.sync.set({ privacyGuardSettings: settings });

    // Notify all tabs about settings change
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "SETTINGS_UPDATE",
          settings: settings,
        });
      } catch (error) {
        // Tab might not have content script loaded
      }
    }
  }

  async updateStats(newStats) {
    const result = await chrome.storage.local.get(["privacyGuardStats"]);
    const currentStats = result.privacyGuardStats || {};

    const updatedStats = {
      ...currentStats,
      ...newStats,
      lastUpdated: Date.now(),
    };

    await chrome.storage.local.set({ privacyGuardStats: updatedStats });

    // Update badge with detection count
    await this.updateBadge(updatedStats.detected);
  }

  async resetPrivacyBudget(epsilon) {
    const settings = await this.getSettings();
    settings.privacyParameters.epsilon = epsilon;
    await this.saveSettings(settings);

    // Log the reset
    await this.logEvent("privacy_budget_reset", { epsilon });
  }

  async updateBadge(count) {
    const badgeText = count > 0 ? count.toString() : "";
    const badgeColor = count > 0 ? "#ff4444" : "#28a745";

    try {
      await chrome.action.setBadgeText({ text: badgeText });
      await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    } catch (error) {
      console.error("Error updating badge:", error);
    }
  }

  async logDetection(detection) {
    const log = {
      timestamp: Date.now(),
      type: detection.type,
      url: detection.url,
      action: detection.action,
      privacyLevel: detection.privacyLevel,
    };

    // Store in local storage (keep last 100 detections)
    const result = await chrome.storage.local.get(["detectionLog"]);
    const currentLog = result.detectionLog || [];

    currentLog.push(log);
    if (currentLog.length > 100) {
      currentLog.shift(); // Remove oldest entry
    }

    await chrome.storage.local.set({ detectionLog: currentLog });
  }

  async logEvent(eventType, data) {
    const event = {
      timestamp: Date.now(),
      type: eventType,
      data: data,
    };

    const result = await chrome.storage.local.get(["eventLog"]);
    const currentLog = result.eventLog || [];

    currentLog.push(event);
    if (currentLog.length > 50) {
      currentLog.shift();
    }

    await chrome.storage.local.set({ eventLog: currentLog });
  }

  async migrateSettings(previousVersion) {
    // Handle settings migration for different versions
    const currentSettings = await this.getSettings();

    if (this.compareVersions(previousVersion, "1.0.0") < 0) {
      // Migration from pre-1.0.0 versions
      if (!currentSettings.privacyParameters) {
        currentSettings.privacyParameters = {
          epsilon: 1.0,
          delta: 0.001,
          sensitivity: 1.0,
        };
      }
    }

    await this.saveSettings(currentSettings);
  }

  compareVersions(version1, version2) {
    const v1parts = version1.split(".").map(Number);
    const v2parts = version2.split(".").map(Number);

    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;

      if (v1part < v2part) return -1;
      if (v1part > v2part) return 1;
    }

    return 0;
  }

  showNotification(message, type = "basic") {
    const notificationId = "privacy-guard-" + Date.now();

    chrome.notifications.create(notificationId, {
      type: type,
      iconUrl: "icons/icon48.png",
      title: "Privacy Guard",
      message: message,
    });

    // Auto-clear notification after 5 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 5000);
  }

  // Cleanup old data periodically
  async performMaintenance() {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

    // Clean old detection logs
    const result = await chrome.storage.local.get(["detectionLog"]);
    const detectionLog = result.detectionLog || [];

    const cleanedLog = detectionLog.filter(
      (entry) => now - entry.timestamp < maxAge
    );

    if (cleanedLog.length !== detectionLog.length) {
      await chrome.storage.local.set({ detectionLog: cleanedLog });
    }
  }
}

// Initialize background manager
const backgroundManager = new BackgroundManager();

// Set up periodic maintenance
setInterval(() => {
  backgroundManager.performMaintenance();
}, 24 * 60 * 60 * 1000); // Once per day
