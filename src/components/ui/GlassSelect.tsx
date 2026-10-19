import { useState, useMemo } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { IconRenderer } from "./IconRenderer";
import { triggerHaptic } from "../../lib/haptics";

export interface GlassSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: string;
  badge?: string;
}

export interface GlassSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: GlassSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function GlassSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  className = "",
}: GlassSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)),
    );
  }, [options, searchQuery]);

  const handleSelect = (val: string) => {
    triggerHaptic("light");
    onChange(val);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] px-0.5 block">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            triggerHaptic("light");
            setIsOpen(true);
          }
        }}
        className={`w-full px-3.5 py-2.5 rounded-xl text-[13px] bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)] flex items-center justify-between gap-2.5 transition-all text-left outline-none cursor-pointer ${
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-[var(--text-tertiary)] active:scale-[0.99]"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {selectedOption?.icon && (
            <div className="w-5 h-5 rounded-md bg-[var(--bg-elevated)] border border-[var(--glass-border)] flex items-center justify-center shrink-0">
              <IconRenderer icon={selectedOption.icon} size="w-3.5 h-3.5" />
            </div>
          )}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-white/[0.08] text-[var(--text-tertiary)] border border-[var(--glass-border)] shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown size={14} strokeWidth={2} className="text-[var(--text-tertiary)] shrink-0" />
      </button>

      {/* Elegant Apple Luxury Modal Selector */}
      {isOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div
            className="w-full sm:max-w-md bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-t-3xl sm:rounded-2xl p-4 pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),24px)] sm:pb-4 space-y-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 select-none max-h-[92dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-1 border-b border-[var(--glass-border)]">
              <div>
                <h3 className="text-[13px] font-bold text-[var(--text-primary)]">
                  {label || "Select Option"}
                </h3>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Choose from available accounts
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setIsOpen(false);
                  setSearchQuery("");
                }}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {/* Optional Search */}
            {options.length > 5 && (
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-[12px] bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--text-primary)] transition-colors"
                />
              </div>
            )}

            {/* Options List */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-1 py-1 pb-2">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-[var(--text-tertiary)]">
                  No matching options found
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full p-2.5 rounded-xl flex items-center justify-between gap-2.5 transition-all text-left cursor-pointer active:scale-[0.99] ${
                        isSelected
                          ? "bg-white/[0.12] border border-[var(--glass-border)] text-[var(--text-primary)] shadow-xs"
                          : "bg-[var(--glass-fill)] border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {opt.icon && (
                          <div className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] border border-[var(--glass-border)] flex items-center justify-center shrink-0">
                            <IconRenderer icon={opt.icon} size="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                              {opt.label}
                            </span>
                            {opt.badge && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)]">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          {opt.sublabel && (
                            <p className="text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">
                              {opt.sublabel}
                            </p>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[var(--text-primary)] text-[var(--bg-elevated)] flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={2.5} />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
