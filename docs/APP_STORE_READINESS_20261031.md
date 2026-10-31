# Accrual App Store preparation — 31 October 2026

Status: awaiting required iPad screenshot; not submitted.

## Verified

- App Store Connect app: 6825272166.
- Draft version: 1.3.33, selected build 78 (VALID), replacing build 54.
- TestFlight device checks: owner confirmed login Apple/email, manual/Shortcut transactions without spam, sync, sandbox purchases/restore, Apple deletion cancellation and completion on build 78.
- Review account credentials and contact details are populated; review notes describe login, Pro plans, restoration and deletion.
- App Privacy published with seven data types. Privacy and standard Apple EULA links included in the description; public support/privacy URLs return HTTP 200.
- Distribution: 148 territories; 27 EU territories excluded at owner's request. Automatic release after approval remains selected.
- One unsubmitted review draft (00f8bc24-c2ac-42b2-9565-5dd72e09b351) contains Lifetime, Monthly, Annual and their subscription group, all READY_FOR_REVIEW.
- Legacy client access to delete_user_account() revoked in production after build 78 device confirmation. Both overloads now deny anon/authenticated; server access remains. SQL is already represented in 202610310001_secure_account_deletion.sql.
- npm test: 139 suites, 1,279 tests pass; account-deletion Node suite: 7/7 pass.
- npm run build: passes.

## Test maintenance

Six outdated suites were aligned with the documented shipping behavior: personal ledger identity in quick entry, shared BottomSheet sizing, manual routes separate from the five canonical Shortcut templates, localized instruction fields owned by the guide component, saved iCloud overrides, and explicit logout purging user data per CODEX Rule 10. No application runtime code changed after build 78. Tests do not establish actual iOS automation availability or validate the contents of externally shared Shortcut templates; physical device results are separate evidence.

## Required next step

Apple rejected adding the app version to the draft with STATE_ERROR.SCREENSHOT_REQUIRED.IPAD_13_PROFILE. At least one original iPad 13-inch screenshot is needed (2064x2752 or 2048x2732 portrait, or landscape equivalents; no alpha). Use fictitious/public-safe data. Existing nine iPhone screenshots are complete.

After uploading the iPad screenshot, add app version 1.3.33 to the existing draft and re-run final validation. Do not create a second submission for the same assets and do not click Submit for Review on the owner's behalf.

Reference: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
