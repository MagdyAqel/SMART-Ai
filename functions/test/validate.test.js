import { test } from "node:test";
import assert from "node:assert/strict";
import {
  InputError,
  normalizeCourse,
  normalizeQuestions,
  parseQuizInput,
  parseTutorInput,
  slugify,
} from "../src/validate.js";

test("parseTutorInput keeps recent history starting with a user turn", () => {
  const messages = Array.from({ length: 25 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `m${i}`,
  }));
  const out = parseTutorInput({ messages, courseId: "python-basics", lessonId: "loops" });
  assert.equal(out.messages[0].role, "user");
  assert.ok(out.messages.length <= 20);
  assert.equal(out.messages.at(-1).content, "m24");
  assert.equal(out.courseId, "python-basics");
});

test("parseTutorInput rejects bad input", () => {
  assert.throws(() => parseTutorInput({ messages: [] }), InputError);
  assert.throws(() => parseTutorInput({ messages: [{ role: "system", content: "x" }] }), InputError);
  assert.throws(() => parseTutorInput({ messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "yo" }] }), InputError);
  assert.throws(() => parseTutorInput({ messages: [{ role: "user", content: "x".repeat(4001) }] }), InputError);
  assert.throws(() => parseTutorInput({ messages: [{ role: "user", content: "hi" }], courseId: "../etc" }), InputError);
});

test("parseQuizInput applies defaults and bounds", () => {
  assert.deepEqual(parseQuizInput({ topic: "الكسور" }), { topic: "الكسور", sourceText: "", difficulty: "mixed", count: 5 });
  assert.equal(parseQuizInput({ topic: "x y", difficulty: 3, count: 10 }).difficulty, 3);
  assert.throws(() => parseQuizInput({ topic: "" }), InputError);
  assert.throws(() => parseQuizInput({ topic: "abc", count: 50 }), InputError);
  assert.throws(() => parseQuizInput({ topic: "abc", difficulty: 7 }), InputError);
});

