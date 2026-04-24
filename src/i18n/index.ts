import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zh from './locales/zh.json'

const LANGUAGE_KEY = 'tolaria:language'

function getSavedLanguage(): string {
  try {
    return localStorage.getItem(LANGUAGE_KEY) ?? 'en'
  } catch {
    return 'en'
  }
}

export function setLanguage(lang: string): void {
  void i18n.changeLanguage(lang)
  try {
    localStorage.setItem(LANGUAGE_KEY, lang)
  } catch {
    // ignore
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: getSavedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
