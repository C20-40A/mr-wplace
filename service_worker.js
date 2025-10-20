const browserAPI = typeof browser !== "undefined" ? browser : chrome;

console.log("🧑‍🎨: service_worker.js loaded");

const ALARM_ID = "mr-wplace-charged";

// NOTE: ここから呼んでいる
// src/features/user-status/ui/notification-modal.ts
const ALARM_MESSAGE_START = "START_CHARGE_ALARM";
const ALARM_MESSAGE_STOP = "STOP_CHARGE_ALARM";
const ALARM_MESSAGE_GET_INFO = "GET_ALARM_INFO";

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
  }
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
