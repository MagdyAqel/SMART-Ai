// يرفع المهارات من مجلد content إلى Firestore:
//   - المهارة التي لها content/<id>/skill.json تُرفع كاملة،
//     وتُفصل إجابات الاختبار البعدي إلى courseKeys/<id> (لا يقرؤها المتدرب).
//   - بقية مهارات content/skills.json تُرفع «قريباً» لتظهر للمتدربين في المسار.
//   - تُنشأ إعدادات المنصة settings/platform إن لم تكن موجودة (نسبة النجاح 70%).
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
const catalog = JSON.parse(readFileSync(new URL("skills.json", CONTENT), "utf8"));

const batch = db.batch();
for (const entry of catalog) {
  const file = new URL(`${entry.id}/skill.json`, CONTENT);
  const base = { ...entry, order: entry.number, updatedAt: FieldValue.serverTimestamp() };
  if (!existsSync(file)) {
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
    postTest: { passScore: skill.postTest?.passScore ?? null, questions },
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`courseKeys/${entry.id}`), { postTest: keys });
}
await batch.commit();

const settingsRef = db.doc("settings/platform");
if (!(await settingsRef.get()).exists) await settingsRef.set({ passScore: 70, sequential: true });

console.log(`تم رفع ${catalog.length} مهارة إلى المشروع ${projectId}.`);
