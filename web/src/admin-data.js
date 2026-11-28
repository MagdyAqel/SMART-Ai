// بيانات المتدربين للمشرف: قراءة كل الملفات، وتلخيص تقدّم كل متدرب ونشاطه (للتقارير وملف Excel).
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase.js";
import { lessonKey } from "./engine.js";

export async function loadAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ ...d.data(), uid: d.id }));
}

const toDate = (t) => (t?.toDate ? t.toDate() : t ? new Date(t) : null);

/** ملخص متدرب واحد بالنسبة إلى المهارات المنشورة. */
export function summarize(u, courses) {
  const live = courses.filter((c) => !c.comingSoon);
  const totalLessons = live.reduce((s, c) => s + (c.lessons?.length || 0), 0);
  const completed = u.completed || {};
  const lessonsDone = live.reduce(
    (s, c) => s + (c.lessons || []).filter((l) => completed[lessonKey(c.id, l.id)]).length,
    0,
  );
  const tests = u.postTests || {};
  const passedSkills = live.filter((c) => tests[c.id]?.passed);
  const tasks = Object.values(u.tasks || {});
  const stats = u.stats || {};
  return {
    uid: u.uid,
    name: u.name || "",
    email: u.email || "",
    xp: u.xp || 0,
    lessonsDone,
    totalLessons,
    progress: totalLessons ? Math.round((lessonsDone / totalLessons) * 100) : 0,
    skillsPassed: passedSkills.length,
    totalSkills: live.length,
    passedIds: passedSkills.map((c) => c.id),
    tasksSubmitted: tasks.length,
    tasksPassed: tasks.filter((t) => t.passed).length,
    visits: stats.visits || 0,
    activeSeconds: stats.activeSeconds || 0,
    daily: stats.daily || {},
    lastSeen: toDate(stats.lastSeen) || toDate(u.updatedAt),
    createdAt: toDate(u.createdAt),
    mustChangePassword: Boolean(u.mustChangePassword),
  };
}

/** مدة مقروءة بالعربية: «٣ س ٢٠ د» أو «١٢ د». */
export function duration(secs) {
  const m = Math.round((secs || 0) / 60);
  if (m < 60) return `${m.toLocaleString("ar-EG")} د`;
  return `${Math.floor(m / 60).toLocaleString("ar-EG")} س ${(m % 60).toLocaleString("ar-EG")} د`;
}
