# Karpathy Behavioral Guidelines (MANDATORY)

> [!IMPORTANT]
> **MANDATORY PRE-EXECUTION INVARIANT**
> Before executing any task, user request, or touching any code, ALWAYS read, internalize, and strictly follow these 4 Karpathy behavioral principles.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Accrual (formerly Trouvaille) Architectural & Design Rules

## 1. Iconography & Visual Aesthetics Rule (STRICT)

> [!IMPORTANT]
> **NO NATIVE COLORED SYSTEM EMOJIS IN THE UI**
> Under no circumstances should native system colored emojis (e.g. 📊, ⚡, 🗓️, 🎯, 🔔, ⏱️, 🥧, 📈, 👥, 📱, etc.) be used as UI icons, dashboard widgets, modal toggles, button icons, or navigation items.

### Icon Guidelines:

- **Vector Icons Only**: Strictly use vector outline/duotone icons from `lucide-react`.
- **Stroke & Scale**: Standard stroke width is `strokeWidth={1.5}` or `strokeWidth={1.75}` with dimensions `14px` to `18px`.
- **Theme Variables**: Icons must inherit theme color variables (`var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`) or be housed inside frosted squircle containers (`var(--glass-fill)` with `1px solid var(--glass-border)`).
- **Category Exceptions**: Emoji characters are permissible ONLY as user-customizable category avatars via `IconRenderer`, never as hardcoded application controls.

---

## 2. Monochrome Apple Luxury Theme System

- **Palette**: Strictly monochrome luxury glassmorphism.
  - **Dark Mode**: Deep obsidian `#09090c` / `#121214` with frosted white glass borders and accents.
  - **Light Mode**: Clean alabaster smoke `#f4f4f7` / `#ffffff` with matte black and translucent charcoal accents.
  - No vibrant rainbow accents (e.g. bright purple, neon green, orange) on core controls unless representing positive financial inflow (`var(--accent)`).
- **Typography**: Strictly geometric sans-serif (`Urbanist`). Avoid overly bold weights; prefer clean `font-medium`, `font-semibold`, and `font-light` with refined letter spacing.
- **Glassmorphism**: Use backdrop blur (`backdrop-blur-xl`, `backdrop-blur-2xl`), subtle borders (`var(--glass-border)`), and soft elevation shadows (`var(--shadow-card)`).

---

## 3. Modal & Customization Settings Layout Rule (STRICT)

- **Hierarchy Structure**:
  - Top Line: Feature Name (`text-[13px] font-semibold text-[var(--text-primary)]`).
  - Second Line: Concise functional description (`text-[11px] text-[var(--text-tertiary)]`).
  - Far Right: High-contrast Apple iOS toggle switch (`w-10 h-5.5` with `w-4.5 h-4.5` knob).
- **Active & Hover Aesthetics**:
  - Do NOT use harsh, thick, stark white outlines on active states.
  - Active ('on') states must use soft ambient frosted glass (`bg-white/[0.05] border border-white/14` with subtle inner hairline glow `inset 0 1px 0 rgba(255,255,255,0.08)` in dark mode, and soft subtle elevation in light mode).
  - Off states must be gently dimmed (`opacity: 0.6`) so active items stand out gracefully.
- **Dynamic Notch, Dynamic Island & Floating Flyouts (STRICT)**:
  - NEVER use hardcoded top positions (e.g. `top-[24px]`) on `fixed` floating elements, flyouts, capsules, or status bars. The iPhone notch / Dynamic Island and status bar extend ~47px from top, which causes hardcoded top coordinates to collide directly with the camera notch and clock.
  - Floating capsules and top modals MUST compute vertical placement dynamically:
    `style={{ top: "max(calc(env(safe-area-inset-top, 0px) + 18px), 28px)" }}` paired with `left-4 right-4 max-w-md mx-auto` to center and clear all hardware cutouts cleanly across all device form factors.

---

