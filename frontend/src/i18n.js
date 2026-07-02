import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationID from './locales/id/translation.json';
import translationEN from './locales/en/translation.json';

const resources = {
  id: {
    translation: translationID
  },
  en: {
    translation: translationEN
  }
};

const savedLanguage = localStorage.getItem('appLanguage') || 'id';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'id',
    interpolation: {
      escapeValue: false 
    }
  });

// Save to localStorage when language changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('appLanguage', lng);
});

export default i18n;
