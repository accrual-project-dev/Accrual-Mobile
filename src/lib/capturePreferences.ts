export interface CapturePreferences { ledgerId: string | null; rules: Array<{sourceApp: string; walletId: string; categoryId: string}> }
export function getCapturePreferences(ownerId: string): CapturePreferences {
  try { const value = JSON.parse(localStorage.getItem(`accrual_capture_preferences:${ownerId}`) || 'null'); return value && Array.isArray(value.rules) ? value : { ledgerId: null, rules: [] }; }
  catch { return { ledgerId: null, rules: [] }; }
}
export function saveCapturePreferences(ownerId: string, prefs: CapturePreferences): void { localStorage.setItem(`accrual_capture_preferences:${ownerId}`, JSON.stringify(prefs)); if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("accrual:capture-settings")); }