## 4. Supabase Database & Schema Migration Rule (STRICT)

> [!IMPORTANT]
> **EXPLICIT SCHEMA NOTIFICATION & SQL INJECTION WORKFLOW**
> Whenever a new feature, data persistence layer, or refactoring requires a new Supabase table, new column, enum, index, or Row Level Security (RLS) policy, the AI must NEVER assume migrations run automatically in the cloud.

### Migration Guidelines:

- **Immediate User Notification**: The AI must proactively and explicitly inform the user whenever any database schema change is needed so that the user can inject it into the Supabase SQL Editor.
- **Provide Ready-to-Run SQL**:
  - Always write an idempotent `.sql` script in `supabase/migrations/` (using `IF NOT EXISTS`, safe column alter checks, indexes, and user-scoped RLS policies).
  - Always provide the full, ready-to-run SQL code block directly in the chat response with copy-paste instructions for the Supabase Dashboard SQL Editor.
- **Graceful Offline / Local Fallbacks**: The frontend code must always include resilient offline/local caching or fallbacks (e.g. `localStorage` or default fallbacks) so the application remains fully functional without crashing even before the user executes the SQL script in Supabase.

---

## 5. Bottom Sheet & Sliding Panel Architecture Rule (STRICT)

> [!IMPORTANT]
> **NO ARTIFICIAL INNER HEIGHT RESTRICTIONS (`max-h-[55vh]`, `max-h-[50vh]`, ETC.) IN BOTTOM SHEETS**
> Under no circumstances should inner contents or grids inside `BottomSheet` or bottom-sliding panels have arbitrary low height caps (such as `max-h-[55vh]`, `max-h-[52vh]`, `max-h-[60vh]`, `max-h-[340px]`) with inner `overflow-y-auto`.

### Architecture & Sizing Guidelines:

- **Single Unified Scroll Container**:
  - The parent `BottomSheet` component already manages `maxHeight: "92dvh"` and provides a single, smoothly decelerated scroll container (`min-h-0 flex-1 overflow-y-auto`).
  - Child components must NOT introduce nested scrollbars (`overflow-y-auto`) or artificial height caps (`max-h-[55vh]`) that cut the sheet off halfway up the screen. Children must render with natural vertical flow or `flex-1` so the sheet expands smoothly up to 92dvh.
- **Zero Bottom Cutoffs & iOS Home Indicator Inset**:
  - All bottom sheets and bottom-docked modals must always respect the iOS home swipe bar by enforcing a generous bottom inset:
    `paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 12px), 24px)"` (or `pb-[max(calc(env(safe-area-inset-bottom,0px)+12px),20px)]`).
  - The bottommost action buttons, pills, or cards must never be clipped, obstructed, or placed flush against the bottom edge of mobile displays.

---

## 6. Strict Non-Mixed Localization Rule (STRICT)

> [!IMPORTANT]
> **ZERO BILINGUAL MIXING ("NO GADO-GADO" LOCALIZATION)**
> The application must be 100% pure Indonesian when `isIndonesian === true` and 100% pure English when `isIndonesian === false`.

### Localization Guidelines:
- **No Mixed Phrasing**: Never mix English terms into Indonesian sentences or badges (e.g. DO NOT write "Pintasan Back Tap (Glass UI)", "1-Tap", "Setup", "Auto", "Number", "Text", "presets", "Done" alongside Indonesian text).
- **No Parenthetical Bilingual Translations**: Do NOT write dual-language parenthetical phrases inside sentences such as "Ganti Nama (Rename)", "Pisahkan Teks (Split Text)", "Nominal (Amount)", "Enkode URL (URL Encode)". Cleanly branch the entire sentence so Indonesian uses 100% natural Indonesian and English uses 100% natural English.
- **Tutorials & Step-by-Step Instructions**:
  - When `isIndonesian === true`, use the official Indonesian Apple iOS interface terminology (e.g., *Pintasan*, *Minta Masukan*, *Teks*, *Pisahkan Teks*, *Pilih dari Daftar*, *Buka URL*, *Enkode URL*, *Tampilkan Pemberitahuan*, *Ganti Nama*). Never inject English prepositions or terms like "by New Lines", "prompt:", "action", or "add item" into Indonesian sentences.
  - When `isIndonesian === false`, use native English Apple iOS interface terminology throughout (e.g., *Shortcuts*, *Ask for Input*, *Text*, *Split Text*, *Choose from List*, *Open URLs*, *URL Encode*, *Show Notification*, *Rename*).
