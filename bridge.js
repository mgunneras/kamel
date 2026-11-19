// Carries settings between extension storage and content.js.
//
// content.js runs in the page's own JavaScript world (that is where Chrome's
// Translator lives) and cannot reach chrome.storage, so this script passes the
// settings across on attributes of <html>:
//   data-kamel      settings, storage -> page
//   data-kamel-set  a change made in the page (the T key), page -> storage
const DEFAULTS = { on: true, dual: false, size: 100, bg: 70 };
const root = document.documentElement;

async function push() {
  try {
    root.dataset.kamel = JSON.stringify(await chrome.storage.local.get(DEFAULTS));
    document.dispatchEvent(new Event('kamel-settings'));
  } catch {
    // The extension was reloaded or removed while this tab stayed open.
  }
}

document.addEventListener('kamel-set', () => {
  try {
    chrome.storage.local.set(JSON.parse(root.dataset.kamelSet));
  } catch {}
});

chrome.storage.onChanged.addListener(push);
push();
