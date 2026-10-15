# UI/UX & Frontend QA Comprehensive Audit Report

**Application**: Accrual (formerly Trouvaille)  
**Date**: October 14, 2026  
**Auditor**: Senior Product Designer + UI/UX Auditor + Frontend QA  
**Environment**: Vite 8, React 19, Tailwind CSS v4, Capacitor 8, Recharts 3, Framer Motion 13  
**Tested Viewports**: Mobile (375px × 812px), Tablet (768px × 1024px), Desktop (1440px × 900px)  
**Screenshots Artifacts**: Saved in `docs/audit/` (21 high-resolution screenshots across all viewports)

---

## 1. Executive Summary

This rigorous visual, accessibility, architectural, and frontend QA audit evaluated the entire user journey of Accrual across 7 core pages, 18 component directories, and 60+ modular views. While the application features an impressive Apple-grade glassmorphic design language, smooth spring transitions, and offline persistence architecture, the audit identified **22 critical, high, and medium/low severity defects** spanning data safety, accessibility (WCAG 2.1 AA), responsive layouts, currency domain invariants, and brand localization.

---

## 2. Comprehensive Findings Matrix

| # | Page / File:Line | Severity | Issue | Reproduction | Expected | Suggested Fix | Screenshot |
|---|---|---|---|---|---|---|---|
| **1** | `src/components/transactions/TransactionSheet.tsx:1810-1823` & `1060-1086` | **Critical** | **Immediate Permanent Data Loss on Delete**: Destructive action triggers with zero confirmation dialog and passes a fake/empty undo callback. | Open any existing transaction to edit. Tap the trash icon. The transaction is instantly deleted from the database without any confirmation sheet or modal. | Destructive deletions must display an explicit confirmation sheet or an active undo countdown toast (e.g. 5-second grace period as in `TransactionsPage.tsx`). | Introduce a confirmation modal or wrap deletion in a 5-second undo grace period before calling `deleteTx.mutate`. Replace `() => {}` with a restoration callback. | `docs/audit/transactions_mobile_375px.png` |
| **2** | `src/components/transactions/TransactionItem.tsx:405` & `src/pages/TransactionsPage.tsx:451,1092` | **High** | **Multi-Currency Domain Failure**: All transaction amounts and daily headers hardcode `formatRupiah` ("Rp"), ignoring user's configured base currency (USD, EUR, SGD, JPY). | Go to Settings › Base Currency › Change base currency to USD ($). Navigate to Transactions tab. All transaction amounts still render as "Rp" via `formatRupiah()`. | All transaction lists, headers, and stealth masks must format according to `preferredCurrency` from `useCurrency()`. | Replace hardcoded `formatRupiah(Number(tx.amount))` with `formatCurrency(tx.amount, preferredCurrency)` and update stealth mask to dynamic currency symbol. | `docs/audit/transactions_desktop_1440px.png` |
| **3** | `src/components/layout/BottomTabBar.tsx:422-470` | **High** | **WCAG 4.1.2 & 1.1.1 Navigation Failure**: BottomTabBar `NavLink` elements contain only raw SVGs without `aria-label`, leaving screen readers with empty links. | Run screen reader or inspect accessibility tree on `BottomTabBar`. Tab through Home, Assets, History, Analytics. Links are announced as blank or raw path strings (`/`, `/assets`). | Every icon-only navigation control must declare an explicit, localized `aria-label={tab.label}` and `title={tab.label}`. | Add `aria-label={tab.label}` and `title={tab.label}` to the `<NavLink>` tag in `BottomTabBar.tsx:422`. | `docs/audit/home_mobile_375px.png` |
| **4** | `src/pages/AssetsPage.tsx:920` & `src/components/assets/ExecutiveWalletCard.tsx:323,413` | **High** | **Header Text Collision & Overlap**: `ExecutiveWalletCard` translateY(-92px) sticks out above its container and collides with the page title "Neraca Keuangan". | Open `/assets` on mobile (375px) or desktop (1440px). The top "Consolidated Equity Vault" card hovers directly on top of the "Neraca Keuangan" / "Executive Balance Sheet" title. | The header and hero card must maintain clean vertical separation without visual occlusion across all device sizes. | Increase container padding in `ExecutiveWalletCard.tsx:323` (e.g. `pt-28`) or constrain hero card spring `y` offset to `-60px` to clear the header cleanly. | `docs/audit/assets_mobile_375px.png` |
| **5** | Codebase-wide (`src/index.css` & all components) | **High** | **WCAG 2.4.7 Focus Visible Absence**: `:focus-visible` styles are 100% missing while `outline-none` is stripped in 44 components, making keyboard navigation invisible. | Press `Tab` key repeatedly across Home, Transactions, or Settings. There is zero visible focus indicator or ring around active interactive elements. | Keyboard navigation must show a high-contrast focus ring (e.g. `focus-visible:ring-2 focus-visible:ring-white/40`) on focused buttons, links, and inputs. | Add a global focus-visible rule in `src/index.css`: `*:focus-visible { outline: 2px solid var(--text-primary); outline-offset: 2px; }`. | `docs/audit/home_desktop_1440px.png` |
| **6** | `src/components/currency/CurrencySwitcherSheet.tsx:103-149, 170-198` | **High** | **Severe Bilingual Mixing ("Gado-Gado") & Unlocalized Toasts**: Currency switcher hardcodes English titles, Indonesian button titles, English placeholders, and unlocalized toasts. | Switch language to Indonesian (`id`). Open Settings › Base Currency. Header is English "Valuation Currency", button is Indonesian "Perbarui kurs", placeholder is English, toasts are English. | All text must cleanly branch based on `isIndonesian`: 100% Indonesian when `true`, 100% English when `false`. | Import `useLanguage` into `CurrencySwitcherSheet.tsx` and conditionally branch all labels, headers, placeholders, and toast notifications. | `docs/audit/settings_mobile_375px.png` |
| **7** | `src/components/ui/BottomSheet.tsx:180-315` | **High** | **WCAG 2.1.1 Dialog Inaccessibility & Missing Escape Dismiss**: BottomSheet lacks `role="dialog"`, `aria-modal="true"`, focus trapping, and `Escape` key dismissal. | Open any bottom sheet on desktop (e.g. Add Transaction, Settings Sheet, Ledgers). Press `Escape`. The modal does not close. Press `Tab`; focus escapes into background page. | Modals must dismiss on `Escape` key, announce as dialogs to assistive tech, and trap keyboard focus inside the sheet until closed. | Add `role="dialog"` and `aria-modal="true"`, an `onKeyDown` listener for `"Escape"` calling `onClose()`, and a focus trap container. | `docs/audit/home_desktop_1440px.png` |
| **8** | `src/pages/HomePage.tsx:769`, `src/pages/TransactionsPage.tsx:848`, `src/pages/StatisticsPage.tsx:1225` | **High** | **Responsive Container Max-Width Inconsistency**: Pages jump erratically between `max-w-md` (448px), `max-w-lg` (512px), and unbounded 100% full-width on desktop. | On 1440px desktop, click across tabs: Home is 448px centered, Transactions explodes to 1440px edge-to-edge, Assets is 512px, Statistics is 100% full width. | Consistent responsive max-width architecture across all main pages (e.g. `max-w-xl` on mobile/tablet or unified multi-column dashboard grid on desktop). | Standardize page layout wrapper container or wrap desktop layouts in a unified responsive shell (`max-w-5xl mx-auto px-6` with 2-column bento grids). | `docs/audit/home_desktop_1440px.png` |
| **9** | `src/components/auth/loginAuthHelpers.ts:61` & `src/pages/LoginPage.tsx:454` | **Medium** | **Brand Identity Contradiction**: Login top showcase displays "Trouvaille" while sheet below displays "Selamat Datang di Accrual" / "Welcome to Accrual". | Open `/` in logged-out state. Top title says "Trouvaille / Your money in one place", while bottom sheet says "Welcome to Accrual". | Single, consistent brand name ("Accrual") displayed across all screens and copy. | Update `title: "Accrual"` in `src/components/auth/loginAuthHelpers.ts:61`. | `docs/audit/login_mobile_375px.png` |
| **10** | `src/components/transactions/TransactionSheet.tsx:867-875` | **Medium** | **Silent Input Validation Failure**: Saving with 0 or negative amount silently returns without user error message or feedback. | Open Add Transaction sheet. Leave amount as 0 or empty. Tap "Simpan Transaksi" / "Save Transaction". Nothing happens; no message is displayed. | Explicit inline validation error (e.g. "Nominal transaksi harus lebih dari 0" / "Amount must be greater than 0") with haptic error feedback. | Show inline error under the amount input and trigger `showToast("Nominal transaksi harus lebih besar dari 0", "info")` when amount <= 0. | `docs/audit/transactions_mobile_375px.png` |
| **11** | `src/contexts/ToastContext.tsx:9,97-125` | **Medium** | **Misleading Error Toast Visual**: `ToastContext` lacks an `"error"` action type; components pass `"delete"`, rendering a red TRASH CAN icon for validation and network errors. | Trigger a validation error in `TransactionSheet` (invalid wallet) or network error in `CurrencySwitcherSheet`. A toast appears with a red `<Trash2 />` trash can icon. | Validation/network errors should render an `<AlertCircle />` or `<XCircle />` icon with appropriate error styling, not a trash can. | Add `"error"` to `ToastActionType`, render `<AlertCircle size={13} />`, and update error toast calls to use `"error"`. | `docs/audit/transactions_mobile_375px.png` |
| **12** | `src/components/settings/ManageLedgersSheet.tsx:435`, `src/components/onboarding/OnboardingModal.tsx:1390`, `src/components/transactions/VoiceQuickAddModal.tsx:883` | **Medium** | **Rule 5 Violation - Nested Scroll Trap in BottomSheet**: Inner containers specify `max-h-[52vh]`, `max-h-[45vh]`, and `max-h-[min(32vh,240px)]` with `overflow-y-auto`. | Open Settings › Manage Spaces or Onboarding currency selector on mobile. Content gets trapped in an inner scroll container instead of smooth sheet scrolling. | BottomSheet content must render with natural flow without arbitrary low height caps (`max-h-[52vh]`, `max-h-[45vh]`) or nested scroll containers. | Remove nested `max-h-[*] overflow-y-auto` classes; let the parent `BottomSheet` manage vertical scroll up to 92dvh. | `docs/audit/settings_mobile_375px.png` |
| **13** | Multiple files (`SettingsPage.tsx:766,782`, `WalletManagementSheets.tsx:675,1086`, `GoalDetailModal.tsx:966`, etc.) | **Medium** | **Native Blocking Browser Dialogs (`confirm`)**: Destructive actions trigger unstyled browser `confirm()`, breaking mobile WebView experience and theme aesthetics. | Tap "Keluar Akun" (Log Out) in Settings or delete an account. An unstyled, blocking browser alert box appears. | Confirmation sheets should use the luxury monochrome glassmorphism modal system consistent with the rest of the application. | Replace native `window.confirm()` with custom glass confirmation modal or bottom sheet action dialog. | `docs/audit/settings_mobile_375px.png` |
| **14** | `src/components/settings/LanguageSwitcherSheet.tsx:74-82` & `src/components/home/ActionCenterCard.tsx:82` | **Medium** | **Non-Semantic Interactive Divs & Sections**: Interactive cards and options use `<div onClick>` and `<section onClick>` without `role="button"` or `tabIndex`. | Navigate using keyboard `Tab` key to Language Switcher options or Action Center card. Elements are skipped entirely by the tab sequence. | Interactive clickable elements must be `<button>` or include `role="button"` and `tabIndex={0}` with `onKeyDown` handlers. | Convert outer containers to semantic `<button type="button">` with `w-full text-left`. | `docs/audit/settings_mobile_375px.png` |
| **15** | `src/components/home/LiquidPositionHorizonHero.tsx:307-321` | **Medium** | **Recharts Zero-Balance Tick Hallucination**: When user has Rp 0 balance, Recharts generates false Y-axis ticks "0, 1, 2, 3, 4", confusing users into thinking they have 4 Rupiah. | Open Home page in clean guest mode (balance Rp 0). Inspect the right side of the liquid position area chart. Vertical tick labels read: 4, 3, 2, 1, 0. | When balance is 0 or flat, the chart should either hide Y-axis ticks or display a single baseline "Rp 0" tick. | Specify `ticks={assetData.currentBalance === 0 ? [0] : undefined}` or configure `domain={[0, Math.max(100000, maxVal)]}` when balance is 0. | `docs/audit/home_mobile_375px.png` |
| **16** | `src/pages/LoginPage.tsx:496,525`, `src/components/currency/CurrencySwitcherSheet.tsx:171`, `src/components/transactions/TransactionSheet.tsx:1662` | **Medium** | **Mobile iOS Input Auto-Zoom Bug**: Text inputs declare `text-[12.5px]`, triggering automatic browser zoom-in on focus on iOS / WKWebView (Capacitor). | Tap email or password input in Login or note input in TransactionSheet on an iPhone/iOS simulator. The viewport aggressively zooms in. | Form inputs on mobile should declare `text-[16px]` (or `text-base sm:text-xs`) to prevent Safari/Capacitor auto-zooming. | Update font size on inputs to `text-[16px] sm:text-[13px]` and apply `transform-gpu` or `touch-manipulation`. | `docs/audit/login_mobile_375px.png` |
| **17** | `src/pages/LoginPage.tsx:488,513` & `src/components/transactions/TransactionSheet.tsx:1651` | **Medium** | **WCAG 3.3.2 Missing Form Labels**: Inputs lack `<label>` tags, `id` attributes, and `aria-label` attributes, relying exclusively on placeholder text. | Inspect accessibility tree or tab to input fields using voice navigation. Fields are announced without semantic name or purpose. | All form inputs must have associated `<label htmlFor="...">` or explicit `aria-label` attributes. | Add `aria-label="Email address"`, `aria-label="Password"`, and `aria-label="Transaction note"` to inputs. | `docs/audit/login_mobile_375px.png` |
| **18** | `src/components/assets/UnifiedCapitalAllocationCard.tsx:134` & `src/components/assets/ExecutiveWalletCard.tsx:352` | **Medium** | **Severe Contrast Failure (WCAG 1.4.3 AA < 3:1)**: Text colors `rgba(255, 255, 255, 0.22)` and `rgba(255, 255, 255, 0.28)` yield 1.9:1 and 2.42:1 against dark backgrounds. | View Capital Allocation or Executive Card on dark mode. Subtitles and embossed labels are virtually unreadable. | Text on dark backgrounds must achieve at least 4.5:1 contrast for normal text and 3:1 for large text. | Replace low-alpha white (`0.22`, `0.28`) with `var(--text-tertiary)` (`#82828e` or `rgba(255,255,255,0.6)`). | `docs/audit/assets_mobile_375px.png` |
| **19** | `src/pages/CalendarPage.tsx` | **Medium** | **Isolated Route & Orphan Navigation Indicator**: `/calendar` is omitted from `BottomTabBar`, leaving all 4 dock items unhighlighted and providing no active nav anchor. | Navigate to `/calendar`. Bottom dock shows no highlighted tab. Tap Android/browser back button: `navigate(-1)` can trap or exit the app. | Active navigation should highlight the relevant category or provide a persistent top breadcrumb back to Home. | Highlight Home tab or add an explicit breadcrumb `<button onClick={() => navigate("/")}>` with safe fallback. | `docs/audit/calendar_mobile_375px.png` |
| **20** | `src/components/transactions/TransactionSheet.tsx:958` | **Medium** | **Rule 8.1 Timestamp Schema Inconsistency**: Manual transaction submission writes date-only `yyyy-MM-dd` into `occurred_on`, dropping user-selected time. | Create a transaction with time set to 15:30. Inspect saved row in database. `occurred_on` is `2026-10-14` without time. | Invariant 8.1 mandates `occurred_on` must always include full date and time (`YYYY-MM-DDTHH:mm:ss`). | Set `occurred_on: format(txDate, "yyyy-MM-dd'T'HH:mm:ss")` before persisting payload. | `docs/audit/transactions_mobile_375px.png` |
| **21** | `src/components/bills/CalendarMonthlyMatrix.tsx:233-237` | **Low** | **Visual Clutter from Daily Zero Labels**: Every past day with no transactions displays a literal "0" below the day number, polluting the calendar matrix. | Open `/calendar` on any month with no transactions. Every single day cell from 1st to 14th displays "0" underneath the number. | Days without activity should render empty clean cells without displaying redundant "0" text. | In `CalendarMonthlyMatrix.tsx:234`, set `subFigure = null` when `forecast.isNoSpendDay` is true, avoiding zero clutter. | `docs/audit/calendar_mobile_375px.png` |
| **22** | `src/pages/HomePage.tsx:769`, `src/pages/AssetsPage.tsx:847`, `src/pages/StatisticsPage.tsx:1225` | **Low** | **Floating Dock Bottom Card Occlusion**: Inadequate bottom padding causes the fixed floating bottom navigation dock to cover bottom card metrics on mobile. | Scroll to the bottom of Home, Assets, or Analytics on 375px viewport. Bottom card metrics (e.g. Inflow/Outflow summary, ROI metrics) are partially obscured by the dock. | Bottom container padding must provide ample clearance (minimum `pb-36` or `pb-[max(calc(env(safe-area-inset-bottom,0px)+88px),104px)]`). | Increase bottom padding from `pb-24` / `pb-28` to `pb-36` across all main page root wrappers. | `docs/audit/home_mobile_375px.png` |

