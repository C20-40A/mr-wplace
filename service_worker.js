console.log("🧑‍🎨: service_worker.js loaded");

chrome.alarms.onAlarm.addListener((alarm) => {
  console.log("🧑‍🎨: Alarm triggered:", alarm.name);
  if (alarm.name === 'charge-check') {
    checkChargeAndNotify();
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  console.log("🧑‍🎨: Notification clicked:", notificationId);
  if (notificationId === 'charge-ready') {
    chrome.tabs.create({ url: 'https://wplace.live/' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CHARGE_MONITOR') {
    createChargeAlarm();
  } else if (message.type === 'STOP_CHARGE_MONITOR') {
    cancelChargeAlarm();
  }
});

function checkChargeAndNotify() {
  chrome.tabs.query({ url: 'https://wplace.live/*' }, (tabs) => {
    if (tabs.length === 0) return;
    
    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_CHARGE_DATA' }, (response) => {
      if (response?.chargeData) {
        const current = response.chargeData.current;
        const max = response.chargeData.max;
        const percentage = Math.round((current / max) * 100);
        
        if (percentage >= 80) { // 固定値80%
          chrome.notifications.create('charge-ready', {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Mr. Wplace - Charge Ready!',
            message: `Charge: ${current}/${max} (${percentage}%)`
          });
        }
      }
    });
  });
}

function createChargeAlarm() {
  chrome.alarms.create('charge-check', {
    delayInMinutes: 1,
    periodInMinutes: 1
  });
  console.log("🧑‍🎨: Charge monitor started");
}

function cancelChargeAlarm() {
  chrome.alarms.clear('charge-check');
  console.log("🧑‍🎨: Charge monitor stopped");
}
