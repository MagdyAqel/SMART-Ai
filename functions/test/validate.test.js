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
