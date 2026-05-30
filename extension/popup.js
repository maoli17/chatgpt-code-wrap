const versionDisplay = document.getElementById('version-display');
const autoWrapToggle = document.getElementById('auto-wrap-toggle');
const DEFAULT_WRAP_KEY = 'defaultWrap';

if (versionDisplay) {
  versionDisplay.textContent = 'v' + chrome.runtime.getManifest().version;
}

if (autoWrapToggle) {
  chrome.storage.sync.get({ [DEFAULT_WRAP_KEY]: false }, (settings) => {
    if (chrome.runtime.lastError) return;

    autoWrapToggle.checked = Boolean(settings[DEFAULT_WRAP_KEY]);
  });

  autoWrapToggle.addEventListener('change', () => {
    chrome.storage.sync.set({
      [DEFAULT_WRAP_KEY]: autoWrapToggle.checked,
    });
  });
}
