const browserAPI = typeof browser !== "undefined" ? browser : chrome;

console.log("🧑‍🎨: service_worker.js loaded");

const ALARM_ID = "mr-wplace-charged";

// NOTE: ここから呼んでいる
// src/features/user-status/ui/notification-modal.ts
const ALARM_MESSAGE_START = "START_CHARGE_ALARM";
const ALARM_MESSAGE_STOP = "STOP_CHARGE_ALARM";
const ALARM_MESSAGE_GET_INFO = "GET_ALARM_INFO";
const OPEN_POPUP_FROM_CONTENT = "OPEN_POPUP_FROM_CONTENT";
const POPUP_PAGE_PATH = "popup.html";
const POPUP_WINDOW_OPENED = "POPUP_WINDOW_OPENED";
const POPUP_WINDOW_CLOSED = "POPUP_WINDOW_CLOSED";
const CLOSE_POPUP_WINDOW = "CLOSE_POPUP_WINDOW";
const NO_RECEIVER_ERROR_TEXT = "Receiving end does not exist";

let isPopupWindowOpen = false;
let popupFallbackTabId = null;

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("🧑‍🎨: Service worker received message:", message.type);
  if (message.type === ALARM_MESSAGE_START) {
    browserAPI.alarms.create(ALARM_ID, { when: message.when });
    console.log("🧑‍🎨: Charge alarm created at", message.when);
  } else if (message.type === ALARM_MESSAGE_STOP) {
    browserAPI.alarms.clear(ALARM_ID);
    console.log("🧑‍🎨: Charge alarm cancelled");
  } else if (message.type === ALARM_MESSAGE_GET_INFO) {
    browserAPI.alarms.get(ALARM_ID, (alarm) => {
      const alarmInfo = alarm
        ? {
            name: alarm.name,
            scheduledTime: alarm.scheduledTime,
            periodInMinutes: alarm.periodInMinutes,
          }
        : null;
      console.log("🧑‍🎨: Alarm info:", alarmInfo);
      sendResponse(alarmInfo);
    });
    return true; // 非同期response用
  } else if (message.type === OPEN_POPUP_FROM_CONTENT) {
    const openPopup = browserAPI.action?.openPopup;
    const createPopupTab = browserAPI.tabs?.create;
    const removeTab = browserAPI.tabs?.remove;
    if (typeof openPopup !== "function" && typeof createPopupTab !== "function") {
      sendResponse({
        success: false,
        reason: "Neither action.openPopup nor tabs.create is available",
      });
      return false;
    }

    const togglePopupWindow = async () => {
      if (popupFallbackTabId !== null && typeof removeTab === "function") {
        try {
          await removeTab(popupFallbackTabId);
          popupFallbackTabId = null;
          sendResponse({ success: true, mode: "tab-closed" });
          return;
        } catch (error) {
          console.warn("🧑‍🎨: Failed to close popup fallback tab:", error);
          popupFallbackTabId = null;
        }
      }

      if (isPopupWindowOpen) {
        try {
          await browserAPI.runtime.sendMessage({ type: CLOSE_POPUP_WINDOW });
          sendResponse({ success: true, mode: "popup-closed" });
          return;
        } catch (error) {
          const errorMessage = error?.message || String(error);
          if (!errorMessage.includes(NO_RECEIVER_ERROR_TEXT)) throw error;
          console.log("🧑‍🎨: Popup close target was already gone, reopening flow");
          isPopupWindowOpen = false;
        }
      }

      if (typeof openPopup === "function") {
        try {
          await openPopup();
          sendResponse({ success: true, mode: "popup" });
          return;
        } catch (error) {
          console.warn("🧑‍🎨: Failed to open extension popup:", error);
        }
      }

      if (typeof createPopupTab === "function") {
        const createdTab = await createPopupTab({
          url: browserAPI.runtime.getURL(POPUP_PAGE_PATH),
        });
        popupFallbackTabId = createdTab?.id ?? null;
        sendResponse({ success: true, mode: "tab" });
        return;
      }

      sendResponse({
        success: false,
        reason: "Failed to open popup and fallback tab is unavailable",
      });
    };

    togglePopupWindow().catch((error) => {
      console.warn("🧑‍🎨: Failed to open popup fallback tab:", error);
      sendResponse({
        success: false,
        reason: error?.message || String(error),
      });
    });

    return true;
  } else if (message.type === POPUP_WINDOW_OPENED) {
    isPopupWindowOpen = true;
    sendResponse({ success: true });
    return false;
  } else if (message.type === POPUP_WINDOW_CLOSED) {
    isPopupWindowOpen = false;
    sendResponse({ success: true });
    return false;
  }
});

browserAPI.tabs?.onRemoved?.addListener((tabId) => {
  if (tabId !== popupFallbackTabId) return;
  popupFallbackTabId = null;
});
browserAPI.alarms.onAlarm.addListener((alarm) => {
  console.log("🧑‍🎨: Alarm triggered:", alarm.name);
  if (alarm.name === ALARM_ID) {
    browserAPI.notifications.create("charge-ready", {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Mr. Wplace",
      message: "⚡Your painting charge is ready!",
    });
  }
});

// NOTE: tabs権限はOFFにするから、通知クリックでタブを開くのは無理
