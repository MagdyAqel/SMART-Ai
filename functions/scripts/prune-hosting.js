// يحذف نسخ الموقع القديمة في Firebase Hosting قبل كل نشر، حتى لا تمتلئ مساحة الاستضافة
// (كل نسخة تحمل الفيديوهات كلها، والخطة المجانية تتيح 10 غيغابايت فقط).
// يُبقي النسخة المنشورة حالياً والنسخة السابقة لها فقط، ويضبط القناة لتحتفظ بإصدارين.
//
// node scripts/prune-hosting.js --project <project-id>
import { GoogleAuth } from "google-auth-library";

const args = process.argv.slice(2);
const site = args[args.indexOf("--project") + 1];
if (!args.includes("--project") || !site) {
  console.error("الاستخدام: node scripts/prune-hosting.js --project <project-id>");
  process.exit(1);
}
const KEEP = 2;
const API = `https://firebasehosting.googleapis.com/v1beta1/sites/${site}`;
const client = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/firebase.hosting"] }).getClient();
const call = async (method, url, data) => (await client.request({ method, url, data })).data;

// 1) القناة الحية تحتفظ بإصدارين فقط من الآن فصاعداً
await call("PATCH", `${API}/channels/live?updateMask=retainedReleaseCount`, { retainedReleaseCount: KEEP });

// 2) النسخ المحمية: نسخ آخر إصدارين على القناة الحية
const releases = (await call("GET", `${API}/channels/live/releases?pageSize=${KEEP}`)).releases || [];
const keep = new Set(releases.map((r) => r.version?.name).filter(Boolean));

// 3) حذف كل نسخة أخرى
let versions = [];
let pageToken = "";
do {
  const page = await call("GET", `${API}/versions?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`);
  versions = versions.concat(page.versions || []);
  pageToken = page.nextPageToken || "";
} while (pageToken);

let deleted = 0;
let freed = 0;
for (const v of versions) {
  if (keep.has(v.name) || v.status === "DELETED") continue;
  try {
    await call("DELETE", `https://firebasehosting.googleapis.com/v1beta1/${v.name}`);
    deleted++;
    freed += Number(v.versionBytes || 0);
  } catch (e) {
    console.warn(`تعذّر حذف ${v.name}: ${e.response?.data?.error?.message || e.message}`);
  }
}
console.log(`نسخ الموقع: ${versions.length}، محفوظة ${keep.size}، محذوفة ${deleted} (≈ ${(freed / 1e9).toFixed(1)} غيغابايت).`);
