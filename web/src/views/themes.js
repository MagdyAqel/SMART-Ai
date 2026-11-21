// اختيار قالب العرض: معاينة حيّة لكل قالب، ويُحفظ الاختيار في حساب المتدرب.
import { THEMES, applyTheme, currentTheme } from "../themes.js";
import { saveTheme } from "../store.js";
import { esc, toast } from "../ui.js";

const NAV = { side: "قائمة جانبية", top: "شريط علوي" };
const LAYOUT = { path: "مسار رأسي بخطوات", cards: "بطاقات", tabs: "تبويبات" };

export async function render(el) {
  const draw = () => {
    const active = currentTheme().id;
    el.innerHTML = `
      <h1 class="page-title">🎨 قالب العرض</h1>
      <p class="lead">اختر الشكل الذي يريحك أثناء التدريب. يتغيّر كل شيء: الألوان والخط والأشكال وترتيب صفحة المهارة. يمكنك التبديل في أي وقت.</p>
      <div class="theme-grid">${THEMES.map(
        (t) => `<button class="theme-card ${t.id === active ? "selected" : ""}" data-theme-id="${t.id}" aria-pressed="${t.id === active}">
          <div class="theme-preview" data-preview="${t.id}" data-pnav="${t.nav}" data-playout="${t.layout}">
            <span class="pv-nav"></span>
            <span class="pv-main">
              <span class="pv-title"></span>
              <span class="pv-row"><i></i><i></i><i></i></span>
              <span class="pv-btn"></span>
            </span>
          </div>
          <div class="theme-info">
            <b>${esc(t.name)} ${t.id === active ? '<span class="tag d1">مُفعّل</span>' : ""}</b>
            <span>${esc(t.description)}</span>
            <span class="muted small">${NAV[t.nav]} · ${LAYOUT[t.layout]}</span>
            <span class="swatches">${t.swatch.map((c) => `<i style="background:${c}"></i>`).join("")}</span>
          </div>
        </button>`,
      ).join("")}</div>`;
  };
  draw();
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-id]");
    if (!b) return;
    const t = applyTheme(b.dataset.themeId);
    saveTheme(t.id);
    toast(`تم تفعيل قالب «${t.name}»`, "success");
    draw();
  });
}
