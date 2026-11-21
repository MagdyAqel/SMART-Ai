import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineInt, defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import {
  generateCourse as generateCourseWithClaude,
  generateQuiz as generateQuizWithClaude,
  gradeWithRubric,
  runTraineePrompt,
  streamTutorReply,
  toHttpsError,
} from "./claude.js";
import {
  InputError,
  normalizeCourse,
  computeGrade,
  normalizeQuestions,
  normalizeTask,
  parseCourseInput,
  parseQuizInput,
  parseSubmissionInput,
  parseTutorInput,
  slugify,
} from "./validate.js";

initializeApp();
const db = getFirestore();

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const DAILY_AI_LIMIT = defineInt("DAILY_AI_LIMIT", { default: 60 });

function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "سجّل الدخول أولاً.");
  return request.auth.uid;
}

function requireAdmin(request) {
  const uid = requireAuth(request);
  if (request.auth.token.admin !== true) throw new HttpsError("permission-denied", "هذه الميزة للمشرفين فقط.");
  return uid;
}

function parse(fn, data) {
  try {
    return fn(data);
  } catch (err) {
    if (err instanceof InputError) throw new HttpsError("invalid-argument", err.message);
    throw err;
  }
}

/** يحسب طلبات الذكاء الاصطناعي لكل متدرب يومياً حتى لا تتجاوز التكلفة الحد. */
async function consumeQuota(uid, cost = 1) {
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`usage/${uid}_${day}`);
  const limit = DAILY_AI_LIMIT.value();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? snap.get("count") : 0;
    if (count + cost > limit) {
      throw new HttpsError("resource-exhausted", `وصلت إلى الحد اليومي (${limit} طلباً). عُد غداً!`);
    }
    tx.set(ref, { uid, day, count: count + cost, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

async function loadLesson(courseId, lessonId) {
  const snap = await db.doc(`courses/${courseId}`).get();
  if (!snap.exists) return null;
  const course = snap.data();
  const lesson = course.lessons?.find((l) => l.id === lessonId);
  return lesson ? { course, lesson } : null;
}

const aiOptions = { secrets: [ANTHROPIC_API_KEY], memory: "512MiB" };

/** المدرّب الذكي: محادثة مبثوثة، مع سياق الدرس الحالي إن وُجد. */
export const tutorChat = onCall({ ...aiOptions, timeoutSeconds: 300 }, async (request, response) => {
  const uid = requireAuth(request);
  const input = parse(parseTutorInput, request.data);
  await consumeQuota(uid);
  const lesson = input.courseId && input.lessonId ? await loadLesson(input.courseId, input.lessonId) : null;
  try {
    const result = await streamTutorReply({
      apiKey: ANTHROPIC_API_KEY.value(),
      messages: input.messages,
      lesson,
      signal: response?.signal,
      onText: async (text) => {
        if (request.acceptsStreaming) await response.sendChunk(text);
      },
    });
    return result;
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** يولّد اختباراً من موضوع أو نص مرجعي، ويحفظه في حساب المتدرب. */
export const generateQuiz = onCall({ ...aiOptions, timeoutSeconds: 300 }, async (request) => {
  const uid = requireAuth(request);
  const input = parse(parseQuizInput, request.data);
  await consumeQuota(uid);
  let quiz;
  try {
    quiz = await generateQuizWithClaude({ apiKey: ANTHROPIC_API_KEY.value(), input });
  } catch (err) {
    throw toHttpsError(err);
  }
  const questions = normalizeQuestions(quiz.questions);
  if (questions.length === 0) {
    throw new HttpsError("internal", "لم يُنتج النموذج أسئلة صالحة، حاول مرة أخرى.");
  }
  const doc = {
    title: quiz.title?.trim() || input.topic || "اختبار مولَّد",
    topic: input.topic,
    difficulty: input.difficulty,
    fromSource: Boolean(input.sourceText),
    questions,
    createdAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(`users/${uid}/quizzes`).add(doc);
  return { id: ref.id, title: doc.title, questions };
});

/** للمشرفين: يبني دورة كاملة (دروس وأسئلة) وينشرها في المنصة. */
export const generateCourse = onCall({ ...aiOptions, timeoutSeconds: 540, memory: "1GiB" }, async (request) => {
  const uid = requireAdmin(request);
  const input = parse(parseCourseInput, request.data);
  let course;
  try {
    course = await generateCourseWithClaude({ apiKey: ANTHROPIC_API_KEY.value(), input });
  } catch (err) {
    throw toHttpsError(err);
  }
  const base = slugify(input.topic, "course");
  const courseId = `${base}-${Date.now().toString(36)}`;
  const doc = parse((c) => normalizeCourse(c, { courseId }), course);
  const order = Date.now();
  await db.doc(`courses/${courseId}`).set({
    ...doc,
    order,
    generated: true,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: courseId, title: doc.title, lessons: doc.lessons.length };
});

/**
 * التصحيح الذاتي لمهمة تطبيقية: تُقرأ المهمة ومعاييرها من Firestore (لا من المتصفح)،
 * ويُشغَّل برومبت المتدرب إن كانت المهمة برومبت، ثم يُقيَّم العمل وفق المعايير.
 */
export const gradeSubmission = onCall({ ...aiOptions, timeoutSeconds: 300 }, async (request) => {
  const uid = requireAuth(request);
  const input = parse(parseSubmissionInput, request.data);
  const found = await loadLesson(input.courseId, input.lessonId);
  const rawTask = found?.lesson.tasks?.find((t) => t.id === input.taskId);
  const task = rawTask ? normalizeTask(rawTask) : null;
  if (!task) throw new HttpsError("not-found", "لم نجد هذه المهمة.");

  // تشغيل البرومبت ثم تقييمه طلبان للنموذج.
  await consumeQuota(uid, task.runPrompt ? 2 : 1);

  const apiKey = ANTHROPIC_API_KEY.value();
  let output = null;
  let grade;
  try {
    if (task.runPrompt) output = (await runTraineePrompt({ apiKey, prompt: input.answer, material: task.material })).text;
    grade = computeGrade(task.rubric, await gradeWithRubric({ apiKey, task, answer: input.answer, output }), task.passScore);
  } catch (err) {
    throw toHttpsError(err);
  }

  const submission = {
    courseId: input.courseId,
    lessonId: input.lessonId,
    taskId: task.id,
    taskTitle: task.title,
    lessonTitle: found.lesson.title,
    type: task.type,
    answer: input.answer,
    output,
    passScore: task.passScore,
    ...grade,
  };
  const userRef = db.doc(`users/${uid}`);
  const key = `${input.courseId}__${input.lessonId}__${task.id}`;
  const subRef = userRef.collection("submissions").doc();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const prev = snap.get(`tasks.${key}`) ?? null;
    tx.set(subRef, { ...submission, createdAt: FieldValue.serverTimestamp() });
    tx.set(
      userRef,
      {
        tasks: {
          [key]: {
            best: Math.max(prev?.best ?? 0, grade.pct),
            passed: Boolean(prev?.passed) || grade.passed,
            attempts: (prev?.attempts ?? 0) + 1,
            lastAt: Date.now(),
          },
        },
      },
      { merge: true },
    );
    submission.firstPass = grade.passed && !prev?.passed;
  });
  return { id: subRef.id, ...submission };
});
