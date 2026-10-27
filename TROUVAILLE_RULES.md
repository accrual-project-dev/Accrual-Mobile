# TROUVAILLE CANONICAL ARCHITECTURAL & OPERATIONAL RULES
### The Supreme Engineering, Design & Data Invariant Specification
**Version:** 2.0.0 · **Target Scope:** Mobile (`Trouvaille`) & Web Command Center (`trouvaille-web`)  
**Authority:** DeepMind Agentic Systems & Trouvaille Core Engineering

---

## 1. Iconography & Visual Aesthetics Rules (STRICT)

### 1.1 Zero Native Colored System Emojis
> [!IMPORTANT]
> **ABSOLUTE BAN ON NATIVE COLORED SYSTEM EMOJIS IN THE UI**  
> Under no circumstances should native system colored emojis (e.g. 📊, ⚡, 🗓️, 🎯, 🔔, ⏱️, 🥧, 📈, 👥, 📱, 🏷️, 💸, 🏦, etc.) be used as UI icons, dashboard widgets, modal toggles, button icons, table badges, or navigation items.

- **Vector Icons Only**: Strictly utilize vector outline/duotone icons from `lucide-react`.
- **Stroke & Scale**: Standard stroke width is `strokeWidth={1.5}` or `strokeWidth={1.75}` with dimensions `14px` to `18px` for buttons/badges, and `20px` to `24px` for card heroes.
- **Theme Variables**: All icons must inherit theme color variables (`var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`) or be housed inside frosted squircle containers (`var(--glass-fill)` with `1px solid var(--glass-border)`).
- **Category Synthesis**: When automatically creating categories during statement/excel import or onboarding, assign semantic monochrome vector icons via `resolveCategoryVectorIcon()` in `src/lib/iconRegistry.ts`. Never assign emoji fallbacks.
- **User Customization Exception**: Emoji characters are permissible ONLY if the user explicitly types an emoji as a custom category avatar via `IconRenderer`, never as hardcoded application controls.

---

## 2. Monochrome Apple Luxury Theme & Color Invariants

### 2.1 The Monochromatic Palette
- **Dark Mode (Default Luxury)**: Deep obsidian `#09090c` / `#121214` with frosted white glass borders (`border-white/10` to `border-white/15`) and translucent white glass layers (`bg-white/[0.04]` to `bg-white/[0.08]`).
- **Light Mode (Alabaster Smoke)**: Clean alabaster `#f4f4f7` / `#ffffff` with matte black text and translucent charcoal glass borders (`border-black/10`).
- **Strict Prohibition of Rainbow Accents**: Zero colored utility classes (`text-emerald-500`, `text-amber-500`, `text-blue-500`, `bg-emerald-500`, `text-yellow-500`, `text-purple-500`) on UI controls, checkmarks, step badges, or modal toggles.
- **The Sole Color Exception**: Positive financial cashflow inflow in financial charts or balance net metrics (`var(--accent)`). Never use accent colors on buttons, settings icons, or informational pills.

### 2.2 Typography & Refinement
- **Font Family**: Geometric sans-serif (`Urbanist`).
- **Font Weights**: Prefer clean `font-light`, `font-normal`, `font-medium`, and `font-semibold`. Avoid harsh bold weights (`font-black`, `font-extrabold`).
- **Glassmorphism**: Use backdrop blur (`backdrop-blur-xl`, `backdrop-blur-2xl`), subtle borders (`var(--glass-border)`), and soft elevation shadows (`var(--shadow-card)`).

---

## 3. UI Ergonomics, Safe Areas & Modal Architecture

### 3.1 Dynamic Island & Safe Area Top Insets (STRICT)
> [!IMPORTANT]
> **NO HARDCODED TOP COORDINATES (`top-[24px]`, `top-4`, ETC.) ON FIXED/FLOATING ELEMENTS**  
> Modern iPhones feature hardware cutouts (Dynamic Island / camera notch) extending ~47px from the top. Hardcoded values cause direct collisions with the camera notch and clock.

- **Dynamic Vertical Placement**:
  ```tsx
  style={{ top: "max(calc(env(safe-area-inset-top, 0px) + 18px), 28px)" }}
  ```
- **Horizontal Centering**: Pair with `left-4 right-4 max-w-md mx-auto` to center floating capsules, toasts, and HUD banners cleanly across all device form factors.

### 3.2 Modal & Customization Settings Layout
- **Hierarchy Structure**:
  - Top Line: Feature Name (`text-[13px] font-semibold text-[var(--text-primary)]`).
  - Second Line: Concise functional description (`text-[11px] text-[var(--text-tertiary)]`).
  - Far Right: High-contrast Apple iOS toggle switch (`w-10 h-5.5` with `w-4.5 h-4.5` knob).
