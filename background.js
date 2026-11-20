// Draws the toolbar icon from the camel emoji, dimmed while translation is off.
// It is drawn here rather than shipped as image files so the repo carries no
// emoji artwork; Chrome uses whatever emoji font the computer has.
async function drawIcon() {
  const { on } = await chrome.storage.local.get({ on: true });
  const imageData = {};
  for (const size of [16, 32, 48]) {
    const ctx = new OffscreenCanvas(size, size).getContext('2d');
    ctx.globalAlpha = on ? 1 : 0.35;
    ctx.font = `${size * 0.85}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐫', size / 2, size / 2 + size * 0.06);
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  await chrome.action.setIcon({ imageData });
}

chrome.runtime.onInstalled.addListener(drawIcon);
chrome.runtime.onStartup.addListener(drawIcon);
chrome.storage.onChanged.addListener((changes) => {
  if ('on' in changes) drawIcon();
});