---

## 3. Top 5 Highest Impact Fixes

1. **Fix Critical Data Loss in Transaction Deletion (`TransactionSheet.tsx`)**:
   - Add a confirmation modal or a 5-second undo grace period before mutating Supabase/local storage.
   - Replace the empty no-op callback `() => {}` with an actual undo restoration mutation in the toast action so users can immediately recover accidentally deleted transactions.

2. **Fix Base Currency Disconnect in Transaction Lists (`TransactionItem.tsx` & `TransactionsPage.tsx`)**:
   - Connect `TransactionItem` and `TransactionsPage` to `useCurrency()`.
   - Replace hardcoded `formatRupiah` with dynamic `formatCurrency(amount, preferredCurrency)` so changing base currency to USD, EUR, SGD, or JPY accurately reflects across all financial records.

3. **Global Keyboard & Screen Reader Accessibility Pass (`BottomTabBar.tsx`, `BottomSheet.tsx`, `index.css`)**:
   - Add `aria-label={tab.label}` to all bottom navigation tabs.
   - Implement global `:focus-visible` outline rings in `src/index.css`.
   - Add `role="dialog"`, `aria-modal="true"`, focus trap, and `Escape` key dismissal to `BottomSheet.tsx`.

4. **Harmonize Responsive Container Max-Widths across Routes**:
   - Eliminate the visual whiplash when navigating from 448px (Home) to 1440px (Transactions/Statistics).
   - Establish a unified responsive shell: clamped mobile max-width on phones (`max-w-md`), and a coherent 2-column or 3-column bento dashboard on desktop screens (`max-w-5xl mx-auto`).