- **Active & Hover States**:
  - Do NOT use harsh, thick, stark white outlines on active states.
  - Active ('on') states must use soft ambient frosted glass (`bg-white/[0.05] border border-white/14` with subtle inner hairline glow `inset 0 1px 0 rgba(255,255,255,0.08)` in dark mode).
  - Off states must be gently dimmed (`opacity: 0.6`) so active items stand out gracefully.

---

## 4. Bottom Sheet & Sliding Panel Architecture (STRICT)

### 4.1 No Artificial Inner Height Caps
> [!IMPORTANT]
> **NO ARTIFICIAL INNER HEIGHT RESTRICTIONS (`max-h-[55vh]`, `max-h-[50vh]`, ETC.) IN BOTTOM SHEETS**  
> Under no circumstances should inner contents or grids inside `BottomSheet` or bottom-sliding panels have arbitrary low height caps with inner `overflow-y-auto`.

- **Single Unified Scroll Container**:
  - The parent `BottomSheet` component manages `maxHeight: "92dvh"` and provides a single, smoothly decelerated scroll container (`min-h-0 flex-1 overflow-y-auto`).
  - Child components must NOT introduce nested scrollbars (`overflow-y-auto`) or artificial height caps that cut the sheet off halfway up the screen. Children must render with natural vertical flow or `flex-1`.
- **Zero Bottom Cutoffs & iOS Home Indicator Inset**:
  - All bottom sheets and bottom-docked modals must always respect the iOS home swipe bar by enforcing a generous bottom inset:
    ```tsx
    paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 12px), 24px)"
    ```
  - Bottom action buttons and pills must never be clipped or placed flush against the bottom edge of mobile displays.

---

## 5. Ingestion, Statement & Spreadsheet Parser Rules

### 5.1 Header Row Auto-Discovery
- Financial statements and exported spreadsheets (Excel `.xlsx` / `.xls` or CSV) frequently contain 3 to 7 rows of preliminary metadata (account names, dates of export, legal notices) before the actual table header appears.
- **Scanner Rule**: The parser MUST scan rows 0 through 10 to locate the true header row by matching column semantic tokens:
  - Date: `date`, `tanggal`, `tgl`, `trans date`, `posting date`
  - Time: `time`, `jam`, `waktu`
  - Amount: `amount`, `nominal`, `jumlah`, `debit`, `credit`, `mutasi`
  - Category: `category`, `kategori`, `pos`, `alokasi`
  - Type: `type`, `tipe`, `jenis`, `d/k`, `cr/db`
  - Account: `account`, `akun`, `wallet`, `rekening`, `dompet`
  - Note: `note`, `catatan`, `keterangan`, `deskripsi`, `description`, `narasi`

### 5.2 Transfer Splitting with Arrow Syntax
- Indonesian personal bookkeeping and bank statements often denote transfers between wallets with arrow notation, such as:
  - `BNI → Blu`
  - `ShopeePay → Cash`
  - `Cash → BNI`
  - `BCA -> Mandiri`
  - `Tabungan >> Investasi`
- **Parser Rule**: Whenever an account or description contains an arrow (`→`, `->`, `>>`), the parser MUST:
  1. Split the string into `from_wallet` and `to_wallet`.
  2. Set transaction type to `"transfer"`.
  3. Ensure both wallets exist; if either is missing, automatically provision the missing wallet in local cache and Supabase.

### 5.3 Full Date + Time ISO Resolution
- Statements often separate Date and Time into two columns (e.g. Column `Tanggal`: `01/09/2026`, Column `Jam`: `14:35:00`).
- **Timestamp Rule**: `occurred_on` must NEVER be truncated to date-only `YYYY-MM-DD`. It MUST be a full ISO timestamp `YYYY-MM-DDTHH:mm:ss`.
- **Excel Time Fraction Handling**: In Excel, times are stored as fractional day serials (e.g. `0.607638888888889` -> `14:35:00`). The parser must accurately convert fractional serial days into hours, minutes, and seconds and merge with the base date.

### 5.4 Note Sanitization
- Spreadsheet exports often contain placeholder characters in empty note columns (e.g. `"-"`, `"--"`, `"N/A"`, `"null"`).
- **Sanitizer Rule**: These placeholder characters must automatically be sanitized to clean empty strings `""` before saving.

### 5.5 Automatic Entity Provisioning
- When importing statements:
  - Unrecognized accounts must be created automatically with standard initial balances ($0 / Rp 0) and vector icons.
  - Unrecognized categories must be automatically created and assigned context-aware vector icons via `resolveCategoryVectorIcon()`.

---

## 6. Financial Reporting & Balance Sheet Export Rules

### 6.1 Exhaustive Account Breakdown on Balance Sheets
> [!IMPORTANT]
> **NO TRUNCATED OR AGGREGATED ACCOUNT PLACEHOLDERS (`+account ...`) ON BALANCE SHEETS**

