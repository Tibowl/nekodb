import { createContext, useContext, useState, ReactNode } from "react"
import { Language, availableLanguages } from "../utils/localization/translate"
import { TranslationTable } from "../utils/localization/translate"

const defaultLanguage: Language = "en"

type LanguageContextType = {
  currentLanguage: Language;
  setLanguage: (lang: Language) => void;
  translate: (translationTable: TranslationTable) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [currentLanguage, setLanguage] = useState<Language>(defaultLanguage)

  const translate = (translationTable: TranslationTable) => {
    return translationTable[currentLanguage]
  }

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage, translate }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return {
    ...context,
    availableLanguages
  }
}
