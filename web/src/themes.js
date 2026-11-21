// قوالب العرض: يختار المتدرب أحدها، فتتغير الألوان والخطوط والأشكال وترتيب الصفحة.
//   nav:    موضع القائمة (side: جانبية، top: شريط علوي)
//   layout: ترتيب صفحة المهارة (path: مسار رأسي بخطوات، cards: بطاقات، tabs: تبويبات)
//   map:    عرض قائمة المهارات (path: خريطة مسار، grid: شبكة بطاقات، list: قائمة)
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/noto-naskh-arabic/400.css";
import "@fontsource/noto-naskh-arabic/700.css";

export const THEMES = [
  {
    id: "emerald",
    name: "زمرّد",
    description: "هادئ ومتوازن، بمسار رأسي واضح الخطوات.",
    nav: "side",
    layout: "path",
    map: "path",
    swatch: ["#0f766e", "#d9f2ee", "#f6f7f5"],
  },
  {
    id: "midnight",
    name: "ليل",
    description: "داكن مريح للعين بلمسات ذهبية وزوايا حادة.",
    nav: "side",
    layout: "cards",
    map: "grid",
    swatch: ["#e3b341", "#1b2436", "#0b1120"],
  },
  {
    id: "sand",
    name: "رمال",
    description: "دافئ بألوان الأرض وحواف ناعمة وشريط علوي.",
    nav: "top",
    layout: "path",
    map: "list",
    swatch: ["#c2410c", "#fde7d4", "#fbf6ef"],
  },
  {
    id: "ocean",
    name: "محيط",
    description: "أزرق منعش، والمحتوى في تبويبات تركّز على خطوة واحدة.",
    nav: "top",
    layout: "tabs",
    map: "grid",
    swatch: ["#1d4ed8", "#dbeafe", "#f3f7fd"],
  },
  {
    id: "violet",
    name: "بنفسج",
    description: "مرح وحيوي بأزرار دائرية وبطاقات ممتلئة الألوان.",
    nav: "side",
    layout: "tabs",
    map: "path",
    swatch: ["#7c3aed", "#ede4ff", "#f8f5ff"],
  },
  {
    id: "paper",
    name: "ورق",
    description: "كلاسيكي بخط النسخ وخطوط رفيعة، كأنه كتاب مطبوع.",
    nav: "top",
    layout: "cards",
    map: "list",
    swatch: ["#9f1239", "#f1ebe1", "#fdfbf7"],
  },
];

const KEY = "smart-ai-theme";

export function themeById(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function applyTheme(id) {
  const t = themeById(id);
  const root = document.documentElement;
  root.dataset.theme = t.id;
  root.dataset.nav = t.nav;
  root.dataset.layout = t.layout;
  root.dataset.map = t.map;
  try {
    localStorage.setItem(KEY, t.id);
  } catch {
    /* التخزين المحلي غير متاح؛ نكتفي بالقالب للجلسة الحالية */
  }
  return t;
}

export function savedThemeId() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export const currentTheme = () => themeById(document.documentElement.dataset.theme);
