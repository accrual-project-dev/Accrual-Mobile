import { Check, Languages } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import {
  useLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "../../contexts/LanguageContext";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";

interface LanguageSwitcherSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LanguageSwitcherSheet({ isOpen, onClose }: LanguageSwitcherSheetProps) {
  const { language, setLanguage, t, isIndonesian } = useLanguage();
  const { showToast } = useToast();

  const handleSelect = (code: SupportedLanguage) => {
    triggerHaptic("medium");
    setLanguage(code);
    const langName = SUPPORTED_LANGUAGES[code]?.nativeName || code;
    showToast(
      code === "id"
        ? `Bahasa diubah ke ${langName}`
        : `Interface language set to ${langName}`,
      "update",
      () => {},
    );
    onClose();
  };

  const languageOptions = Object.values(SUPPORTED_LANGUAGES);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-5 pb-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <Languages size={16} strokeWidth={1.75} />
            </div>
            <div>
              <h2
                className="text-[16px] font-semibold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {t("settings.appLanguage", "App Language")}
              </h2>
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {t("settings.appLanguageDesc", "Choose your preferred interface language")}
              </p>
            </div>
          </div>
        </div>

        {/* Language Options List */}
        <div className="space-y-2 pt-1">
          {languageOptions.map((item) => {
            const isSelected = language === item.code;
            return (
              <button
                type="button"
                key={item.code}
                onClick={() => handleSelect(item.code)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                  isSelected
                    ? "bg-black/[0.04] dark:bg-white/[0.08] border-black/15 dark:border-white/20 shadow-sm"
                    : "bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-bold  shrink-0"
                    style={{
                      background: "var(--glass-fill)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {item.badge}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {item.nativeName}
                      </span>
                      {item.isDefault && (
                        <span
                          className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
                          style={{
                            background: "var(--glass-fill)",
                            color: "var(--text-tertiary)",
                            border: "1px solid var(--glass-border)",
                          }}
                        >
                          {isIndonesian ? "Bawaan" : "Default"}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {item.name}
                    </span>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? "bg-[var(--text-primary)] text-[var(--bg-base)]"
                      : "border border-[var(--text-tertiary)] opacity-30"
                  }`}
                >
                  {isSelected && <Check size={11} strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
