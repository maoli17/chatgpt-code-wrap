const versionDisplay = document.getElementById('version-display');

if (versionDisplay) {
  versionDisplay.textContent = 'v' + chrome.runtime.getManifest().version;
}
