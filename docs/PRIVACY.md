# Accrual Privacy Policy

**Effective Date:** October 27, 2026  
**Official Contact:** accrual.project.app@gmail.com  
**Application:** Accrual: Net Worth Tracker (`com.syntheticae.accrual`)

---

## 1. Introduction & Core Philosophy
Accrual ("we", "us", or "our") is designed with a fundamental principle: **absolute user data sovereignty and privacy**. We believe your financial records, wealth metrics, transaction histories, and asset balances belong exclusively to you. 

Accrual does **NOT** sell, rent, monetize, or broker your personal or financial data to third-party data brokers, advertising networks, or analytics aggregators.

---

## 2. Information We Collect
To provide core wealth tracking and multi-asset portfolio features, Accrual processes the following categories of information:

### A. Account Identification
- **Name, Email Address & User ID:** If you sign in via Email, Sign in with Apple, or Google Sign-In, we store your authenticated User ID and email address to manage your account session and secure cloud backup.
- **Sign in with Apple:** Supports Apple's Private Relay ("Hide My Email"), allowing you to register with an anonymous, forwarded email address.

### B. Financial Portfolio & Transaction Data
- **Asset Holdings & Accounts:** User-input asset quantities, purchase dates, cost bases, account names, and transaction entries.
- **Statement Import Data:** Financial records imported via PDF or spreadsheet files are processed directly on your device. Only sanitized transaction rows are saved to your authenticated database.

### C. Device Permissions
- **Biometric Authentication (Face ID / Touch ID):** Used strictly on-device to lock and unlock the application vault. Biometric measurements are handled entirely by Apple Secure Enclave and never leave your device.
- **Camera & Photo Library:** Requested only when you choose to scan physical receipts or upload statement documents.
- **Microphone & Speech Recognition:** Requested only if you utilize voice quick-add commands. Speech recognition uses the platform speech service; availability and processing depend on the device and platform settings.

---

## 3. How Your Information is Used
- To calculate, aggregate, and visualize your net worth and portfolio metrics.
- To synchronize your financial records across your authenticated iOS devices.
- To verify active subscription tiers (Accrual Pro) via Apple StoreKit and RevenueCat.
- To provide customer support when requested at `accrual.project.app@gmail.com`.

---

## 4. Third-Party Service Providers
We partner only with industry-standard, security-audited infrastructure providers:
- **Apple StoreKit & RevenueCat:** Apple processes payments. RevenueCat processes purchase history, subscription status, user identifiers, and technical information for purchase validation, restoration, and purchase analytics. Full card numbers are not provided to Accrual.
- **Supabase Cloud (PostgreSQL):** Stores account and financial records for signed-in users. Invited members can access shared ledgers according to their permissions. Cloud synchronization uses HTTPS; financial records are not end-to-end encrypted.

---

## 5. Data Security & Storage
- Cloud connections use HTTPS. Market quote requests may be sent to third-party market data providers.
- The application stores session information and a derived PIN verifier locally. Optional biometric credentials can use platform secure storage. Encrypted backup exports use a user-provided passphrase.
- You have the absolute right to export your complete financial records (CSV/JSON/PDF) or delete your entire account and associated cloud data at any time directly within **Settings > Delete Account**.

---

## 6. Children's Privacy
Accrual is intended for individuals aged 17 and above. We do not knowingly collect personal data from children under 13.

---

## 7. Contact Us
For any inquiries regarding this Privacy Policy or your data rights, please contact our team at:  
**Email:** `accrual.project.app@gmail.com`  
**Developer:** Syntheticae Dev Team
