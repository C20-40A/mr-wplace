console.log("🧑‍🎨: service_worker.js loaded");

const ALARM_ID = "mr-wplace-charged";

// NOTE: ここから呼んでいる
// src/features/user-status/ui/notification-modal.ts
const ALARM_MESSAGE_START = "START_CHARGE_ALARM";
const ALARM_MESSAGE_STOP = "STOP_CHARGE_ALARM";

chrome.runtime.onMessage.addListener((message) => {
  console.log("🧑‍🎨: Service worker received message:", message.type);
  if (message.type === ALARM_MESSAGE_START) {
    chrome.alarms.create(ALARM_ID, { when: message.when });
    console.log("🧑‍🎨: Charge alarm created at", message.when);
  } else if (message.type === ALARM_MESSAGE_STOP) {
    chrome.alarms.clear(ALARM_ID);
    console.log("🧑‍🎨: Charge alarm cancelled");
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  console.log("🧑‍🎨: Notification clicked:", notificationId);
  if (notificationId === "charge-ready") {
    chrome.tabs.create({ url: "https://wplace.live/" });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  console.log("🧑‍🎨: Alarm triggered:", alarm.name);
  if (alarm.name === ALARM_ID) {
    chrome.notifications.create("charge-ready", {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Mr. Wplace - Charge Ready!",
      message: "Your painting charge is ready. Click to open Wplace.",
    });
  }
});