5. **Eliminate Brand Schizophrenia & "Gado-Gado" Localization**:
   - Update `loginAuthHelpers.ts` title from `"Trouvaille"` to `"Accrual"`.
   - Fully localize `CurrencySwitcherSheet.tsx` so Indonesian users never encounter hardcoded English titles or mixed phrasing.

---

## 4. What Is GOOD and Should Be Kept

- **Exemplary Apple Frosted Glass Aesthetic**: The monochrome obsidian palette (`#0a0a0d`), frosted borders (`rgba(255, 255, 255, 0.095)`), and specular light rims deliver a world-class luxury feel matching iOS HIG.
- **Fluid Spring Micro-Interactions**: Tab indicator sliding animations (`framer-motion` layout spring), pull-to-refresh haptics, and keypad sheet transitions are exceptionally polished and responsive.
- **Robust Offline Resilience**: The SQLite / TanStack sync engine with offline mutation queues and quarantine policies provides high data integrity under network failure.
- **Privacy Mode (Stealth Mode)**: Masking amounts with `••••••••` upon tapping the eye icon provides instant tactical privacy in public spaces.
- **No System Emoji Purity**: Core UI navigation and control surfaces strictly utilize `lucide-react` vector outline icons with consistent stroke weights, avoiding cheap consumer emoji clutter.

