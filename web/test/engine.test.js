import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAnswer,
  completeLesson,
  dueReviews,
  emptyProgress,
  expectedScore,
  levelProgress,
  mastery,
  nextStreak,
  pickNextQuestion,
  recommendNext,
  scheduleReview,
  updateRating,
} from "../src/engine.js";

const DAY = 86400000;
const NOW = new Date(2026, 10, 21, 12).getTime();
const q = (id, difficulty) => ({ id, difficulty, q: id, options: ["a", "b"], answer: 0 });

test("expected score falls as difficulty rises", () => {
  assert.ok(expectedScore(1000, 1) > expectedScore(1000, 2));
  assert.ok(expectedScore(1000, 2) > expectedScore(1000, 3));
});

test("rating rises on correct answers and falls on wrong ones", () => {
  assert.ok(updateRating(1000, 2, true) > 1000);
  assert.ok(updateRating(1000, 2, false) < 1000);
  // نجاح في سؤال صعب يرفع أكثر من نجاح في سؤال سهل
  assert.ok(updateRating(1000, 3, true) > updateRating(1000, 1, true));
});

test("adaptive picker serves easy questions to beginners and hard ones to strong learners", () => {
  const pool = [q("easy", 1), q("mid", 2), q("hard", 3)];
  assert.equal(pickNextQuestion(pool, 900).id, "easy");
  assert.equal(pickNextQuestion(pool, 1450).id, "hard");
  assert.equal(pickNextQuestion(pool, 1450, new Set(["hard"])).id, "mid");
  assert.equal(pickNextQuestion(pool, 1000, new Set(["easy", "mid", "hard"])), null);
});

test("Leitner review schedule", () => {
  assert.deepEqual(scheduleReview(undefined, false, NOW), { box: 1, due: NOW });
  assert.equal(scheduleReview(undefined, true, NOW), null);
  assert.deepEqual(scheduleReview({ box: 1, due: NOW }, true, NOW), { box: 2, due: NOW + 3 * DAY });
  assert.equal(scheduleReview({ box: 5, due: NOW }, true, NOW), null);
  const due = dueReviews({ a: { box: 1, due: NOW - 1 }, b: { box: 2, due: NOW + DAY } }, NOW);
  assert.deepEqual(due.map((d) => d.key), ["a"]);
});

test("streak continues on consecutive days and resets after a gap", () => {
  assert.equal(nextStreak(0, null, NOW).streak, 1);
  const today = nextStreak(3, null, NOW).lastActiveDay;
  assert.equal(nextStreak(3, today, NOW).streak, 3);
  const yesterday = nextStreak(0, null, NOW - DAY).lastActiveDay;
  assert.equal(nextStreak(3, yesterday, NOW).streak, 4);
  const old = nextStreak(0, null, NOW - 3 * DAY).lastActiveDay;
  assert.equal(nextStreak(9, old, NOW).streak, 1);
});

test("levels", () => {
  assert.deepEqual(levelProgress(0), { level: 1, start: 0, next: 50, pct: 0 });
  assert.equal(levelProgress(50).level, 2);
  assert.equal(levelProgress(199).level, 2);
  assert.equal(levelProgress(200).level, 3);
});

test("applyAnswer updates xp, skill, and review queue", () => {
  let p = emptyProgress("سارة");
  const question = q("q1", 2);
  let r = applyAnswer(p, { skill: "s", question, correct: false, now: NOW, reviewKey: "c__l__q1" });
  assert.equal(r.progress.xp, 1);
  assert.equal(r.progress.skills.s.attempts, 1);
  assert.equal(r.progress.review["c__l__q1"].box, 1);
  assert.equal(r.progress.streak, 1);
  assert.equal(p.xp, 0, "input must not be mutated");

  r = applyAnswer(r.progress, { skill: "s", question, correct: true, now: NOW, reviewKey: "c__l__q1" });
  assert.equal(r.progress.xp, 1 + 15);
  assert.equal(r.progress.review["c__l__q1"].box, 2);
  assert.equal(r.progress.skills.s.correct, 1);
});

test("completeLesson awards the bonus once and only on a pass", () => {
  const p = emptyProgress();
  assert.equal(completeLesson(p, { courseId: "c", lessonId: "l", score: 1, total: 4, now: NOW }).passed, false);
  const first = completeLesson(p, { courseId: "c", lessonId: "l", score: 3, total: 4, now: NOW });
  assert.equal(first.bonus, 20);
  assert.equal(first.progress.completed["c__l"].best, 75);
  const again = completeLesson(first.progress, { courseId: "c", lessonId: "l", score: 4, total: 4, now: NOW });
  assert.equal(again.bonus, 0);
  assert.equal(again.progress.completed["c__l"].best, 100);
});

test("recommendNext prefers weak skills, then continuing a course", () => {
  const courses = [
    { id: "a", lessons: [{ id: "1", skill: "a1" }, { id: "2", skill: "a2" }] },
    { id: "b", lessons: [{ id: "1", skill: "b1" }] },
  ];
  const p = emptyProgress();
  assert.equal(recommendNext(courses, p).reason, "start");

  p.completed["b__1"] = { at: NOW, best: 100 };
  p.completed["a__1"] = { at: NOW, best: 100 };
  const cont = recommendNext(courses, p);
  assert.equal(cont.reason, "continue");
  assert.equal(cont.lesson.id, "2");

  p.skills.b1 = { rating: 820, attempts: 4, correct: 1 };
  const weak = recommendNext(courses, p);
  assert.equal(weak.reason, "weak");
  assert.equal(weak.course.id, "b");
  assert.ok(mastery(p.skills.b1) < 50);
});
