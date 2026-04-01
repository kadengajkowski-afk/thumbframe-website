/**
 * CORS Tainted Canvas Diagnostic
 *
 * Loads a cross-origin image onto a <canvas> WITHOUT crossOrigin="anonymous"
 * and attempts canvas.toDataURL() to reproduce the SecurityError.
 */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Users/marel/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));

  // Use a known cross-origin image (Supabase storage pattern)
  const testUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png';

  const result = await page.evaluate(async (src) => {
    const results = { withoutCORS: null, withCORS: null };

    // TEST 1: WITHOUT crossOrigin — should fail with SecurityError
    try {
      const img1 = new Image();
      await new Promise((resolve, reject) => {
        img1.onload = resolve;
        img1.onerror = () => reject(new Error('Image failed to load'));
        img1.src = src;
      });
      const c1 = document.createElement('canvas');
      c1.width = img1.width; c1.height = img1.height;
      c1.getContext('2d').drawImage(img1, 0, 0);
      const data = c1.toDataURL('image/png');
      results.withoutCORS = `OK (${data.length} chars)`;
    } catch (err) {
      results.withoutCORS = `${err.name}: ${err.message}`;
    }

    // TEST 2: WITH crossOrigin="anonymous" — should succeed
    try {
      const img2 = new Image();
      img2.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img2.onload = resolve;
        img2.onerror = () => reject(new Error('Image failed to load'));
        img2.src = src;
      });
      const c2 = document.createElement('canvas');
      c2.width = img2.width; c2.height = img2.height;
      c2.getContext('2d').drawImage(img2, 0, 0);
      const data = c2.toDataURL('image/png');
      results.withCORS = `OK (${data.length} chars)`;
    } catch (err) {
      results.withCORS = `${err.name}: ${err.message}`;
    }

    return results;
  }, testUrl);

  console.log('\n=== CORS TAINTED CANVAS DIAGNOSTIC ===');
  console.log(`Test image: cross-origin PNG`);
  console.log(`WITHOUT crossOrigin: ${result.withoutCORS}`);
  console.log(`WITH    crossOrigin: ${result.withCORS}`);
  console.log('======================================\n');

  if (result.withoutCORS.includes('SecurityError')) {
    console.log('CONFIRMED: Canvas is tainted without crossOrigin="anonymous".');
    console.log('FIX: Every new Image() loading external URLs must set img.crossOrigin = "anonymous" BEFORE img.src.');
  }

  await browser.close();
})();
