const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const DIST_DIR = path.resolve(__dirname, "../dist");
const OUTPUT_DIR = path.resolve(__dirname, "../appstore_previews");
const BRAIN_OUTPUT_DIR = path.resolve(
  "C:/Users/afa/.gemini/antigravity/brain/10f08503-207b-4acd-a5da-996f2c194856/appstore_previews"
);

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(BRAIN_OUTPUT_DIR)) fs.mkdirSync(BRAIN_OUTPUT_DIR, { recursive: true });

function startStaticServer(port = 5199) {
  const mimeTypes = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split("?")[0];
    if (reqPath === "/" || !path.extname(reqPath)) {
      reqPath = "/index.html";
    }

    const filePath = path.join(DIST_DIR, reqPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mime = mimeTypes[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      fs.createReadStream(filePath).pipe(res);
    } else {
      const indexPath = path.join(DIST_DIR, "index.html");
      res.writeHead(200, { "Content-Type": "text/html" });
      fs.createReadStream(indexPath).pipe(res);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

async function injectAppleStatusBar(page, isDark = true) {
  await page.evaluate(({ isDark }) => {
    const root = document.getElementById("root");
    if (root) {
      root.style.paddingTop = "52px";
    }

    const existing = document.getElementById("ios-status-bar");
    if (existing) existing.remove();

    const textColor = isDark ? "#ffffff" : "#000000";
    const pillBorder = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)";
    const batteryBorder = isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)";

    const bar = document.createElement("div");
    bar.id = "ios-status-bar";
    bar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 52px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Urbanist", system-ui, sans-serif;
      color: ${textColor};
      user-select: none;
      background: transparent;
    `;

    bar.innerHTML = `
      <!-- Left: 9:41 Time -->
      <div style="font-size: 16px; font-weight: 600; letter-spacing: -0.3px; padding-top: 6px; min-width: 50px;">
        9:41
      </div>

      <!-- Center: Dynamic Island -->
      <div style="
        position: absolute;
        left: 50%;
        top: 10px;
        transform: translateX(-50%);
        width: 125px;
        height: 35px;
        background: #000000;
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 12px;
        box-shadow: 0 0 1px ${pillBorder};
      ">
        <div style="
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #1a1a2e 0%, #08080f 70%, #000000 100%);
          box-shadow: inset 0 0 1px rgba(255, 255, 255, 0.2);
        "></div>
      </div>

      <!-- Right: Cellular, WiFi, Battery -->
      <div style="display: flex; align-items: center; gap: 7px; padding-top: 6px;">
        <!-- Cellular (4 bars) -->
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none" style="display: block;">
          <rect x="0.5" y="8.5" width="3" height="3.5" rx="0.8" fill="${textColor}" />
          <rect x="4.5" y="6" width="3" height="6" rx="0.8" fill="${textColor}" />
          <rect x="8.5" y="3.5" width="3" height="8.5" rx="0.8" fill="${textColor}" />
          <rect x="12.5" y="1" width="3" height="11" rx="0.8" fill="${textColor}" />
        </svg>

        <!-- Wi-Fi (3 curves) -->
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none" style="display: block;">
          <path d="M8.5 10.5C9.05228 10.5 9.5 10.0523 9.5 9.5C9.5 8.94772 9.05228 8.5 8.5 8.5C7.94772 8.5 7.5 8.94772 7.5 9.5C7.5 10.0523 7.94772 10.5 8.5 10.5Z" fill="${textColor}" />
          <path d="M5.5 7.2C6.35 6.45 7.38 6 8.5 6C9.62 6 10.65 6.45 11.5 7.2" stroke="${textColor}" stroke-width="1.6" stroke-linecap="round" />
          <path d="M2.5 4.5C4.15 3.05 6.25 2.2 8.5 2.2C10.75 2.2 12.85 3.05 14.5 4.5" stroke="${textColor}" stroke-width="1.6" stroke-linecap="round" />
        </svg>

        <!-- Battery (Apple Style) -->
        <div style="display: flex; align-items: center; margin-left: 1px;">
          <div style="
            width: 25px;
            height: 12.5px;
            border: 1px solid ${batteryBorder};
            border-radius: 4px;
            padding: 1.5px;
            display: flex;
            align-items: center;
          ">
            <div style="
              width: 100%;
              height: 100%;
              background: ${textColor};
              border-radius: 1.5px;
            "></div>
          </div>
          <div style="
            width: 1.5px;
            height: 4.5px;
            background: ${batteryBorder};
            border-top-right-radius: 1px;
            border-bottom-right-radius: 1px;
            margin-left: 0.5px;
          "></div>
        </div>
      </div>
    `;

    document.body.appendChild(bar);
  }, { isDark });
}

async function captureThemeScreens(browser, PORT, isDark = true) {
  const themeMode = isDark ? "dark" : "light";
  console.log(`\n========================================`);
  console.log(`[Capture] Starting ${themeMode.toUpperCase()} Mode Captures...`);
  console.log(`========================================`);

  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  });

  const page = await context.newPage();

  // Seed guest session directly with selected theme
  await page.addInitScript(({ isDark }) => {
    const wallets = [
      {
        id: "w-chase",
        name: "BCA Prioritas",
        type: "bank",
        balance: 285000000,
        currency: "IDR",
        icon: "landmark",
        user_id: "guest_local_user",
      },
      {
        id: "w-mandiri",
        name: "Mandiri Private",
        type: "bank",
        balance: 340000000,
        currency: "IDR",
        icon: "credit-card",
        user_id: "guest_local_user",
      },
      {
        id: "w-schwab",
        name: "Stockbit & Reksadana",
        type: "investment",
        balance: 170000000,
        currency: "IDR",
        icon: "trending-up",
        user_id: "guest_local_user",
      },
      {
        id: "w-apple",
        name: "GoPay & Cash Vault",
        type: "cash",
        balance: 25000000,
        currency: "IDR",
        icon: "wallet",
        user_id: "guest_local_user",
      },
    ];

    const categories = [
      { id: "c-tech", user_id: "guest_local_user", name: "Technology", type: "expense", emoji: "laptop", is_default: true, created_at: new Date().toISOString() },
      { id: "c-food", user_id: "guest_local_user", name: "Food & Beverage", type: "expense", emoji: "coffee", is_default: true, created_at: new Date().toISOString() },
      { id: "c-transport", user_id: "guest_local_user", name: "Transportation", type: "expense", emoji: "car", is_default: true, created_at: new Date().toISOString() },
      { id: "c-fitness", user_id: "guest_local_user", name: "Health & Fitness", type: "expense", emoji: "dumbbell", is_default: true, created_at: new Date().toISOString() },
      { id: "c-income", user_id: "guest_local_user", name: "Consulting Retainer", type: "income", emoji: "briefcase", is_default: true, created_at: new Date().toISOString() },
    ];

    const transactions = [
      {
        id: "tx-1",
        amount: 1599000,
        type: "expense",
        category_id: "c-tech",
        category_name: "Technology",
        wallet_id: "w-chase",
        wallet_name: "BCA Prioritas",
        note: "Apple Developer Program & Cloud Tools",
        occurred_on: new Date(Date.now() - 3600000 * 2).toISOString(),
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        user_id: "guest_local_user",
      },
      {
        id: "tx-2",
        amount: 85000,
        type: "expense",
        category_id: "c-food",
        category_name: "Food & Beverage",
        wallet_id: "w-apple",
        wallet_name: "GoPay & Cash Vault",
        note: "Artisan Coffee & Croissant",
        occurred_on: new Date(Date.now() - 3600000 * 6).toISOString(),
        created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        user_id: "guest_local_user",
      },
      {
        id: "tx-3",
        amount: 45000000,
        type: "income",
        category_id: "c-income",
        category_name: "Consulting Retainer",
        wallet_id: "w-chase",
        wallet_name: "BCA Prioritas",
        note: "Executive Advisory Retainer",
        occurred_on: new Date(Date.now() - 86400000 * 2).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        user_id: "guest_local_user",
      },
      {
        id: "tx-4",
        amount: 3850000,
        type: "expense",
        category_id: "c-transport",
        category_name: "Transportation",
        wallet_id: "w-chase",
        wallet_name: "BCA Prioritas",
        note: "Garuda Indonesia Business Flight",
        occurred_on: new Date(Date.now() - 86400000 * 3).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        user_id: "guest_local_user",
      },
      {
        id: "tx-5",
        amount: 2450000,
        type: "expense",
        category_id: "c-fitness",
        category_name: "Health & Fitness",
        wallet_id: "w-chase",
        wallet_name: "BCA Prioritas",
        note: "Equinox Executive Membership",
        occurred_on: new Date(Date.now() - 86400000 * 5).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        user_id: "guest_local_user",
      },
      {
        id: "tx-6",
        amount: 450000,
        type: "expense",
        category_id: "c-food",
        category_name: "Food & Beverage",
        wallet_id: "w-chase",
        wallet_name: "BCA Prioritas",
        note: "Fine Dining Tasting Menu",
        occurred_on: new Date(Date.now() - 86400000 * 7).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        user_id: "guest_local_user",
      },
      {
        id: "tx-7",
        amount: 18500000,
        type: "income",
        category_id: "c-income",
        category_name: "Consulting Retainer",
        wallet_id: "w-mandiri",
        wallet_name: "Mandiri Private",
        note: "Quarterly Dividend Distribution",
        occurred_on: new Date(Date.now() - 86400000 * 9).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
        user_id: "guest_local_user",
      },
    ];

    const holdings = [
      {
        id: "h-btc",
        symbol: "BTC",
        name: "Bitcoin",
        asset_type: "crypto",
        units: 0.85,
        avg_buy_price: 920000000,
        current_price: 1085000000,
        currency: "IDR",
        wallet_id: "w-schwab",
      },
      {
        id: "h-bbca",
        symbol: "BBCA",
        name: "Bank Central Asia Tbk",
        asset_type: "stock",
        units: 50000,
        avg_buy_price: 9400,
        current_price: 10450,
        currency: "IDR",
        wallet_id: "w-schwab",
      },
      {
        id: "h-gold",
        symbol: "GOLD",
        name: "Physical Gold 24K Antam",
        asset_type: "gold",
        units: 100,
        avg_buy_price: 1250000,
        current_price: 1485000,
        currency: "IDR",
        wallet_id: "w-apple",
      },
    ];

    const themeVal = isDark ? "dark" : "light";
    localStorage.setItem("theme", themeVal);
    localStorage.setItem("trouvaille_theme", themeVal);
    localStorage.setItem("trouvaille_guest_mode", "true");
    localStorage.setItem("trouvaille_onboarded_guest", "true");
    localStorage.setItem("trouvaille_onboarding_focus", "expenses");
    localStorage.setItem("trouvaille_tour_pending", "false");
    localStorage.setItem("trouvaille_product_tour_completed", "true");
    localStorage.setItem("trouvaille_product_tour_dismissed", "true");
    localStorage.setItem("trouvaille_language", "en");
    localStorage.setItem("trouvaille_preferred_currency", "IDR");
    localStorage.setItem("accrual_preferred_currency", "IDR");
    localStorage.setItem("trouvaille_currency", "IDR");
    localStorage.setItem("TROUVAILLE_CATEGORIES_BACKUP_V1", JSON.stringify(categories));
    localStorage.setItem("TROUVAILLE_WALLETS_BACKUP_V1", JSON.stringify(wallets));
    localStorage.setItem("TROUVAILLE_TX_BACKUP_V1", JSON.stringify(transactions));
    localStorage.setItem("trouvaille_holdings_v1", JSON.stringify(holdings));
    localStorage.setItem("trouvaille_holdings_guest_v1", JSON.stringify(holdings));
    localStorage.setItem("trouvaille_holdings_guest_local_user", JSON.stringify(holdings));
  }, { isDark });

  const screens = [
    {
      baseName: "01_home_dashboard",
      path: "/",
      delay: 2000,
    },
    {
      baseName: "02_transactions_feed",
      path: "/transactions",
      delay: 1500,
    },
    {
      baseName: "03_portfolio_assets",
      path: "/assets",
      delay: 1800,
    },
    {
      baseName: "04_financial_analytics",
      path: "/statistics",
      delay: 2000,
    },
    {
      baseName: "05_shortcuts_presets_hub",
      path: "/settings",
      delay: 1500,
      action: async (p) => {
        const item = p.locator("button:has-text('Shortcuts & Automations'), button:has-text('Pintasan & Otomatisasi')").first();
        if (await item.count() > 0) {
          await item.scrollIntoViewIfNeeded();
          await item.click({ force: true });
          await p.waitForTimeout(1000);
        }
      },
    },
    {
      baseName: "06_monthly_wrapped",
      path: "/statistics",
      delay: 2000,
      action: async (p) => {
        const wrappedBtn = p.locator("section:has-text('Financial Wrapped'), section:has-text('Kilas Balik Finansial')").first();
        if (await wrappedBtn.count() > 0) {
          await wrappedBtn.click({ force: true });
          await p.waitForTimeout(1500);
        }
      },
    },
    {
      baseName: "07_voice_assistant",
      path: "/",
      delay: 1500,
      action: async (p) => {
        await p.evaluate(() => {
          window.dispatchEvent(new CustomEvent("trouvaille:open-voice"));
        });
        await p.waitForTimeout(1200);
      },
    },
  ];

  for (const s of screens) {
    const fullName = `${s.baseName}_${themeMode}`;
    console.log(`[Capture] [${themeMode.toUpperCase()}] Navigating to http://localhost:${PORT}${s.path} (${fullName})...`);
    await page.goto(`http://localhost:${PORT}${s.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(s.delay || 1500);

    if (s.action) {
      await s.action(page);
    }

    // Inject matching iOS Apple Status Bar
    await injectAppleStatusBar(page, isDark);
    await page.waitForTimeout(200);

    const outProject = path.join(OUTPUT_DIR, `${fullName}.png`);
    const outBrain = path.join(BRAIN_OUTPUT_DIR, `${fullName}.png`);

    await page.screenshot({ path: outProject, type: "png" });
    fs.copyFileSync(outProject, outBrain);
    console.log(`[Capture] Saved: ${outProject} (${fs.statSync(outProject).size} bytes)`);

    // If dark, also save alias without suffix for backwards compatibility
    if (isDark) {
      const aliasProject = path.join(OUTPUT_DIR, `${s.baseName}.png`);
      const aliasBrain = path.join(BRAIN_OUTPUT_DIR, `${s.baseName}.png`);
      fs.copyFileSync(outProject, aliasProject);
      fs.copyFileSync(outProject, aliasBrain);
    }
  }

  await context.close();
}

async function run() {
  const PORT = 5199;
  const server = await startStaticServer(PORT);
  console.log(`[Server] Serving dist/ at http://localhost:${PORT}`);

  const browser = await chromium.launch({ headless: true });

  // 1. Capture Dark Mode (Obsidian)
  await captureThemeScreens(browser, PORT, true);

  // 2. Capture Light Mode (Alabaster)
  await captureThemeScreens(browser, PORT, false);

  await browser.close();
  server.close();
  console.log("\n[Done] All Dark & Light mode App Store preview screenshots generated successfully!");
}

run().catch((err) => {
  console.error("[Error] Failed to capture screenshots:", err);
  process.exit(1);
});