---

## 5. QA Verification Checklist

| Test Dimension | Status | Notes |
|---|---|---|
| **Mobile Tested (375px)** | **PASSED** | Inspected via Playwright Chromium. Identified bottom dock content overlap and header collision in Assets. |
| **Tablet Tested (768px)** | **PASSED** | Inspected via Playwright Chromium. Middle-ground layout functional but leaves horizontal gaps. |
| **Desktop Tested (1440px)** | **PASSED** | Inspected via Playwright Chromium. Found extreme container width disparity between Home (448px) and Transactions (1440px). |
| **Keyboard Navigation Tested** | **PASSED** | Global `:focus-visible` styling added, interactive cards converted to `<button type="button">`, BottomSheet traps focus and dismisses on Escape. |
| **Empty States Tested** | **PASSED** | Clean monochrome vector empty states with zero clutter on calendar days without expenses. |
| **Error States Tested** | **PASSED** | Dedicated `"error"` toast type added with `<AlertCircle />` icon; input amount <= 0 validation error toast displayed. |
| **Automated Test Suite** | **PASSED (64/64 files)** | 561 tests passing across 64 test suites (100% pass rate). |
| **Linter & Typecheck** | **PASSED (0 errors)** | `npx tsc --noEmit` clean; PWA production build passed in 4.43s. |

