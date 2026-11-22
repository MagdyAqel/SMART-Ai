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
const hasFile = (url) => typeof url === "string" && url.startsWith("/") && existsSync(new URL("." + url, PUBLIC));
function availableMedia(skill) {
  const video = skill.video && hasFile(skill.video.url) ? { ...skill.video, poster: hasFile(skill.video.poster) ? skill.video.poster : "" } : null;
  const infographic = skill.infographic && hasFile(skill.infographic.url) ? skill.infographic : null;
  const examples = (skill.examples || []).filter((x) => hasFile(x.url));
  const cover = hasFile(skill.cover) ? skill.cover : "";
  return { video, infographic, examples, cover };
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
  if (prev && !force && !(prev.comingSoon && hasContent)) {
    // مهارة منشورة: نضيف فقط الوسائط التي أصبحت متاحة ولم تكن في الوثيقة
    if (hasContent) {
      const media = availableMedia(JSON.parse(readFileSync(file, "utf8")));
      const patch = {};
      if (!prev.video?.url && media.video) patch.video = media.video;
      if (!prev.infographic?.url && media.infographic) patch.infographic = media.infographic;
      if ((prev.examples || []).length < media.examples.length) patch.examples = media.examples;
      if (!prev.cover && media.cover) patch.cover = media.cover;
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
