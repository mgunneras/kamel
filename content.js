// Swedish -> English subtitles for TV4 Play.
//
// The player (Shaka) loads subtitle cues about a minute ahead of playback into
// video.textTracks, and draws the current one into #html-subtitles. We translate
// the upcoming cues ahead of time with Chrome's on-device Translator, so the
// English line is already cached when its cue comes up.
(() => {
  if (window.__kamel) return;
  window.__kamel = true;

  const LOOKAHEAD_S = 120;
  const root = document.documentElement;

  const cache = new Map(); // normalised Swedish cue text -> English
  // Settings arrive from bridge.js (see there); these are the defaults.
  let on = true;
  let sizeScale = 1;

  let translator = null;
  let nextCreateAttempt = 0;
  let problem = '';
  let busy = false;
  let shown = null;
  let observed = null;

  const box = document.createElement('div');
  box.className = 'kamel-box';
  const line = box.appendChild(document.createElement('span'));

  const norm = (text) =>
    text.split('\n').map((l) => l.replace(/<[^>]+>/g, '').trim()).filter(Boolean).join('\n');

  const subsContainer = () => document.getElementById('html-subtitles');

  function findVideo() {
    const videos = [...document.querySelectorAll('video')];
    return videos.find((v) => !v.paused) || videos[0] || null;
  }

  function findTrack(video) {
    if (!video) return null;
    return [...video.textTracks].find((t) => t.cues && t.cues.length) || null;
  }

  // What the player is showing right now, in Swedish.
  function currentText() {
    const hs = subsContainer();
    if (hs) {
      return norm([...hs.children].filter((c) => c !== box).map((c) => c.textContent).join('\n'));
    }
    const track = findTrack(findVideo());
    if (!track || !track.activeCues) return '';
    return [...new Set([...track.activeCues].map((c) => norm(c.text)))].join('\n');
  }

  // Next thing worth translating: what is on screen first, then upcoming cues.
  function nextUntranslated() {
    const now = currentText();
    if (now && !cache.has(now)) return now;
    const video = findVideo();
    const track = findTrack(video);
    if (!track) return null;
    const t = video.currentTime;
    for (const cue of track.cues) {
      if (cue.endTime < t - 1) continue;
      if (cue.startTime > t + LOOKAHEAD_S) break;
      const text = norm(cue.text);
      if (text && !cache.has(text)) return text;
    }
    return null;
  }

  async function getTranslator() {
    if (translator) return translator;
    if (!('Translator' in self)) {
      problem = 'This Chrome has no built-in translator (needs Chrome 138 or newer on desktop).';
      return null;
    }
    if (Date.now() < nextCreateAttempt) return null;
    nextCreateAttempt = Date.now() + 3000;
    try {
      translator = await Translator.create({ sourceLanguage: 'sv', targetLanguage: 'en' });
      problem = '';
    } catch (err) {
      // Usually: the language pack still needs downloading, which Chrome only
      // starts after a click or key press on the page. We retry on the next tick.
      problem = 'Translator not ready yet: click the page once to let Chrome download Swedish. (' + err.message + ')';
    }
    return translator;
  }

  async function translateCue(tr, text) {
    const lines = text.split('\n');
    // Two speakers ("-Hej." / "-Hej.") stay on separate lines; a sentence that
    // was just wrapped over two lines is translated as one.
    const parts = lines.length > 1 && lines.every((l) => l.startsWith('-')) ? lines : [lines.join(' ')];
    const out = [];
    for (const part of parts) out.push((await tr.translate(part)).trim());
    return out.join('\n');
  }

  async function pump() {
    if (busy || !on) return;
    busy = true;
    try {
      const tr = await getTranslator();
      if (!tr) return;
      for (let text; on && (text = nextUntranslated()); ) {
        let english = text;
        try {
          english = await translateCue(tr, text);
        } catch {
          translator = null; // session died; a new one is created on the next tick
          break;
        }
        if (cache.size > 5000) cache.clear();
        cache.set(text, english);
        render();
      }
    } finally {
      busy = false;
    }
  }

  function render() {
    const text = on ? currentText() : '';
    const out = text ? cache.get(text) ?? text : '';
    if (out !== shown) {
      shown = out;
      line.textContent = out;
      box.classList.toggle('kamel-has-text', !!out);
    }
    if (text && !cache.has(text)) pump();
  }

  // Keep the box attached and sized. The player re-creates its elements when
  // you change episode, so this runs on a timer rather than once.
  function mount() {
    const video = findVideo();
    const hs = subsContainer();
    const parent = hs || (video && video.parentElement);
    if (!parent) return;
    if (box.parentElement !== parent) parent.appendChild(box);
    box.classList.toggle('kamel-floating', !hs);
    const size = Math.max(14, Math.round(video ? video.clientHeight * 0.045 * sizeScale : 24)) + 'px';
    if (box.style.fontSize !== size) box.style.fontSize = size;

    if (hs && hs !== observed) {
      observer.disconnect();
      observer.observe(hs, { childList: true, subtree: true, characterData: true });
      observed = hs;
    }
    const track = findTrack(video);
    if (track && !track.__kamel) {
      track.__kamel = true;
      track.addEventListener('cuechange', render);
    }
  }

  const observer = new MutationObserver((records) => {
    // Ignore our own writes to the box.
    if (records.some((r) => !box.contains(r.target))) render();
  });

  let toastTimer = 0;
  function toast(message) {
    let el = document.querySelector('.kamel-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'kamel-toast';
    }
    el.textContent = message;
    (document.fullscreenElement || document.body).appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2500);
  }

  function readSettings() {
    let s = {};
    try { s = JSON.parse(root.dataset.kamel || '{}'); } catch {}
    on = s.on !== false;
    sizeScale = (Number.isFinite(s.size) ? s.size : 100) / 100;
    root.classList.toggle('kamel-on', on);
    root.classList.toggle('kamel-dual', !!s.dual);
    root.style.setProperty('--kamel-bg', String((Number.isFinite(s.bg) ? s.bg : 70) / 100));
    mount();
    render();
  }

  function setOn(value) {
    on = value;
    root.classList.toggle('kamel-on', on);
    render();
    // Hand the change to bridge.js so it is saved and the settings pane agrees.
    root.dataset.kamelSet = JSON.stringify({ on });
    document.dispatchEvent(new Event('kamel-set'));
  }

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyT' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const el = e.target;
    if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    setOn(!on);
    toast(on ? (problem || 'English subtitles on') : 'English subtitles off (original shown)');
  }, true);

  document.addEventListener('kamel-settings', readSettings);
  readSettings();
  setInterval(() => {
    try {
      mount();
      render();
      pump();
    } catch (err) {
      console.warn('[kamel]', err);
    }
  }, 500);
})();