test("normalizeQuestions drops malformed questions and assigns ids", () => {
  const out = normalizeQuestions([
    { q: "صحيح؟", options: ["أ", "ب", "ج", "د"], answer: 2, explanation: "لأن", difficulty: 9 },
    { q: "إجابة خارج النطاق", options: ["أ", "ب"], answer: 5 },
    { q: "خيارات مكررة", options: ["أ", "أ", "ب", "ج"], answer: 0 },
    { q: "", options: ["أ", "ب"], answer: 0 },
    { q: "ثاني صحيح", options: ["1", "2", "3", "4"], answer: 0 },
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((q) => q.id), ["q1", "q2"]);
  assert.equal(out[0].difficulty, 3);
});

test("normalizeCourse builds lesson ids and skills", () => {
  const course = normalizeCourse(
    {
      title: "دورة",
      description: "وصف",
      icon: "📘",
      level: "مبتدئ",
      lessons: [
        { title: "درس", minutes: 5, content: ["فقرة"], questions: [{ q: "س", options: ["أ", "ب", "ج", "د"], answer: 1, explanation: "", difficulty: 1 }] },
        { title: "درس فارغ", minutes: 5, content: [], questions: [] },
      ],
    },
    { courseId: "c1" },
  );
  assert.equal(course.lessons.length, 1);
  assert.equal(course.lessons[0].id, "l1");
  assert.equal(course.lessons[0].skill, "c1-l1");
});

test("slugify falls back for non-latin text", () => {
  assert.equal(slugify("الأمن السيبراني", "course"), "course");
  assert.equal(slugify("Excel Basics 101"), "excel-basics-101");
});

import { computeGrade, normalizeRubric, normalizeTask, parseSubmissionInput } from "../src/validate.js";

const rubric = normalizeRubric([
  { criterion: "الدور والسياق", points: 30 },
  { criterion: "الهدف", points: 40 },
  { criterion: "", points: 10 },
  { criterion: "صيغة المخرج", points: 30 },
]);

test("normalizeRubric assigns ids and drops empty criteria", () => {
  assert.deepEqual(rubric.map((c) => c.id), ["c1", "c2", "c3"]);
});

test("computeGrade clamps scores and computes totals server-side", () => {
  const g = computeGrade(
    rubric,
    {
      criteria: [
        { id: "c1", score: 999, evidence: "x", feedback: "y" }, // أعلى من الحد
        { id: "c2", score: -5 }, // سالب
        // c3 مفقود
        { id: "c9", score: 50 }, // معيار غير موجود
      ],
      strengths: ["قوة"],
      overall_feedback: "جيد",
    },
    70,
  );
  assert.deepEqual(g.criteria.map((c) => c.score), [30, 0, 0]);
  assert.equal(g.total, 30);
  assert.equal(g.max, 100);
  assert.equal(g.pct, 30);
  assert.equal(g.passed, false);
});

test("normalizeTask requires instructions and rubric; runPrompt only for prompt tasks", () => {
  assert.equal(normalizeTask({ title: "t", instructions: "", rubric }), null);
  assert.equal(normalizeTask({ title: "t", instructions: "i", rubric: [] }), null);
  const w = normalizeTask({ type: "written", title: "t", instructions: "i", rubric, runPrompt: true });
  assert.equal(w.runPrompt, false);
  const p = normalizeTask({ type: "prompt", title: "t", instructions: "i", rubric });
  assert.equal(p.runPrompt, true);
  assert.equal(p.passScore, 70);
});

test("parseSubmissionInput validates ids and answer length", () => {
  const ok = { courseId: "c", lessonId: "l1", taskId: "t1", answer: "اكتب لي خطة درس عن الكسور للصف الخامس" };
  assert.equal(parseSubmissionInput(ok).taskId, "t1");
  assert.throws(() => parseSubmissionInput({ ...ok, answer: "قصير" }), InputError);
  assert.throws(() => parseSubmissionInput({ ...ok, taskId: "../x" }), InputError);
});

import { gradePostTest, isUnlocked, parsePostTestInput, resolvePassScore } from "../src/validate.js";

test("post-test pass score: per-skill override, then platform setting, then default", () => {
  assert.equal(resolvePassScore({ postTest: { passScore: 85 } }, { passScore: 60 }), 85);
  assert.equal(resolvePassScore({ postTest: { passScore: null } }, { passScore: 60 }), 60);
  assert.equal(resolvePassScore({}, {}), 70);
});

test("skills unlock in order after passing the previous post-test", () => {
  const skills = [
    { id: "s2", order: 2 },
    { id: "s1", order: 1 },
    { id: "s3", order: 3 },
    { id: "soon", order: 4, comingSoon: true },
  ];
  assert.equal(isUnlocked(skills, "s1", {}), true);
  assert.equal(isUnlocked(skills, "s2", {}), false);
  assert.equal(isUnlocked(skills, "s2", { s1: { passed: true } }), true);
  assert.equal(isUnlocked(skills, "s3", { s1: { passed: true } }), false);
  assert.equal(isUnlocked(skills, "s3", {}, { sequential: false }), true);
});

test("gradePostTest scores answers against hidden keys", () => {
  const qs = [{ id: "q1" }, { id: "q2" }, { id: "q3" }, { id: "q4" }];
  const keys = { q1: { answer: 1, explanation: "a" }, q2: { answer: 0 }, q3: { answer: 2 }, q4: { answer: 3 } };
  const g = gradePostTest(qs, keys, { q1: 1, q2: 0, q3: 2, q4: 0 }, 70);
  assert.equal(g.score, 3);
  assert.equal(g.pct, 75);
  assert.equal(g.passed, true);
  assert.equal(gradePostTest(qs, keys, { q1: 1 }, 70).passed, false); // غير المُجاب خطأ
});

test("parsePostTestInput drops malformed answers", () => {
  const p = parsePostTestInput({ courseId: "skill-01", answers: { q1: 2, q2: "x", "../q": 1, q3: 15 } });
  assert.deepEqual(p.answers, { q1: 2 });
  assert.throws(() => parsePostTestInput({ courseId: "skill-01", answers: [1] }), InputError);
});