- **Comprehensive Conditional Branching**: Every user-facing string, pill label, button, modal title, placeholder, tooltip, and instructional step MUST conditionally branch:
  `{isIndonesian ? "Terjemahan Bahasa Indonesia Baku" : "Pure English Formulation"}`
- **Standardized Terminology**:
  - *Shortcuts*: Pintasan
  - *Presets*: Preset bawaan / Preset tersimpan
  - *Number*: Angka / Nominal
  - *Text*: Teks / Catatan
  - *Done*: Selesai
  - *Setup*: Atur / Konfigurasi
  - *1-Tap*: 1-Ketukan
  - *Auto*: Otomatis
  - *Voice*: Suara / Dikte
  - *Ways to Add*: Metode Pencatatan
  - *Action*: Tindakan
  - *Rename*: Ganti Nama
  - *Choose from List*: Pilih dari Daftar
  - *Split Text*: Pisahkan Teks
  - *Ask for Input*: Minta Masukan
  - *Open URLs*: Buka URL
  - *URL Encode*: Enkode URL
  - *Show Notification*: Tampilkan Pemberitahuan

---

## 7. Strict Monochrome Luxury Color Invariant (STRICT)

> [!IMPORTANT]
> **NO VIBRANT / RAINBOW COLORS (NO EMERALD, AMBER, BLUE, PURPLE, ORANGE) IN UI CONTROLS & MODALS**
> UI controls, icons, checkmarks, badges, status pills, and instructional text MUST remain strictly monochrome luxury glassmorphism.

### Palette Guidelines:
- **Zero Colored Utility Classes**: Never use `text-emerald-500`, `text-amber-500`, `text-blue-500`, `bg-emerald-500`, `text-yellow-500`, etc., for icons, checkmarks, buttons, step numbers, or badges.
- **Monochrome Success & Status**: Success checkmarks must inherit `text-[var(--text-primary)]`, `text-white`, or `text-zinc-400`.
- **System Variables Only**: All elements must use `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`, `var(--glass-border)`, and `var(--glass-fill)`.
- **Sole Exception**: Positive financial inflow in cashflow charts / balance metrics (`var(--accent)`), never on buttons, icons, or badges in setting sheets.

---

## 8. Master Rulebook Linkage (STRICT)

