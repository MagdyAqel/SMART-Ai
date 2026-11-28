// يرفع المهارات من مجلد content إلى Firestore:
//   - المهارة التي لها content/<id>/skill.json تُرفع كاملة،
//     وتُفصل إجابات الاختبار البعدي إلى courseKeys/<id> (لا يقرؤها المتدرب).
//   - بقية مهارات content/skills.json تُرفع «قريباً» لتظهر للمتدربين في المسار.
//   - تُنشأ إعدادات المنصة settings/platform إن لم تكن موجودة (نسبة النجاح 70%).
//   - المهارة الموجودة مسبقاً لا تُستبدل (حتى لا تضيع تعديلات المشرف من المحرّر)،
//     إلا مع --force، أو إذا كانت «قريباً» وأصبح لها محتوى في content.
//
// مع المحاكي:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed.js --project demo-smart-ai
// مع الإنتاج:   node scripts/seed.js --project <id>   (بعد gcloud auth application-default login)
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const projectId = args[args.indexOf("--project") + 1];
if (!args.includes("--project") || !projectId) {
  console.error("الاستخدام: node scripts/seed.js --project <project-id>");
  process.exit(1);
}
initializeApp({ projectId });
const db = getFirestore();

const CONTENT = new URL("../../content/", import.meta.url);
const PUBLIC = new URL("../../web/public/", import.meta.url);
// الوسائط التي لم تُنتج بعد لا تُعرض (تظهر للمتدرب «سيُضاف قريباً»)
const bare = (url) => String(url || "").split("?")[0];
const hasFile = (url) => typeof url === "string" && url.startsWith("/") && existsSync(new URL("." + bare(url), PUBLIC));
// رقم إصدار من محتوى الملف: إذا أُعيد إنتاج فيديو تغيّر رابطه، فلا يعرض المتصفح نسخة قديمة محفوظة
const hashes = new Map();
const ver = (url) => {
  if (!hasFile(url)) return url;
  const path = bare(url);
  if (!hashes.has(path)) hashes.set(path, createHash("md5").update(readFileSync(new URL("." + path, PUBLIC))).digest("hex").slice(0, 8));
  return `${path}?v=${hashes.get(path)}`;
};
// الملف المحلي نفسه بإصدار مختلف (نحدّثه)، لا رابط وضعه المشرف بنفسه (نتركه)
const sameFile = (a, b) => String(a || "").startsWith("/") && bare(a) === bare(b);
const versioned = (m) => ({
  ...m,
  url: ver(m.url),
  ...(m.poster !== undefined ? { poster: hasFile(m.poster) ? ver(m.poster) : "" } : {}),
  ...(m.captions ? { captions: hasFile(m.captions) ? ver(m.captions) : "" } : {}),
});
function availableMedia(skill) {
  const vid = (v) => (v && hasFile(v.url) ? versioned({ poster: "", ...v }) : null);
  const video = vid(skill.video);
  const tutorial = vid(skill.tutorial);
  const videos = (skill.videos || []).map(vid).filter(Boolean);
  const infographic = skill.infographic && hasFile(skill.infographic.url) ? versioned(skill.infographic) : null;
  const examples = (skill.examples || []).filter((x) => hasFile(x.url)).map(versioned);
  const cover = hasFile(skill.cover) ? ver(skill.cover) : "";
  // وسائط الدروس: نُخفي ملفات الموقع التي لم تُنتج بعد، ونُبقي الروابط الخارجية كما هي
  const lessons = (skill.lessons || []).map((L) => ({
    ...L,
    media: (L.media || [])
      .filter((m) => !String(m.url || "").startsWith("/") || hasFile(m.url))
      .map((m) => (String(m.url || "").startsWith("/") ? versioned(m) : m)),
  }));
  return { video, tutorial, videos, infographic, examples, cover, lessons };
}
const catalog = JSON.parse(readFileSync(new URL("skills.json", CONTENT), "utf8"));

