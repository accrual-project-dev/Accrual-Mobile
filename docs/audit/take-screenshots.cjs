const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const viewports = [
  { name: 'mobile_375px', width: 375, height: 812 },
  { name: 'tablet_768px', width: 768, height: 1024 },
  { name: 'desktop_1440px', width: 1440, height: 900 },
];

const routes = [
  { path: '/', name: 'home' },
  { path: '/transactions', name: 'transactions' },
  { path: '/calendar', name: 'calendar' },
  { path: '/statistics', name: 'statistics' },
  { path: '/assets', name: 'assets' },
  { path: '/settings', name: 'settings' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  // 1. Capture Login Page at 3 viewports before login
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const ssPath = path.join(outDir, `login_${vp.name}.png`);
    await page.screenshot({ path: ssPath, fullPage: false });
    console.log(`Saved: ${ssPath}`);
    await context.close();
  }

  // 2. Capture Authenticated / Guest app pages
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    
    // Set localStorage before navigating
    await context.addInitScript(() => {
      localStorage.setItem('trouvaille_guest_mode', 'true');
      localStorage.setItem('trouvaille_onboarded', 'true');
      localStorage.setItem('trouvaille_onboarding_focus', 'cashflow');
      localStorage.setItem('trouvaille_tour_pending', 'false');
      localStorage.setItem('trouvaille_tour_completed_v1', 'true');
      localStorage.setItem('trouvaille_theme', 'dark');
      localStorage.setItem('trouvaille_preferred_currency', 'IDR');
    });

    const page = await context.newPage();
    
    for (const route of routes) {
      const url = `http://localhost:5174${route.path}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      
      const ssPath = path.join(outDir, `${route.name}_${vp.name}.png`);
      await page.screenshot({ path: ssPath, fullPage: false });
      console.log(`Saved: ${ssPath}`);
    }
    
    await context.close();
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
})().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
