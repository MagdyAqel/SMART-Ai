import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const env = import.meta.env;
// الخطة المجانية: لا دوال سحابية ولا تخزين ملفات، فتُخفى ميزات الذكاء الاصطناعي والرفع.
export const FREE_PLAN = env.VITE_FREE_PLAN === "true";
export const useEmulators = env.VITE_USE_EMULATORS === "true";

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || (useEmulators ? "demo-key" : undefined),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || (useEmulators ? "demo-smart-ai" : undefined),
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || (useEmulators ? "demo-smart-ai.appspot.com" : undefined),
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const isConfigured = Boolean(config.apiKey && config.projectId);

export const app = isConfigured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
// حفظ محلي للبيانات (IndexedDB): تظهر المهارات فوراً عند الفتح، وتعمل الصفحات المفتوحة سابقاً دون إنترنت
export const db = app
  ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  : null;
export const functions = app ? getFunctions(app, env.VITE_FUNCTIONS_REGION || "us-central1") : null;
export const storage = app && !FREE_PLAN ? getStorage(app) : null;

if (app && useEmulators) {
  const host = window.location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
  if (storage) connectStorageEmulator(storage, host, 9199);
}

// مهلات العميل: توليد المحتوى قد يستغرق دقائق.
export const callTutor = app ? httpsCallable(functions, "tutorChat", { timeout: 300_000 }) : null;
export const callGenerateQuiz = app ? httpsCallable(functions, "generateQuiz", { timeout: 300_000 }) : null;
export const callGenerateCourse = app ? httpsCallable(functions, "generateCourse", { timeout: 540_000 }) : null;
export const callGradeSubmission = app ? httpsCallable(functions, "gradeSubmission", { timeout: 300_000 }) : null;
export const callSubmitPostTest = app ? httpsCallable(functions, "submitPostTest", { timeout: 60_000 }) : null;