const force = args.includes("--force");
const existing = new Map((await db.collection("courses").get()).docs.map((d) => [d.id, d.data()]));
const batch = db.batch();
let written = 0;
for (const entry of catalog) {
  const file = new URL(`${entry.id}/skill.json`, CONTENT);
  const prev = existing.get(entry.id);
  const hasContent = existsSync(file);
  // رفع contentVersion في skill.json يستبدل المهارة كاملة في النشر العادي (دون حاجة إلى --force)
  const repoVersion = hasContent ? JSON.parse(readFileSync(file, "utf8")).contentVersion || 0 : 0;
  const newer = repoVersion > (prev?.contentVersion || 0);
  if (prev && !force && !newer && !(prev.comingSoon && hasContent)) {
    // مهارة منشورة: نضيف فقط الوسائط التي أصبحت متاحة ولم تكن في الوثيقة
    if (hasContent) {
      const media = availableMedia(JSON.parse(readFileSync(file, "utf8")));
      const patch = {};
      // جديد، أو الملف نفسه بإصدار أحدث
      const fresh = (old, cur) => cur && (!old?.url || (sameFile(old.url, cur.url) && JSON.stringify(old) !== JSON.stringify(cur)));
      if (fresh(prev.video, media.video)) patch.video = media.video;
      if (fresh(prev.tutorial, media.tutorial)) patch.tutorial = media.tutorial;
      const pv = prev.videos || [];
      if (pv.length < media.videos.length || pv.some((v, i) => fresh(v, media.videos[i]))) patch.videos = media.videos;
      if (fresh(prev.infographic, media.infographic)) patch.infographic = media.infographic;
      if ((prev.examples || []).length < media.examples.length) patch.examples = media.examples;
      if (!prev.cover && media.cover) patch.cover = media.cover;
      // فيديوهات الدروس الجديدة: تُضاف إلى وسائط الدرس المطابق دون المساس بنصه أو أسئلته
      if (Array.isArray(prev.lessons)) {
        const repo = new Map(media.lessons.map((L) => [L.id, L.media || []]));
        let changed = false;
        const lessons = prev.lessons.map((L) => {
          const cur = repo.get(L.id) || [];
          const old = L.media || [];
          // نحدّث إصدار الملفات الموجودة، ونضيف الجديدة في البداية
          const updated = old.map((m) => cur.find((c) => sameFile(m.url, c.url)) || m);
          const add = cur.filter((c) => !old.some((m) => sameFile(m.url, c.url) || m.url === c.url));
          if (!add.length && JSON.stringify(updated) === JSON.stringify(old)) return L;
          changed = true;
          return { ...L, media: [...add, ...updated] };
        });
        if (changed) patch.lessons = lessons;
      }
      if (Object.keys(patch).length) {
        batch.set(db.doc(`courses/${entry.id}`), patch, { merge: true });
        console.log(`  ${entry.id}: أُضيفت وسائط جديدة (${Object.keys(patch).join("، ")})`);
      }
    }
    continue;
  }
  written++;
  const base = { ...entry, order: entry.number, updatedAt: FieldValue.serverTimestamp() };
  if (!hasContent) {
    batch.set(db.doc(`courses/${entry.id}`), { ...base, comingSoon: true, lessons: [] });
    continue;
  }
  const skill = JSON.parse(readFileSync(file, "utf8"));
  const keys = {};
  const questions = (skill.postTest?.questions ?? []).map(({ answer, explanation, ...q }) => {
    keys[q.id] = { answer, explanation: explanation ?? "" };
    return q;
  });
  batch.set(db.doc(`courses/${entry.id}`), {
    ...base,
    ...skill,
    order: skill.order ?? entry.number,
    comingSoon: false,
    ...availableMedia(skill),
    postTest: { passScore: skill.postTest?.passScore ?? null, questions },
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`courseKeys/${entry.id}`), { postTest: keys });
}
await batch.commit();

const settingsRef = db.doc("settings/platform");
if (!(await settingsRef.get()).exists) await settingsRef.set({ passScore: 70, sequential: true });
// --free: الخطة المجانية بلا دوال سحابية (تصحيح الاختبار البعدي في المتصفح)
if (args.includes("--free")) await settingsRef.set({ freeMode: true }, { merge: true });
if (args.includes("--server-grading")) await settingsRef.set({ freeMode: false }, { merge: true });

console.log(`رُفعت ${written} مهارة من ${catalog.length} إلى المشروع ${projectId}${force ? " (مع الاستبدال)" : ""}.`);
