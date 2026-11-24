// Nutzung: node themes/dev/shot.js <ausgabeOrdner> [baseUrl]
// Loggt sich als admin/admin1234 ein, prüft das injizierte Theme und
// speichert Screenshots von Login sowie Dateiansicht (hell + dunkel).
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
const base = process.argv[3] || 'http://localhost:8090';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(base + '/login');
  await page.screenshot({ path: `${out}/login.png` });
  await page.fill('input[type="text"], input[name="username"]', 'admin');
  await page.fill('input[type="password"]', 'admin1234');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/files/, { timeout: 15000 });
  await page.waitForTimeout(1500);
  // Willkommensdialog einer frischen Datenbank schließen
  const ack = page.getByRole('button', { name: /acknowledge/i });
  if (await ack.count()) { await ack.first().click(); await page.waitForTimeout(300); }

  const info = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const t = document.getElementById('user-selected-theme');
    return {
      themeChars: t ? t.textContent.trim().length : -1,
      dark: document.documentElement.classList.contains('dark-mode'),
      inlinePrimary: document.documentElement.style.getPropertyValue('--primaryColor'),
      background: css.getPropertyValue('--background').trim(),
      primary: css.getPropertyValue('--primaryColor').trim(),
    };
  });
  console.log(JSON.stringify(info));

  for (const mode of ['dark', 'light']) {
    await page.evaluate((m) => {
      document.documentElement.classList.toggle('dark-mode', m === 'dark');
      document.documentElement.style.colorScheme = m;
    }, mode);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/files-${mode}.png` });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
