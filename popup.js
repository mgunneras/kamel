const DEFAULTS = { on: true, dual: false, size: 100, bg: 70 };
const $ = (id) => document.getElementById(id);

function show(s) {
  $('on').checked = s.on;
  $('dual').checked = s.dual;
  $('dual').disabled = !s.on;
  $('size').value = s.size;
  $('bg').value = s.bg;
  $('sizeOut').textContent = s.size + '%';
  $('bgOut').textContent = s.bg + '%';
}

const load = async () => show(await chrome.storage.local.get(DEFAULTS));

for (const id of ['on', 'dual']) {
  $(id).addEventListener('change', (e) => chrome.storage.local.set({ [id]: e.target.checked }));
}
for (const id of ['size', 'bg']) {
  $(id).addEventListener('input', (e) => chrome.storage.local.set({ [id]: Number(e.target.value) }));
}

// Also reflects the T key being pressed while the pane is open.
chrome.storage.onChanged.addListener(load);
load();

(async () => {
  const messages = {
    available: 'Translator ready (runs on this computer).',
    downloadable: 'Chrome will download Swedish the first time you click on the player page.',
    downloading: 'Chrome is downloading the Swedish language pack.',
    unavailable: 'This Chrome cannot translate Swedish to English on-device.',
  };
  let state = 'unavailable';
  try {
    state = await Translator.availability({ sourceLanguage: 'sv', targetLanguage: 'en' });
  } catch {}
  $('status').textContent = messages[state] || messages.unavailable;
})();
