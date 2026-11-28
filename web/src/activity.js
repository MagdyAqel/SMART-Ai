// قياس نشاط المتدرب للتقارير: عدد مرات فتح المنصة، ومدة النشاط الفعلي (الصفحة ظاهرة ويتفاعل معها
// أو يشاهد فيديو)، وآخر ظهور، والنشاط اليومي. تُجمع الثواني محلياً وتُرسل دفعة كل دقيقتين
// وعند إخفاء الصفحة، بزيادات (increment) فلا تتعارض مع حفظ التقدّم.
import { doc, increment, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase.js";

const TICK = 15; // ثانية
const IDLE_AFTER = 120_000; // بلا تفاعل دقيقتين = غير نشط (إلا إن كان فيديو يعمل)
const FLUSH_EVERY = 120_000;

let uid = null;
let pending = 0;
let lastInput = Date.now();
let timers = [];

const today = () => new Date().toISOString().slice(0, 10);
const videoPlaying = () => [...document.querySelectorAll("video")].some((v) => !v.paused && !v.ended);

function flush() {
  if (!uid || pending <= 0) return;
  const secs = pending;
  pending = 0;
  updateDoc(doc(db, "users", uid), {
    "stats.activeSeconds": increment(secs),
    [`stats.daily.${today()}`]: increment(secs),
    "stats.lastSeen": serverTimestamp(),
  }).catch(() => (pending += secs)); // دون اتصال: نعيد المحاولة في الدفعة التالية
}

const onInput = () => (lastInput = Date.now());
const onHide = () => document.visibilityState === "hidden" && flush();

export function startActivity(userId) {
  stopActivity();
  uid = userId;
  // زيارة جديدة مرة واحدة لكل جلسة متصفح (تحديث الصفحة لا يُحسب زيارة)
  const key = `visit:${uid}`;
  let counted = false;
  try {
    counted = sessionStorage.getItem(key) === "1";
    sessionStorage.setItem(key, "1");
  } catch {}
  if (!counted) {
    updateDoc(doc(db, "users", uid), {
      "stats.visits": increment(1),
      "stats.lastSeen": serverTimestamp(),
      [`stats.visitDays.${today()}`]: increment(1),
    }).catch(() => {});
  }
  for (const ev of ["pointerdown", "keydown", "scroll", "touchstart"]) window.addEventListener(ev, onInput, { passive: true });
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
  timers = [
    setInterval(() => {
      const visible = document.visibilityState === "visible";
      if (visible && (Date.now() - lastInput < IDLE_AFTER || videoPlaying())) pending += TICK;
    }, TICK * 1000),
    setInterval(flush, FLUSH_EVERY),
  ];
}

export function stopActivity() {
  flush();
  timers.forEach(clearInterval);
  timers = [];
  for (const ev of ["pointerdown", "keydown", "scroll", "touchstart"]) window.removeEventListener(ev, onInput);
  document.removeEventListener("visibilitychange", onHide);
  window.removeEventListener("pagehide", flush);
  uid = null;
}
