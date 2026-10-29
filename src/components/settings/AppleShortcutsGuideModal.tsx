import { useEffect, useState } from "react";
import { ExternalLink, Inbox, Check } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { useSpace } from "../../contexts/SpaceContext";
import { useWallets } from "../../hooks/useWallets";
import { useCategories } from "../../hooks/useCategories";
import { SHORTCUT_PRESETS, getShortcutsConfig, type PresetId } from "../../lib/shortcutsConfig";
import { getCapturePreferences, saveCapturePreferences } from "../../lib/capturePreferences";

export { SHORTCUT_PRESETS, isValidICloudLink } from "../../lib/shortcutsConfig";
export type { PresetId, ShortcutActionNode, ShortcutPreset } from "../../lib/shortcutsConfig";
export type TabType = "back_tap" | "action_button" | "ways_to_add" | "automation" | "screen_scan" | "notification_reader" | "receipt_scan" | "quick_add" | "glass_dialog";
export function mapInitialTab(tab?: TabType): PresetId {
  if (tab === "automation" || tab === "notification_reader") return "notification_reader";
  if (tab === "ways_to_add" || tab === "quick_add" || tab === "glass_dialog") return "quick_add";
  if (tab === "receipt_scan") return "receipt_scan";
  return "screen_scan";
}

function CaptureMapping() {
  const { isIndonesian: id } = useLanguage();
  const { user } = useAuth();
  const { spaces } = useSpace();
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();
  const owner = user?.id;
  const [preferences, setPreferences] = useState(() => getCapturePreferences(owner || ""));
  const [sourceApp, setSourceApp] = useState("");
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setPreferences(getCapturePreferences(owner || "")); setSaved(false); }, [owner]);
  const inputClass = "w-full rounded-xl border p-3 text-sm bg-transparent";
  return <section className="rounded-2xl border p-4 flex flex-col gap-3" style={{ borderColor: "var(--glass-border)" }}>
    <h3 className="font-semibold">{id ? "Aturan penyimpanan tangkapan" : "Capture saving rules"}</h3>
    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{id ? "Tanpa pilihan buku dan aturan sumber yang cocok, tangkapan menunggu tinjauan. Hanya hasil yang lengkap dan cocok dengan aturan dapat disimpan otomatis. Saldo dompet tidak menentukan dompet tujuan." : "Without an explicit ledger and matching source rule, captures wait for review. Only complete captures matching a rule can save automatically. Wallet balances never select a destination."}</p>
    <label className="text-sm">{id ? "Buku transaksi" : "Ledger"}
      <select className={inputClass} value={preferences.ledgerId || ""} onChange={e => { setPreferences({ ...preferences, ledgerId: e.target.value || null }); setSaved(false); }}>
        <option value="">{id ? "Selalu tinjau" : "Always review"}</option>
        {spaces.filter(s => s.id !== "all" && s.role !== "viewer").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
    <label className="text-sm">{id ? "Nama persis aplikasi sumber atau bank" : "Exact source app or bank name"}<input className={inputClass} value={sourceApp} onChange={e => setSourceApp(e.target.value)} placeholder="BCA" /></label>
    <label className="text-sm">{id ? "Dompet tujuan" : "Destination wallet"}<select className={inputClass} value={walletId} onChange={e => setWalletId(e.target.value)}><option value="">{id ? "Pilih dompet" : "Choose wallet"}</option>{wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
    <label className="text-sm">{id ? "Kategori" : "Category"}<select className={inputClass} value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">{id ? "Pilih kategori" : "Choose category"}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <button type="button" className="rounded-xl border p-3 text-sm disabled:opacity-40" disabled={!sourceApp.trim() || !walletId || !categoryId} onClick={() => {
      setPreferences({ ...preferences, rules: [...preferences.rules.filter(r => r.sourceApp.trim().toLowerCase() !== sourceApp.trim().toLowerCase()), { sourceApp: sourceApp.trim(), walletId, categoryId }] }); setSourceApp(""); setSaved(false);
    }}>{id ? "Tambahkan aturan" : "Add rule"}</button>
    {preferences.rules.map((rule, index) => <div key={index} className="flex gap-3 items-center text-sm"><span className="flex-1">{rule.sourceApp} → {wallets.find(w => w.id === rule.walletId)?.name || (id ? "Dompet tidak tersedia" : "Wallet unavailable")} · {categories.find(c => c.id === rule.categoryId)?.name || (id ? "Kategori tidak tersedia" : "Category unavailable")}</span><button type="button" onClick={() => { setPreferences({ ...preferences, rules: preferences.rules.filter((_, i) => i !== index) }); setSaved(false); }}>{id ? "Hapus" : "Remove"}</button></div>)}
    <button type="button" disabled={!owner} className="rounded-xl border p-3 text-sm disabled:opacity-40" onClick={() => { if (owner) { saveCapturePreferences(owner, preferences); setSaved(true); } }}>{saved ? (id ? "Aturan tersimpan" : "Rules saved") : (id ? "Simpan aturan" : "Save rules")}</button>
  </section>;
}

