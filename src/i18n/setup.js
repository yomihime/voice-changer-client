// Extracted from the preserved 2.1.4-alpha baseline; editable application source.
import { initReactI18next, instance, Browser, Backend } from "../vendor/recovered-runtime.js";
instance.use(Backend).use(Browser).use(initReactI18next).init({
  backend: {
    loadPath: "/assets/i18n/{{lng}}/{{ns}}.json"
  },
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});
