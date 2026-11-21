// طبقة البيانات: قراءة وكتابة Firestore، مع حالة مشتركة بسيطة في الذاكرة.
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { emptyProgress, levelProgress } from "./engine.js";

export const state = {
  user: null, // مستخدم Firebase Auth
  isAdmin: false,
  progress: null, // وثيقة users/{uid}
  courses: null, // ذاكرة مؤقتة لمجموعة courses
  quiz: null, // جلسة الاختبار الجارية
  tutorPrefill: null, // سؤال جاهز يُرسل عند فتح المدرب
  pendingName: null, // الاسم المكتوب عند إنشاء الحساب
};

export async function loadProgress(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    state.progress = { ...emptyProgress(), ...snap.data() };
  } else {
    state.progress = emptyProgress(state.pendingName || user.displayName || user.email?.split("@")[0] || "متدرب");
    await setDoc(ref, { ...state.progress, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  return state.progress;
}

let saveChain = Promise.resolve();
/** يحفظ التقدّم وسطر لوحة الصدارة. الحفظ متسلسل حتى لا تتداخل الكتابات. */
export function saveProgress(progress) {
  state.progress = progress;
  window.dispatchEvent(new Event("progress-changed"));
  const uid = state.user.uid;
  // tasks يكتبها الخادم فقط (التصحيح الذاتي)، فلا نرسلها من المتصفح.
  const { createdAt, updatedAt, tasks, ...data } = progress;
  saveChain = saveChain
    .then(() =>
      Promise.all([
        setDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() }, { merge: true }),
        setDoc(doc(db, "leaderboard", uid), {
          name: String(progress.name || "متدرب").slice(0, 60),
          xp: progress.xp,
          level: levelProgress(progress.xp).level,
          updatedAt: serverTimestamp(),
        }),
      ]),
    )
    .catch((err) => console.error("تعذّر حفظ التقدّم", err));
  return saveChain;
}

export function logAttempt(attempt) {
  return addDoc(collection(db, "users", state.user.uid, "attempts"), {
    ...attempt,
    at: serverTimestamp(),
  }).catch((err) => console.error("تعذّر حفظ المحاولة", err));
}

export async function loadCourses(force = false) {
  if (state.courses && !force) return state.courses;
  const snap = await getDocs(query(collection(db, "courses"), orderBy("order")));
  state.courses = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  return state.courses;
}

export async function findLesson(courseId, lessonId) {
  const courses = await loadCourses();
  const course = courses.find((c) => c.id === courseId);
  const lesson = course?.lessons.find((l) => l.id === lessonId);
  return { course, lesson };
}

export async function skillLabels() {
  const courses = await loadCourses();
  const labels = { generated: "اختبارات مخصّصة" };
  for (const c of courses) for (const l of c.lessons) labels[l.skill] = l.title;
  return labels;
}

export async function loadMyQuizzes() {
  const snap = await getDocs(
    query(collection(db, "users", state.user.uid, "quizzes"), orderBy("createdAt", "desc"), limit(20)),
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export async function loadLeaderboard() {
  const snap = await getDocs(query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(10)));
  return snap.docs.map((d) => ({ ...d.data(), uid: d.id }));
}

export async function loadSubmissions(max = 50) {
  const snap = await getDocs(
    query(collection(db, "users", state.user.uid, "submissions"), orderBy("createdAt", "desc"), limit(max)),
  );
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export async function loadSubmission(id) {
  const snap = await getDoc(doc(db, "users", state.user.uid, "submissions", id));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}

export const taskKey = (courseId, lessonId, taskId) => `${courseId}__${lessonId}__${taskId}`;
