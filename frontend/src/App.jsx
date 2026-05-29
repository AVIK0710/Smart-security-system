import { useEffect } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Toast from "./components/Toast.jsx";
import Topbar from "./components/Topbar.jsx";
import { AppProvider, useApp } from "./context/AppContext.jsx";
import AccessView from "./views/AccessView.jsx";
import DevicesView from "./views/DevicesView.jsx";
import EnergyView from "./views/EnergyView.jsx";
import OverviewView from "./views/OverviewView.jsx";
import AutomationView from "./views/AutomationView.jsx";
import RoomsView from "./views/RoomsView.jsx";
import SchedulesView from "./views/SchedulesView.jsx";
import SecurityView from "./views/SecurityView.jsx";
import SettingsView from "./views/SettingsView.jsx";

const SETTINGS_STORAGE_KEY = "smart_home_settings_preferences";

const TRANSLATIONS = {
  hi: {
    Dashboard: "डैशबोर्ड",
    Rooms: "कमरे",
    Devices: "डिवाइस",
    Energy: "ऊर्जा",
    Security: "सुरक्षा",
    Schedules: "शेड्यूल",
    Automation: "ऑटोमेशन",
    Settings: "सेटिंग्स",
    Account: "खाता",
    General: "सामान्य",
    Notifications: "सूचनाएं",
    Integrations: "इंटीग्रेशन",
    Backup: "बैकअप",
    Privacy: "गोपनीयता",
    "Quick Actions": "त्वरित कार्य",
    "System Information": "सिस्टम जानकारी",
    "Save Changes": "बदलाव सहेजें",
    "Create Rule": "नियम बनाएं",
    "All Devices Online": "सभी डिवाइस ऑनलाइन",
    "Home Name": "घर का नाम",
    Location: "स्थान",
    "Temperature Unit": "तापमान इकाई",
    "Time Zone": "समय क्षेत्र",
    Language: "भाषा",
    "Dark Mode": "डार्क मोड",
    "Auto Update": "ऑटो अपडेट",
    View: "देखें",
    "Restart System": "सिस्टम पुनः शुरू करें",
    "Clear Cache": "कैश साफ करें",
    "Backup Data": "डेटा बैकअप",
    "Export Logs": "लॉग निर्यात करें",
  },
  te: {
    Dashboard: "డాష్‌బోర్డ్",
    Rooms: "గదులు",
    Devices: "పరికరాలు",
    Energy: "శక్తి",
    Security: "భద్రత",
    Schedules: "షెడ్యూల్స్",
    Automation: "ఆటోమేషన్",
    Settings: "సెట్టింగ్స్",
    Account: "ఖాతా",
    General: "సాధారణం",
    Notifications: "నోటిఫికేషన్లు",
    Integrations: "ఇంటిగ్రేషన్లు",
    Backup: "బ్యాకప్",
    Privacy: "గోప్యత",
    "Quick Actions": "త్వరిత చర్యలు",
    "System Information": "సిస్టమ్ సమాచారం",
    "Save Changes": "మార్పులు సేవ్ చేయండి",
    View: "చూడండి",
  },
  ta: {
    Dashboard: "டாஷ்போர்டு",
    Rooms: "அறைகள்",
    Devices: "சாதனங்கள்",
    Energy: "ஆற்றல்",
    Security: "பாதுகாப்பு",
    Schedules: "அட்டவணைகள்",
    Automation: "தானியக்கம்",
    Settings: "அமைப்புகள்",
    Account: "கணக்கு",
    General: "பொது",
    Notifications: "அறிவிப்புகள்",
    Privacy: "தனியுரிமை",
    "Save Changes": "மாற்றங்களை சேமிக்கவும்",
    View: "பார்க்க",
  },
  es: {
    Dashboard: "Panel",
    Rooms: "Habitaciones",
    Devices: "Dispositivos",
    Energy: "Energía",
    Security: "Seguridad",
    Schedules: "Horarios",
    Automation: "Automatización",
    Settings: "Ajustes",
    Account: "Cuenta",
    General: "General",
    Notifications: "Notificaciones",
    Privacy: "Privacidad",
    "Quick Actions": "Acciones rápidas",
    "System Information": "Información del sistema",
    "Save Changes": "Guardar cambios",
    View: "Ver",
  },
  fr: {
    Dashboard: "Tableau de bord",
    Rooms: "Pièces",
    Devices: "Appareils",
    Energy: "Énergie",
    Security: "Sécurité",
    Schedules: "Plannings",
    Automation: "Automatisation",
    Settings: "Paramètres",
    Account: "Compte",
    General: "Général",
    Notifications: "Notifications",
    Privacy: "Confidentialité",
    "Save Changes": "Enregistrer",
    View: "Voir",
  },
  de: {
    Dashboard: "Dashboard",
    Rooms: "Räume",
    Devices: "Geräte",
    Energy: "Energie",
    Security: "Sicherheit",
    Schedules: "Zeitpläne",
    Automation: "Automatisierung",
    Settings: "Einstellungen",
    Account: "Konto",
    General: "Allgemein",
    Notifications: "Benachrichtigungen",
    Privacy: "Datenschutz",
    "Save Changes": "Änderungen speichern",
    View: "Anzeigen",
  },
  ja: {
    Dashboard: "ダッシュボード",
    Rooms: "部屋",
    Devices: "デバイス",
    Energy: "エネルギー",
    Security: "セキュリティ",
    Schedules: "スケジュール",
    Automation: "自動化",
    Settings: "設定",
    Account: "アカウント",
    General: "一般",
    Notifications: "通知",
    Privacy: "プライバシー",
    "Save Changes": "変更を保存",
    View: "表示",
  },
};

const ALIAS_TRANSLATIONS = {
  bn: "hi",
  mr: "hi",
  gu: "hi",
  kn: "hi",
  ml: "hi",
  pa: "hi",
  ur: "hi",
};

function getStoredLanguage() {
  try {
    const preferences = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    return localStorage.getItem("smart_home_language") || preferences.language || "en";
  } catch {
    return "en";
  }
}

function translatePage(language) {
  const dictionary = TRANSLATIONS[language] || TRANSLATIONS[ALIAS_TRANSLATIONS[language]] || {};
  document.documentElement.lang = language || "en";
  document.querySelectorAll("[data-i18n-original]").forEach((node) => {
    node.textContent = node.dataset.i18nOriginal;
  });
  if (!Object.keys(dictionary).length) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    const original = node.parentElement?.dataset.i18nOriginal || node.textContent.trim();
    if (!original || !dictionary[original]) return;
    node.parentElement.dataset.i18nOriginal = original;
    node.textContent = node.textContent.replace(original, dictionary[original]);
  });
}

const VIEWS = {
  overview: OverviewView,
  rooms: RoomsView,
  devices: DevicesView,
  energy: EnergyView,
  security: SecurityView,
  schedules: SchedulesView,
  automation: AutomationView,
  settings: SettingsView,
  access: AccessView,
};

function Dashboard() {
  const { currentView } = useApp();
  const View = VIEWS[currentView] || OverviewView;

  useEffect(() => {
    let language = getStoredLanguage();
    const apply = () => window.requestAnimationFrame(() => translatePage(language));
    apply();
    const handleLanguage = (event) => {
      language = event.detail?.language || getStoredLanguage();
      apply();
    };
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("smart-home-language-change", handleLanguage);
    return () => {
      observer.disconnect();
      window.removeEventListener("smart-home-language-change", handleLanguage);
    };
  }, [currentView]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className={`main view-${currentView}`}>
        <Topbar />
        <View />
      </main>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}