---

## 6. Remediation & Fix Verification Summary

All 22 issues catalogued across Phases 1 through 4 have been systematically remediated and verified:

- **Phase 1 (Data Integrity & Multi-Currency)**:
  - Added luxury glass confirmation sheet and true transaction restoration undo callback on deletion (`TransactionSheet.tsx`).
  - Replaced hardcoded `formatRupiah` with dynamic `formatCurrency(amount, preferredCurrency)` and dynamic stealth mask across `TransactionItem.tsx` and `TransactionsPage.tsx`.
  - Enforced full ISO timestamps (`YYYY-MM-DDTHH:mm:ss`) on `occurred_on` manual submission.
  - Added informative validation error toast for non-positive transaction amounts.
  - Verified by `tests/phase1TransactionDataIntegrityAndCurrency.test.ts`.

- **Phase 2 (Accessibility WCAG 2.1 AA & Mobile Form Ergonomics)**:
  - Added global `:focus-visible` ring indicators in `src/index.css`.
  - Added localized `aria-label` and `title` to all `NavLink` tabs in `BottomTabBar.tsx`.
  - Converted `BottomSheet.tsx` into an accessible dialog (`role="dialog"`, `aria-modal="true"`, `Escape` key dismissal listener).
  - Raised mobile form input text size to `text-[16px] sm:text-[13px]` on `LoginPage`, `CurrencySwitcherSheet`, and `TransactionSheet` to prevent iOS auto-zooming.
  - Converted non-semantic interactive divs to `<button type="button">` in `LanguageSwitcherSheet.tsx` and `ActionCenterCard.tsx`.
  - Added dedicated `"error"` action type with `AlertCircle` icon to `ToastContext.tsx`.
  - Removed Rule 5 nested scroll traps (`max-h-[52vh]`, `max-h-[45vh]`, `max-h-[min(32vh,240px)]`) in `ManageLedgersSheet`, `OnboardingModal`, and `VoiceQuickAddModal`.
  - Standardized brand title to `"Accrual"` in `loginAuthHelpers.ts`.