- **Full Ledger Transparency**: Page 1 of the exported Financial Statement (Neraca / Balance Sheet) must explicitly render EVERY active user wallet and holding account with its exact balance.
- **Hierarchical Categorization**: Group accounts cleanly into Liquid Cash / Bank Accounts, E-Wallets, Investments, and Fixed Assets.
- **Monochrome Dossier Styling**: Use high-contrast monochrome PDF rendering (via `jsPDF`), avoiding colored background fills or rainbow badges.

---

## 7. Data Integrity, Schema Migrations & Session Isolation

### 7.1 Single Transaction Schema Invariant
- A transaction is modeled as a unified record:
  - `id`: UUID
  - `user_id`: UUID
  - `amount`: Positive decimal (never negative)
  - `type`: `'income' | 'expense' | 'transfer'`
  - `category`: String
  - `wallet_id`: UUID (source)
  - `to_wallet_id`: UUID (destination, required for transfers)
  - `occurred_on`: Full ISO timestamp (`YYYY-MM-DDTHH:mm:ss`)
  - `note`: String (sanitized)

### 7.2 Session Teardown & Cross-Tenant Isolation (STRICT)
> [!IMPORTANT]
> **ZERO CROSS-TENANT OR GUEST DATA LEAKAGE**

- When a user logs out, switches accounts, or enters Guest Mode:
  - The teardown protocol must purge ALL user-specific local storage keys, specifically:
    - `trouvaille_usdt_*`
    - `trouvaille_holdings_*`
    - `trouvaille_market_quotes_*`
    - `trouvaille_transactions_*`
    - `trouvaille_wallets_*`
  - The application must NEVER perform cross-session auto-rescue of crypto holdings or USDT balances into a new, clean guest session.
  - Guest mode must always start with clean, isolated default categories and zero phantom asset balances.

### 7.3 Supabase Database Migrations
- All SQL scripts in `supabase/migrations/` must be idempotent (`IF NOT EXISTS`, safe column alterations, user-scoped RLS policies).
- The application must always provide local fallbacks (`localStorage` / IndexedDB) so it functions seamlessly even before cloud SQL scripts are executed.

---

## 8. Automated Ingestion Safety: Draft Inbox & Review Drawers

### 8.1 Zero Phantom Deductions
- Transactions ingested via automated channels (Apple Shortcuts Back Tap, clipboard OCR, bank notification webhooks) must NEVER be committed silently into the primary ledger.
- **Review Protocol**:
  - Automated captures must stage in a **Batch Review Drawer** or **Draft Inbox**.
  - Users must have the ability to review, adjust categories/wallets, and tap 'Approve All' or delete unwanted items.
  - Fuzzy duplicate matching (48-hour timestamp + amount window) must highlight potential duplicates with a warning badge.

---

## 9. Strict Non-Mixed Localization Rules (STRICT)

> [!IMPORTANT]
> **ZERO BILINGUAL MIXING ("NO GADO-GADO" LOCALIZATION)**  
> The application must be 100% pure Indonesian when `isIndonesian === true` and 100% pure English when `isIndonesian === false`.

### 9.1 Localization Guidelines
- **No Mixed Phrasing**: Never mix English terms into Indonesian sentences or badges (e.g. DO NOT write "Pintasan Back Tap (Glass UI)", "1-Tap", "Setup", "Auto", "Number", "Text", "presets", "Done" alongside Indonesian text).
- **No Parenthetical Bilingual Translations**: Do NOT write dual-language parenthetical phrases inside sentences such as "Ganti Nama (Rename)", "Pisahkan Teks (Split Text)", "Nominal (Amount)", "Enkode URL (URL Encode)". Cleanly branch the entire sentence so Indonesian uses 100% natural Indonesian and English uses 100% natural English.
- **Comprehensive Conditional Branching**: Every user-facing string, pill label, button, modal title, placeholder, tooltip, and instructional step MUST conditionally branch:
  ```tsx
  {isIndonesian ? "Terjemahan Bahasa Indonesia Baku" : "Pure English Formulation"}
  ```
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

## 10. Web Repository Isolation & Multi-Session Independence (STRICT)

> [!IMPORTANT]
> **NO AUTOMATIC CONFIGURATION OR CODE TRANSFER TO `trouvaille-web` WITHOUT EXPLICIT CONFIRMATION**  
> Under no circumstances should the AI automatically port, copy, sync, configure, or apply changes from the mobile repository (`Trouvaille`) into the web repository (`trouvaille-web`) without prior explicit knowledge and direct confirmation from the user.

