// يرفع الدورات الجاهزة من seed/courses.json إلى Firestore.
//
// مع المحاكي:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed.js --project demo-smart-ai
// مع الإنتاج:   GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/seed.js --project <id>
import { readFile } from "node:fs/promises";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const projectId = args[args.indexOf("--project") + 1] || process.env.GCLOUD_PROJECT;
if (!args.includes("--project") || !projectId) {
  console.error("الاستخدام: node scripts/seed.js --project <project-id>");
  process.exit(1);
}

initializeApp({ projectId });
const db = getFirestore();

const courses = JSON.parse(await readFile(new URL("../seed/courses.json", import.meta.url), "utf8"));
const batch = db.batch();
for (const { id, ...course } of courses) {
  batch.set(db.doc(`courses/${id}`), { ...course, id, updatedAt: FieldValue.serverTimestamp() });
}
await batch.commit();
console.log(`تم رفع ${courses.length} دورات إلى المشروع ${projectId}.`);
