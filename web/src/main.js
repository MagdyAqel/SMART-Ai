import "./styles.css";
import { applyTheme, savedThemeId } from "./themes.js";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { FREE_PLAN, auth, isConfigured } from "./firebase.js";
import { dueReviews } from "./engine.js";
import { loadProgress, state } from "./store.js";
import { errorMessage, esc, go } from "./ui.js";
import * as authView from "./views/auth.js";
import * as dashboard from "./views/dashboard.js";
import * as courses from "./views/courses.js";
import * as course from "./views/course.js";
import * as lesson from "./views/lesson.js";
import * as quiz from "./views/quiz.js";
import * as review from "./views/review.js";
import * as generate from "./views/generate.js";
import * as tutor from "./views/tutor.js";
import * as admin from "./views/admin.js";
import * as adminCourse from "./views/admin-course.js";
import * as task from "./views/task.js";
import * as performance from "./views/performance.js";
import * as posttest from "./views/posttest.js";
import * as themes from "./views/themes.js";

const routes = [
  { re: /^\/$/, view: dashboard, nav: "home" },
  { re: /^\/courses$/, view: courses, nav: "courses" },
  { re: /^\/course\/([\w-]+)$/, view: course, nav: "courses", keys: ["courseId"] },
  { re: /^\/lesson\/([\w-]+)\/([\w-]+)$/, view: lesson, nav: "courses", keys: ["courseId", "lessonId"] },
  { re: /^\/quiz$/, view: quiz, nav: null },
  { re: /^\/review$/, view: review, nav: "review" },
  { re: /^\/generate$/, view: generate, nav: "generate", ai: true },
  { re: /^\/tutor$/, view: tutor, nav: "tutor", ai: true },
  { re: /^\/task\/([\w-]+)\/([\w-]+)\/([\w-]+)$/, view: task, nav: "courses", keys: ["courseId", "lessonId", "taskId"] },
  { re: /^\/performance$/, view: performance, nav: "performance" },
  { re: /^\/posttest\/([\w-]+)$/, view: posttest, nav: "courses", keys: ["courseId"] },
  { re: /^\/themes$/, view: themes, nav: null },
  { re: /^\/admin$/, view: admin, nav: "admin", admin: true },
  { re: /^\/admin\/course\/([\w-]+)$/, view: adminCourse, nav: "admin", admin: true, keys: ["courseId"] },
];

const NAV = [
  { id: "home", href: "/", icon: "🏠", label: "الرئيسية" },
  { id: "courses", href: "/courses", icon: "🧭", label: "المهارات" },
  { id: "review", href: "/review", icon: "🔁", label: "المراجعة" },
  { id: "performance", href: "/performance", icon: "📈", label: "أدائي" },
  { id: "generate", href: "/generate", icon: "✨", label: "اختبار ذكي", ai: true },
  { id: "tutor", href: "/tutor", icon: "🤖", label: "المدرّب", ai: true },
  { id: "admin", href: "/admin", icon: "🛠️", label: "الإدارة", admin: true },
];

const root = document.getElementById("app");
let cleanup = null;
let currentNav = null;
window.addEventListener("progress-changed", () => renderNav(currentNav));
// وصلت نسخة أحدث من المهارات من الخادم: نعيد عرض صفحات التصفّح فقط (لا نقطع درساً أو اختباراً جارياً)
window.addEventListener("courses-changed", () => {
  const path = location.hash.slice(1).split("?")[0] || "/";
  const browsing = path === "/" || path === "/courses" || path.startsWith("/course/");
  // صفحة الدرس: نحدّثها (مثلاً فيديو أُعيد إنتاجه) ما لم يبدأ المتدرب المشاهدة
  const idleLesson = path.startsWith("/lesson/") && ![...document.querySelectorAll("video")].some((v) => v.currentTime > 0);
  if (browsing || idleLesson) route();
});

