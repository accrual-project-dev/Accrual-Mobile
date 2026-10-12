import { describe, it, expect, beforeEach } from "vitest";
import {
  translations,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "../src/lib/i18n/translations";
import { LANGUAGE_STORAGE_KEY } from "../src/contexts/LanguageContext";

describe("Internationalization & Language System", () => {
  beforeEach(() => {
    if (typeof globalThis.localStorage === "undefined") {
      const store: Record<string, string> = {};
      (globalThis as any).localStorage = {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => {
          store[k] = String(v);
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          for (const k of Object.keys(store)) delete store[k];
        },
      };
    } else {
      globalThis.localStorage.clear();
    }
  });

  it("defines supported languages with English as default", () => {
    expect(SUPPORTED_LANGUAGES.en).toBeDefined();
    expect(SUPPORTED_LANGUAGES.id).toBeDefined();
    expect(SUPPORTED_LANGUAGES.en.isDefault).toBe(true);
    expect(SUPPORTED_LANGUAGES.en.badge).toBe("EN");
    expect(SUPPORTED_LANGUAGES.id.badge).toBe("ID");
  });

  it("contains complete navigation translations for English and Indonesian", () => {
    expect(translations.en.nav.home).toBe("Home");
    expect(translations.en.nav.transactions).toBe("Transactions");
    expect(translations.en.nav.analytics).toBe("Analytics");
    expect(translations.en.nav.settings).toBe("Settings");

    expect(translations.id.nav.home).toBe("Beranda");
    expect(translations.id.nav.transactions).toBe("Transaksi");
    expect(translations.id.nav.analytics).toBe("Statistik");
    expect(translations.id.nav.settings).toBe("Pengaturan");
  });

  it("contains onboarding stage 1 translations", () => {
    expect(translations.en.onboarding.languageLabel).toBe("Interface Language");
    expect(translations.id.onboarding.languageLabel).toBe("Bahasa Aplikasi");

    expect(translations.en.onboarding.presetDefaultTitle).toBe("Default Curated Preset");
    expect(translations.id.onboarding.presetDefaultTitle).toBe("Preset Kurasi Default");

    expect(translations.en.onboarding.completeButton).toBe("Enter Accrual");
    expect(translations.id.onboarding.completeButton).toBe("Masuk ke Accrual");
  });

  it("contains settings translations for App Language and sections", () => {
    expect(translations.en.settings.appLanguage).toBe("App Language");
    expect(translations.id.settings.appLanguage).toBe("Bahasa Aplikasi");

    expect(translations.en.settings.baseCurrency).toBe("Base Currency");
    expect(translations.id.settings.baseCurrency).toBe("Mata Uang Dasar");
  });

  it("contains home dashboard preset translations", () => {
    expect(translations.en.home.presets.minimal).toBe("Minimal");
    expect(translations.en.home.presets.pulse).toBe("Balanced");
    expect(translations.id.home.presets.pulse).toBe("Seimbang");
    expect(translations.id.home.presets.horizon).toBe("Cakrawala");
    expect(translations.id.home.presets.executive).toBe("Eksekutif");
  });

  it("persists language selection to localStorage key", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "id");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("id");

    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });
});