export function AppleShortcutsGuideModal({ isOpen, onClose, initialTab = "back_tap" }: { isOpen: boolean; onClose: () => void; initialTab?: TabType }) {
  const { isIndonesian: id } = useLanguage();
  const [selected, setSelected] = useState<PresetId>(() => mapInitialTab(initialTab));
  const [ios27, setIos27] = useState(false);
  useEffect(() => setSelected(mapInitialTab(initialTab)), [initialTab, isOpen]);
  const preset = SHORTCUT_PRESETS.find(p => p.id === selected)!;
  const Icon = preset.icon;
  const enabled = preset.minIos < 27 || ios27;
  const customLink = preset.id === "screen_scan" ? getShortcutsConfig().shortcuts.screenshot.icloud_url : preset.id === "notification_reader" ? getShortcutsConfig().shortcuts.notification.icloud_url : "";
  const open = (url: string) => { window.location.href = url; };
  return <BottomSheet isOpen={isOpen} onClose={onClose} title={id ? "Pintasan & tangkapan" : "Shortcuts & capture"}>
    <div className="flex flex-col gap-5 px-4" style={{ color: "var(--text-primary)", paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 24px), 32px)" }}>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{id ? "Dua cara utama: layar pembayaran dan notifikasi bank. Siapkan pintasan, tautkan pemicu, lalu uji dengan transaksi sungguhan." : "Two primary routes: payment screens and bank notifications. Set up a shortcut, bind its trigger, then test with a real transaction."}</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={id ? "Cara menangkap" : "Capture routes"}>{SHORTCUT_PRESETS.filter(p => p.primary).map(p => <button key={p.id} type="button" aria-pressed={selected === p.id} className="border rounded-2xl p-3 text-sm text-left flex items-center gap-2" style={{ borderColor: "var(--glass-border)", background: selected === p.id ? "var(--glass-bg)" : "transparent" }} onClick={() => setSelected(p.id)}><p.icon size={18} strokeWidth={1.5} />{id ? p.titleId : p.titleEn}</button>)}</div>
      <section className="rounded-2xl border p-4 flex flex-col gap-3" style={{ borderColor: "var(--glass-border)" }}>
        <h3 className="font-semibold flex items-center gap-2"><Icon size={18} strokeWidth={1.5} />{id ? preset.titleId : preset.titleEn}</h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{id ? preset.summaryId : preset.summaryEn}</p>
        {preset.minIos >= 27 && <label className="text-sm flex gap-2"><input type="checkbox" checked={ios27} onChange={e => setIos27(e.target.checked)} />{id ? "Perangkat saya memakai iOS 27 dan memiliki pemicu notifikasi aplikasi" : "My device runs iOS 27 and has the app notification trigger"}</label>}
        {enabled && <>
          {preset.primary && <><h4 className="text-sm font-semibold">{id ? "1. Pasang atau susun manual" : "1. Install or build manually"}</h4><p className="text-sm">{id ? "Belum ada tautan resmi yang diverifikasi. Susun tindakan berikut di Pintasan." : "No official link has been verified. Build these actions in Shortcuts."}</p>
            <button type="button" className="border rounded-xl p-3 flex justify-center gap-2 text-sm" onClick={() => open("shortcuts://")}><ExternalLink size={16} strokeWidth={1.5} />{id ? "Buka Pintasan" : "Open Shortcuts"}</button>
            {customLink && <><p className="text-sm">{id ? "Tautan pribadi tersimpan. Isi dan ketersediaannya belum diverifikasi." : "A personal link is saved. Its contents and availability are unverified."}</p><button type="button" className="border rounded-xl p-3 text-sm" onClick={() => open(customLink)}>{id ? "Buka tautan pribadi" : "Open personal link"}</button></>}
          </>}
          {preset.actions.map(action => <div key={action.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--glass-border)" }}><strong>{id ? action.titleId : action.titleEn}</strong><p className="mt-1" style={{ color: "var(--text-secondary)" }}>{id ? action.subtitleId : action.subtitleEn}</p></div>)}
          {(id ? preset.stepsId : preset.stepsEn).map((step, index) => <div key={index} className="text-sm"><h4 className="font-semibold">{index === 0 ? (id ? "Susun tindakan" : "Build the actions") : index === 1 ? (id ? "2. Tautkan pemicu" : "2. Bind a trigger") : (id ? "3. Uji dan periksa" : "3. Test and review")}</h4><p className="mt-1" style={{ color: "var(--text-secondary)" }}>{step}</p></div>)}
          {preset.directScheme && <button type="button" className="rounded-xl border p-3 text-sm" onClick={() => open(preset.directScheme!)}>{id ? "Buka di Accrual" : "Open in Accrual"}</button>}
        </>}
      </section>
      {preset.primary && <CaptureMapping />}
      <button type="button" className="border rounded-xl p-3 flex justify-center gap-2 text-sm" onClick={() => open("accrual://inbox")}><Inbox size={16} strokeWidth={1.5} />{id ? "Buka kotak tinjauan" : "Open review inbox"}</button>
      <div className="grid grid-cols-2 gap-2">{SHORTCUT_PRESETS.filter(p => !p.primary && p.id !== "review_inbox").map(p => <button type="button" key={p.id} className="rounded-xl border p-3 text-sm flex gap-2 items-center" onClick={() => setSelected(p.id)}><p.icon size={16} strokeWidth={1.5} />{id ? p.titleId : p.titleEn}</button>)}</div>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{id ? "Accrual tidak dapat mendeteksi apakah pintasan telah dipasang, ditautkan, atau berhasil diuji. Periksa hasil transaksi setelah pengujian." : "Accrual cannot detect whether a shortcut is installed, bound, or successfully tested. Check the transaction result after testing."}</p>
      <button type="button" className="rounded-xl border p-3 text-sm flex justify-center gap-2" onClick={onClose}><Check size={16} strokeWidth={1.5} />{id ? "Selesai" : "Done"}</button>
    </div>
  </BottomSheet>;
}
