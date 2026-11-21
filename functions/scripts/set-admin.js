// يمنح مستخدماً صلاحية المشرف (لإنشاء الدورات بالذكاء الاصطناعي).
//
// node scripts/set-admin.js --project <project-id> user@example.com
// مع المحاكي أضف: FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);
const projectId = args[args.indexOf("--project") + 1];
const email = args.find((a) => a.includes("@"));
if (!args.includes("--project") || !projectId || !email) {
  console.error("الاستخدام: node scripts/set-admin.js --project <project-id> <email>");
  process.exit(1);
}

initializeApp({ projectId });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true });
console.log(`أصبح ${email} مشرفاً. يجب عليه تسجيل الخروج ثم الدخول لتفعيل الصلاحية.`);