function shell() {
  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#/"><span class="logo" aria-hidden="true">◆</span> منصة التدريب الذكي</a>
      <div class="user">
        <span class="user-name">${esc(state.progress?.name || "")}</span>
        <a class="btn ghost small" href="#/themes" title="قالب العرض">🎨 القالب</a>
        <button class="btn ghost small" id="sign-out">خروج</button>
      </div>
    </header>
    <nav class="nav" aria-label="القائمة الرئيسية"></nav>
    <main id="view" tabindex="-1"></main>`;
  root.querySelector("#sign-out").addEventListener("click", () => signOut(auth));
}

function renderNav(active) {
  currentNav = active;
  const nav = root.querySelector(".nav");
  if (!nav) return;
  const due = state.progress ? dueReviews(state.progress.review, Date.now()).length : 0;
  nav.innerHTML = NAV.filter((n) => (!n.admin || state.isAdmin) && !(n.ai && FREE_PLAN))
    .map(
      (n) => `<a href="#${n.href}" class="${n.id === active ? "active" : ""}" ${n.id === active ? 'aria-current="page"' : ""}>
        <span aria-hidden="true">${n.icon}</span><span>${n.label}</span>${
          n.id === "review" && due ? `<b class="badge" aria-label="${due} أسئلة مستحقة">${due}</b>` : ""
        }</a>`,
    )
    .join("");
}

async function route() {
  // ننتظر تحميل تقدّم المتدرب قبل عرض أي صفحة (أثناء تسجيل الدخول)
  if (!state.user || !state.progress) return;
  const [path, qs] = (location.hash.slice(1) || "/").split("?");
  const match = routes.map((r) => ({ r, m: path.match(r.re) })).find((x) => x.m);
  if (!match || (match.r.admin && !state.isAdmin) || (match.r.ai && FREE_PLAN)) return go("/");
  const params = Object.fromEntries((match.r.keys || []).map((k, i) => [k, decodeURIComponent(match.m[i + 1])]));
  if (typeof cleanup === "function") cleanup();
  cleanup = null;
  renderNav(match.r.nav);
  // عنصر جديد لكل صفحة حتى لا تبقى مستمعات الأحداث من الصفحة السابقة.
  const old = document.getElementById("view");
  const view = old.cloneNode(false);
  old.replaceWith(view);
  window.scrollTo(0, 0);
  try {
    cleanup = await match.r.view.render(view, params, new URLSearchParams(qs || ""));
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card error">تعذّر عرض الصفحة: ${esc(errorMessage(err))}</div>`;
  }
  view.focus({ preventScroll: true });
}

function notConfigured() {
  root.innerHTML = `<main class="center"><div class="card narrow">
    <h1>إعداد Firebase مطلوب</h1>
    <p>انسخ الملف <code>web/.env.example</code> إلى <code>web/.env.local</code> واملأه ببيانات تطبيق الويب من Firebase Console، ثم أعد تشغيل الخادم.</p>
    <p class="muted">للتجربة المحلية دون مشروع حقيقي: ضع <code>VITE_USE_EMULATORS=true</code> وشغّل محاكيات Firebase.</p>
  </div></main>`;
}

applyTheme(savedThemeId());

// تطبيق قابل للتثبيت: عامل الخدمة يحفظ الواجهة والصور على الجهاز (في النسخة المنشورة فقط)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

if (!isConfigured) {
  notConfigured();
} else {
  window.addEventListener("hashchange", route);
  onAuthStateChanged(auth, async (user) => {
    if (typeof cleanup === "function") cleanup();
    cleanup = null;
    state.user = user;
    state.progress = null;
    state.courses = null;
    state.quiz = null;
    state.settings = null;
    if (!user) {
      state.isAdmin = false;
      cleanup = await authView.render(root);
      return;
    }
    root.innerHTML = `<main class="center">${'<div class="loading"><span class="spin"></span>جارٍ تجهيز حسابك…</div>'}</main>`;
    try {
      const token = await user.getIdTokenResult();
      state.isAdmin = token.claims.admin === true;
      await loadProgress(user);
      // قالب العرض المحفوظ في الحساب يتبع المتدرب على كل أجهزته
      if (state.progress.theme) applyTheme(state.progress.theme);
    } catch (err) {
      root.innerHTML = `<main class="center"><div class="card error">تعذّر تحميل حسابك: ${esc(errorMessage(err))}</div></main>`;
      return;
    }
    shell();
    route();
  });
}