> [!IMPORTANT]
> **CANONICAL REFERENCE: `ACCRUAL_RULES.md` & `ACCRUAL_WHITEPAPER.md`**
> For the exhaustive, unified specification governing UI aesthetics, UX ergonomics, Statement & Ingestion parsing, Full ISO timestamps, Session Teardown, and Financial Report Exports, always adhere strictly to [ACCRUAL_RULES.md](file:///d:/Project/Trouvaille/ACCRUAL_RULES.md) and [ACCRUAL_WHITEPAPER.md](file:///d:/Project/Trouvaille/ACCRUAL_WHITEPAPER.md).

### 8.1 Ingestion & Statement Parser Invariants:
- Header row auto-discovery: Scan rows 0 to 10 for table header tokens.
- Arrow Transfer Splitting: Parse `A → B` into source and destination wallets and set type to `'transfer'`. Missing wallets must be auto-created.
- Category Synthesis: Custom categories must be assigned semantic monochrome vector icons via `resolveCategoryVectorIcon()`, never emojis.
- Full ISO Timestamps: `occurred_on` must always include full date and time (`YYYY-MM-DDTHH:mm:ss`), resolving Excel fractional serials.
- Placeholder Note Sanitization: Convert `"-"`, `"--"` to clean empty strings `""`.

### 8.2 Session Teardown & Multi-Tenant Isolation Invariants:
- On logout or guest session switch, wipe all user tenant storage (`trouvaille_usdt_*`, `trouvaille_holdings_*`, `trouvaille_market_quotes_*`, etc.).
- Never auto-rescue cross-session assets into a clean guest or new account.

### 8.3 Financial Report Export Invariants:
- Neraca (Balance Sheet) must list EVERY active user account and holding without truncation or `+account` placeholders.

---

## 9. Web Repository Isolation & No Unsolicited Sync Rule (STRICT)

> [!IMPORTANT]
> **NO AUTOMATIC CONFIGURATION OR CODE TRANSFER TO `trouvaille-web` WITHOUT EXPLICIT USER CONFIRMATION**
> Under no circumstances should the AI automatically port, sync, configure, or apply changes from the mobile repository (`Trouvaille`) to the web repository (`trouvaille-web`) without prior explicit knowledge and direct confirmation from the user.

### Isolation Guidelines:
- **Multi-Session Independence**: The web version (`trouvaille-web`) is developed in its own dedicated sessions or by other AI agents. Unsolicited modifications break work-in-progress, produce merge conflicts, and cause confusion across sessions.
- **Strict Mobile Focus**: Unless the user explicitly issues a command targeting the web repository in that specific prompt, all changes, fixes, and features must remain strictly contained within the mobile codebase (`Trouvaille`).
- **Never Assume Parity**: Do NOT assume mobile components, sheets, or states can be blindly duplicated to the web without separate planning and explicit confirmation.

---

## 10. Multi-Tenant Session Teardown & Guest-to-Cloud Migration Rule (STRICT)

> [!IMPORTANT]
> **ZERO GUEST DATA LOSS & ABSOLUTE CROSS-TENANT ISOLATION**
> When a guest user transitions to the login page to authenticate or create an account, their offline guest data must NEVER be prematurely wiped. Conversely, on authenticated logout, user tenant keys must be purged completely.

### Session Guidelines:
- **Preserve Guest Migration Data**: When exiting guest mode to navigate to `LoginPage`, set `trouvaille_pending_guest_migration: "true"`. The function `clearPreviousSessionData({ preserveGuestMigrationData: true })` must preserve guest transactions, guest wallets, and guest holdings so the `GuestDataMigrationModal` can present the transfer prompt upon successful sign-in.
- **Tear Down on Clean Logout**: On explicit logout, wipe all user-scoped keys (`trouvaille_usdt_*`, `trouvaille_holdings_*`, `trouvaille_market_quotes_*`, `trouvaille_transactions_*`, `trouvaille_wallets_*`).
- **Complete Discard on User Request**: When the user explicitly declines guest migration via `discardGuestData()`, purge `TX_BACKUP_STORAGE_KEY`, `WALLETS_BACKUP_STORAGE_KEY` (`TROUVAILLE_WALLETS_BACKUP_V1`), guest preferences, and pending guest mutations so zero phantom records survive.

---

## 11. Transaction Timestamps, Ledger Reconciliation & Math Invariants (STRICT)

> [!IMPORTANT]
> **FULL ISO TIMESTAMPS & DOUBLE-ENTRY LEDGER RECONCILIATION**
> Every transaction record must adhere to strict mathematical and ledger invariants.

### Ledger & Math Guidelines:
- **Full ISO Timestamps**: `occurred_on` must NEVER be date-only `YYYY-MM-DD`. It MUST always be a full ISO timestamp `YYYY-MM-DDTHH:mm:ss`. Kueri filter tanggal harus menggunakan normalisasi `(t.occurred_on || "").slice(0, 10)` atau batas atas `${endStr}T23:59:59.999Z` agar transaksi di akhir hari/bulan selalu terhitung.
- **Pure Operational Cashflow Filtering**: Transaksi buatan Saldo Awal (`isOpeningBalanceTx`) dan Penyesuaian Saldo (`isCorrectionTx` mencakup `"correction"`, `"koreksi saldo"`, `"penyesuaian saldo"`, `"balance adjustment"`) dilarang keras merusak arus kas operasional harian, landasan runway kalender, atau rata-rata belanja bulanan.
- **Asset Buy/Sell Double-Entry Ledger**:
  - Penambahan aset (Beli) atau likuidasi parsial/penuh (Jual) pada `AssetDetailSheet` dan `AssetValuationSheet` wajib menyediakan opsi pemilihan dompet sumber/tujuan dan kategori transaksi.
  - Transaksi mutasi kas yang dihasilkan wajib dicatat via `useAddTransaction` dan langsung ditandai ke `markTransactionReconciled` agar saldo dompet terpotong/bertambah secara akurat tanpa terhitung ganda oleh `holdingSyncEngine`.
- **Transfer Sanity Guard**: Dompet sumber dan dompet tujuan transfer dilarang keras sama (`walletId !== toWalletId`). Validasi harus memblokir penyimpanan dan menampilkan notifikasi kesalahan.
- **Number Parsing Across Locales**: Gunakan `parseCleanNumber` untuk membedakan pemisah ribuan titik pada IDR (`100.000`) dan koma pada USD (`79,839.00`). Hindari `parseFloat` mentah pada string yang telah diformat.

---

## 12. Biometric PIN Security & Variable Digit Length (STRICT)

> [!IMPORTANT]
> **DYNAMIC PIN LENGTH (4, 5, 6 DIGITS) WITH ZERO FALSE LOCKOUTS**
> Sistem keamanan PIN harus menghormati panjang PIN tersimpan tanpa menghukum masukan digit yang belum lengkap.

### PIN Security Guidelines:
- **Stored `pinLength`**: Saat PIN dibuat atau diubah via `setSecurityPin`, simpan `pinLength` (`4 | 5 | 6`) di dalam pengaturan keamanan.
- **No False Failed Attempts**: `verifySecurityPin` tidak boleh menambah hitungan kegagalan (`attempts`) atau memicu lockout selama jumlah digit masukan pengguna belum mencapai `pinLength` yang sebenarnya.
- **Graceful Lockout**: Lockout hanya aktif setelah 5 kali kesalahan input PIN lengkap, dengan timer hitung mundur yang jelas dan sinkron ke seluruh sesi.

---

## 13. Subscription Resilience & StoreKit 2 Reconciliation (STRICT)

> [!IMPORTANT]
> **NO STALE CLOSURES ON RESTORE & LIFETIME ENTITLEMENT RECOGNITION**
> Penanganan status langganan RevenueCat / StoreKit 2 harus bebas dari stale closure dan secara akurat mengenali paket seumur hidup (Lifetime).

### Subscription Guidelines:
- **Instant Boolean Return on Restore**: `restorePurchases` di dalam `SubscriptionContext` harus mengembalikan boolean langsung dari hasil sinkronisasi cloud (`syncCloudSubscription()`), bukan membaca state React yang belum diperbarui.
- **Active Entitlement Resolution**: `extractEntitlementStatus` wajib memprioritaskan entitlement `accrual_pro` sebelum fallback ke kunci entitlement aktif lainnya.
- **Lifetime Package Handling**: Paket seumur hidup (`accrual_lifetime_499k` / `is_lifetime === true`) wajib memiliki `currentPeriodEnd: null` dan `isLifetime: true` tanpa menampilkan tanggal kedaluwarsa semu.
- **Session Purge Sync**: Saat event `trouvaille:session-cleared` dipancarkan pada saat logout, state langganan lokal harus segera dibersihkan ke status gratis (`isPro: false`).