### 10.1 Invariants
- **Independent Agent Sessions**: The web workspace (`trouvaille-web`) operates under its own distinct development session, architecture, and agent context. Unsolicited modifications pollute Git staging, create uncoordinated regressions, and break other agent workflows.
- **Strict Boundary**: All mobile enhancements (including assets, sheets, modals, math helpers, and UI refinements) must remain strictly scoped to `Trouvaille`.
- **Explicit Instruction Mandate**: Cross-repo synchronization is strictly prohibited unless the user explicitly prompts: *"sinkronkan ke web"* or *"update web"*, followed by user review and verification before applying.

---

## 11. Multi-Tenant Session Teardown & Guest-to-Cloud Migration Safeguards (STRICT)

> [!IMPORTANT]
> **ZERO GUEST DATA LOSS & UNCOMPROMISING CROSS-TENANT PURGE**  
> Guest sessions must transition seamlessly into authenticated cloud accounts without premature data loss, while authenticated sessions must purge cleanly on teardown.

### 11.1 Migration Invariants
- **Preserve Flag on Guest Exit**: When a user transitions from Guest Mode to `LoginPage`, set `trouvaille_pending_guest_migration: "true"`. Calling `clearPreviousSessionData({ preserveGuestMigrationData: true })` must leave guest transactions (`trouvaille_transactions_backup`), guest wallets (`TROUVAILLE_WALLETS_BACKUP_V1`), and guest holdings untouched until `GuestDataMigrationModal` executes.
- **Full Teardown on Account Logout**: Explicit logout must immediately purge all user-scoped storage keys (`trouvaille_usdt_*`, `trouvaille_holdings_*`, `trouvaille_market_quotes_*`, `trouvaille_transactions_*`, `trouvaille_wallets_*`).
- **Complete Guest Discard**: Calling `discardGuestData()` must wipe `TX_BACKUP_STORAGE_KEY`, `WALLETS_BACKUP_STORAGE_KEY`, guest preferences, and pending guest mutations so zero orphaned records remain.

---

## 12. Full ISO Timestamps, Ledger Reconciliation & Double-Entry Math Invariants (STRICT)

> [!IMPORTANT]
> **STRICT TIMESTAMP FORMATTING & DUAL-ENTRY RECONCILIATION**

### 12.1 Timestamp & Cashflow Invariants
- **Full ISO Timestamp**: `occurred_on` must always adhere to `YYYY-MM-DDTHH:mm:ss`. Date-only filtering must normalize with `(t.occurred_on || "").slice(0, 10)` or end-of-day bounds `${endStr}T23:59:59.999Z`.
- **Pure Operational Cashflow**: `isOpeningBalanceTx` (Saldo Awal) and `isCorrectionTx` (Koreksi/Penyesuaian Saldo) must be excluded from operational burn rates, calendar runways, and monthly expense metrics.
- **Asset Buy/Sell Double-Entry**: Buying or liquidating assets in `AssetDetailSheet` or `AssetValuationSheet` must allow selecting the source/destination wallet and category, and must register a cash transaction with `markTransactionReconciled` to guarantee mathematical ledger balance without double-deduction.
- **Transfer Sanity Invariant**: Source wallet and destination wallet must never be identical (`walletId !== toWalletId`).
- **Locale-Aware Number Parsing**: Use `parseCleanNumber` for numerical inputs to properly handle IDR period separators (`100.000`) and USD comma separators (`79,839.00`).

---

## 13. Biometric PIN Security & Dynamic Digit Length (STRICT)

> [!IMPORTANT]
> **SUPPORT 4, 5, AND 6 DIGIT PINs WITHOUT FALSE LOCKOUTS**

### 13.1 Invariants
- **Dynamic `pinLength`**: Store `pinLength` (`4 | 5 | 6`) in `SecuritySettings` upon PIN creation.
- **Zero Premature Failed Attempts**: Partial entries (`input.length < pinLength`) must never increment failed attempt counts or trigger false lockout timers.
- **Lockout Integrity**: Lockouts trigger strictly after 5 consecutive incorrect submissions of the full PIN length, accompanied by a synchronous countdown timer.

---

## 14. Subscription Resilience & StoreKit 2 Recognition (STRICT)

> [!IMPORTANT]
> **NO STALE CLOSURES ON RESTORE & LIFETIME ENTITLEMENT RECOGNITION**

### 14.1 Invariants
- **Direct Boolean Return**: `restorePurchases` must return the direct boolean result from `syncCloudSubscription()`, eliminating stale React state reads.
- **Entitlement Precedence**: `extractEntitlementStatus` prioritizes `accrual_pro` before generic entitlement fallbacks.
- **Lifetime Package Invariant**: `accrual_lifetime_499k` / `is_lifetime === true` must have `currentPeriodEnd: null` and `isLifetime: true` with zero artificial expiration dates.
- **Teardown Subscription Reset**: When `trouvaille:session-cleared` fires on logout, reset local subscription state to default free tier (`isPro: false`).