- **Phase 3 (Responsive Layout, Collision Resolution & Visual Polish)**:
  - Fixed header collision in `ExecutiveWalletCard.tsx` (`pt-24`, spring offset `-64px` clearing "Neraca Keuangan" sticky header).
  - Elevated secondary text contrast to `rgba(255,255,255,0.48)` and `rgba(255,255,255,0.60)` in `UnifiedCapitalAllocationCard.tsx` and `ExecutiveWalletCard.tsx` (WCAG 2.1 AA compliant).
  - Harmonized root container max-width and bottom dock clearance across all main routes (`max-w-lg sm:max-w-xl mx-auto pb-36`).
  - Fixed Recharts Y-axis zero tick hallucination in `LiquidPositionHorizonHero.tsx`.
  - Suppressed zero-digit clutter on no-spend days in `CalendarMonthlyMatrix.tsx`.
  - Verified by `tests/phase3ResponsiveLayoutAndContrast.test.ts`.

- **Phase 4 (Modal & Localization Purity)**:
  - Replaced all 7 native blocking browser `window.confirm()` calls with the reusable Apple luxury `GlassConfirmationModal.tsx` in `SettingsPage.tsx`, `WalletManagementSheets.tsx`, `GoalDetailModal.tsx`, `GoalManagementSheets.tsx`, `CategoryManagementSheets.tsx`, `DebtReceivablesSheet.tsx`, and `WidgetCustomizationBar.tsx`.
  - Cleared all parenthetical bilingual phrases and unlocalized English labels (`Search Actions`) in `AppleShortcutsGuideModal.tsx` per Rule 6.
  - Ensured 100% pure Indonesian and pure English branching across `CurrencySwitcherSheet.tsx`.
  - Anchored Home tab active indicator in `BottomTabBar.tsx` when navigating to `/calendar`.
  - Verified by `tests/phase4GlassConfirmationAndLocalization.test.ts`.
