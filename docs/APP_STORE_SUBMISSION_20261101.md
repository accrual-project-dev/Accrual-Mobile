# Accrual App Store submission — 1 November 2026

Status: **WAITING_FOR_REVIEW** (verified in App Store Connect UI and API).

- Submitted: 1 November 2026, 05:13 WIB (2026-10-31T22:13:05.774Z).
- App: Accrual: Net Worth Tracker, Apple ID 6825272166.
- Version/build: **1.3.35 (80)**.
- Review submission: 00f8bc24-c2ac-42b2-9565-5dd72e09b351.
- Submitted together: iOS app, Accrual Pro Lifetime, Monthly, Annual, and their subscription group. All five resources are Waiting for Review.
- Release setting: automatically release after approval.
- Territories: 148; EU territories remain excluded as requested.

## Corrections and verification

- Delivery 1.3.34 (79) failed with ITMS-90626 because LogCardTransactionIntent's description included the reserved term "Apple". Replaced the description with "Capture wallet card-tap or NFC transaction text for review in Accrual."
- Initial release targets iPhone, at the owner's request when native iPad screenshots were unavailable. The compiled app and widget Info.plist both contain UIDeviceFamily [1]. Apple accepted the app version into the draft without the previous IPAD_13_PROFILE screenshot error.
- Inspected the signed IPA's generated Metadata.appintents/extract.actionsdata: old rejected description absent; replacement present.
- Apple build upload completed with no errors or warnings; build status VALID / APP_STORE_ELIGIBLE.
- Regression test reproduced both metadata/configuration issues before the changes and passed afterward.
- npm test: 140 suites, 1,281 tests passed; backend account deletion: 7/7 passed.
- npm run build passed for version 1.3.35.
- Two stale BottomSheet layout assertions updated to the user's single-sheet UI. Notification test clock fixed to avoid a UTC/local-month boundary fixture failure. No financial runtime behavior was changed in those test corrections.
- Binary commit/tag: 1ac48a6 / v1.3.35. GitHub Actions run 41246319426 completed successfully.
- main updated via fast-forward; local main aligned with remote. Existing version tags were preserved.
- Reviewer demo account login verified successfully without exposing credentials.
- Published dedicated iPhone support document, docs/SUPPORT.md. App Store support URL points to it. Removed optional marketing URL that described the separate PWA and conflicting storage claims. Website repository was not modified.

## Evidence

- App Store Connect: https://appstoreconnect.apple.com/apps/6825272166/distribution/reviewsubmissions/details/00f8bc24-c2ac-42b2-9565-5dd72e09b351
- Build: https://github.com/accrual-project-dev/Accrual-Mobile/actions/runs/41246319426

This supersedes the pending iPad-screenshot status in APP_STORE_READINESS_20261031.md. Submission acceptance is verified; App Review approval is still pending.
