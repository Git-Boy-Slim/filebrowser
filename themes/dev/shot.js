// Nutzung: node themes/dev/shot.js <ausgabeOrdner> [themeCss] [loginCss] [nur=name,name]
// Loggt sich als admin/admin1234 ein und speichert Screenshots aller wichtigen
// Ansichten (hell + dunkel, Desktop + Mobil). Ist themeCss angegeben, wird die
// Datei direkt in <style id="user-selected-theme"> injiziert – so sieht man
// Änderungen ohne Server-Neustart. loginCss wird zusätzlich auf jeder Seite
// injiziert (entspricht customCSS).
const fs = require('fs');
const { chromium } = require('playwright');
const [out = '.', themeFile, loginFile, onlyArg] = process.argv.slice(2);
const base = process.env.BASE || 'http://localhost:8090';
const only = onlyArg ? onlyArg.split(',') : null;
const want = (n) => !only || only.some((o) => n.startsWith(o));
const themeCss = themeFile && themeFile !== '-' ? fs.readFileSync(themeFile, 'utf8') : null;
const loginCss = loginFile && loginFile !== '-' ? fs.readFileSync(loginFile, 'utf8') : null;

async function inject(page) {
  await page.evaluate(([t, l]) => {
    if (t !== null) {
      let el = document.getElementById('user-selected-theme');
      if (!el) { el = document.createElement('style'); el.id = 'user-selected-theme'; document.body.appendChild(el); }
      el.textContent = t;
    }
    if (l !== null) {
      let el = document.getElementById('dev-custom-css');
      if (!el) { el = document.createElement('style'); el.id = 'dev-custom-css'; document.body.insertBefore(el, document.getElementById('user-selected-theme')); }
      el.textContent = l;
    }
  }, [themeCss, loginCss]);
}

async function setMode(page, dark) {
  await page.evaluate((d) => {
    document.documentElement.classList.toggle('dark-mode', d);
    document.documentElement.style.colorScheme = d ? 'dark' : 'light';
  }, dark);
}

async function patchUser(page, data) {
  await page.evaluate(async (d) => {
    await fetch('/api/users?username=admin', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ which: Object.keys(d), data: d }),
    });
    // Die App cached den Modus pro Nutzer in localStorage
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('ViewMode_') && d.viewMode) localStorage.setItem(k, d.viewMode);
      if (k.startsWith('GallerySize_') && d.gallerySize) localStorage.setItem(k, String(d.gallerySize));
    }
    localStorage.removeItem('displayPreferences');
  }, data);
}

async function snap(page, name, url, opts = {}) {
  if (!want(name)) return;
  if (url) { await page.goto(base + url); await page.waitForTimeout(1200); }
  await inject(page);
  const ack = page.getByRole('button', { name: /acknowledge/i });
  if (await ack.count()) { await ack.first().click(); await page.waitForTimeout(300); }
  if (opts.before) await opts.before(page);
  for (const mode of opts.modes || ['light', 'dark']) {
    await setMode(page, mode === 'dark');
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${out}/${name}-${mode}.png`, fullPage: !!opts.full });
  }
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(base + '/login');
  await page.waitForTimeout(800);
  await snap(page, 'login', null);
  await page.fill('input[type="text"], input[name="username"]', 'admin');
  await page.fill('input[type="password"]', 'admin1234');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/files/, { timeout: 15000 });
  await page.waitForTimeout(1000);

  for (const [mode, size] of [['normal', 3], ['list', 5], ['compact', 3], ['gallery', 6], ['icons', 4]]) {
    if (!want('files-' + mode) && !want('mobile-' + mode)) continue;
    await patchUser(page, { viewMode: mode, gallerySize: size });
    await snap(page, 'files-' + mode, '/files/');
    if (want('scroll-' + mode)) {
      await snap(page, 'scroll-' + mode, null, {
        before: async (p) => { await p.mouse.move(1260, 300); await p.mouse.wheel(0, 300); await p.waitForTimeout(300); },
      });
    }
  }
  await patchUser(page, { viewMode: 'normal', gallerySize: 3 });

  await snap(page, 'settings-profile', '/settings#profile-main', { full: false });
  await snap(page, 'settings-profile-full', '/settings#profile-main', { full: true, modes: ['light'] });

  // Mobil
  const mctx = await browser.newContext({ ...require('playwright').devices['iPhone 13'] });
  await mctx.addCookies(await ctx.cookies());
  const m = await mctx.newPage();
  for (const [mode, size] of [['normal', 3], ['list', 5], ['gallery', 6]]) {
    if (!want('mobile-' + mode)) continue;
    await m.goto(base + '/files/');
    await patchUser(m, { viewMode: mode, gallerySize: size });
    await snap(m, 'mobile-' + mode, '/files/');
  }
  await patchUser(page, { viewMode: 'normal', gallerySize: 3 });
  await snap(m, 'mobile-settings', '/settings#profile-main');

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
