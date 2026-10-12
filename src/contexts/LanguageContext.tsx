import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  type SupportedLanguage,
  type LanguageMeta,
  SUPPORTED_LANGUAGES,
  translations,
} from "../lib/i18n/translations";

export const LANGUAGE_STORAGE_KEY = "trouvaille_language";

export interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  meta: LanguageMeta;
  isIndonesian: boolean;
  isEnglish: boolean;
  t: (path: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function resolveTranslation(lang: SupportedLanguage, path: string): string | undefined {
  const dict = translations[lang] || translations.en;
  const parts = path.split(".");
  let curr: any = dict;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  return typeof curr === "string" ? curr : undefined;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === "id" || saved === "en") {
        return saved;
      }
    } catch {}
    return "en"; // Default is English
  });

  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {}
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {}
  }, [language]);

  const t = useCallback((path: string, fallback?: string): string => {
    const val = resolveTranslation(language, path);
    if (val !== undefined) return val;
    const enVal = resolveTranslation("en", path);
    if (enVal !== undefined) return enVal;
    return fallback !== undefined ? fallback : path;
  }, [language]);

  const meta = useMemo(() => SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES.en, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    meta,
    isIndonesian: language === "id",
    isEnglish: language === "en",
    t,
  }), [language, setLanguage, meta, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback when rendered outside provider (e.g., in unit tests)
    const lang: SupportedLanguage = "en";
    return {
      language: lang,
      setLanguage: () => {},
      meta: SUPPORTED_LANGUAGES.en,
      isIndonesian: false,
      isEnglish: true,
      t: (path: string, fallback?: string) => {
        const val = resolveTranslation(lang, path);
        return val !== undefined ? val : fallback !== undefined ? fallback : path;
      },
    };
  }
  return context;
}

export { SUPPORTED_LANGUAGES, type SupportedLanguage, type LanguageMeta };
