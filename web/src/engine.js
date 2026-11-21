// محرّك التعلّم التكيّفي: دوال نقية بلا اعتماد على Firebase أو المتصفح.
//
// - تقدير مستوى المتدرب في كل مهارة بنظام تقييم شبيه بـ Elo.
// - اختيار السؤال التالي بحيث تكون فرصة النجاح المتوقعة قرابة 70%.
// - مراجعة متباعدة (صناديق لايتنر) للأسئلة التي أخطأ فيها المتدرب.
// - نقاط خبرة ومستويات وسلسلة أيام نشاط.

export const BASE_RATING = 1000;
export const QUESTION_RATING = { 1: 900, 2: 1100, 3: 1300 };
export const TARGET_SUCCESS = 0.7;
export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 16, 35]; // حسب رقم الصندوق 1..5
export const MAX_BOX = 5;
export const LESSON_PASS_RATIO = 0.6;
export const LESSON_BONUS_XP = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export function emptyProgress(name = "") {
  return {
    name,
    xp: 0,
    streak: 0,
    lastActiveDay: null,
    skills: {},
    completed: {},
    review: {},
  };
}

export const lessonKey = (courseId, lessonId) => `${courseId}__${lessonId}`;

export function expectedScore(rating, difficulty) {
  const qr = QUESTION_RATING[difficulty] ?? QUESTION_RATING[2];
  return 1 / (1 + 10 ** ((qr - rating) / 400));
}

export function updateRating(rating, difficulty, correct, attempts = 0) {
  const k = attempts < 6 ? 48 : 24; // نتعلّم بسرعة في البداية ثم نستقر
  const next = rating + k * ((correct ? 1 : 0) - expectedScore(rating, difficulty));
  return Math.round(Math.min(1700, Math.max(600, next)));
}

/** نسبة الإتقان 0..100 مشتقة من التقييم. */
export function mastery(skill) {
  if (!skill || !skill.attempts) return 0;
  const pct = ((skill.rating - 800) / 600) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

export function skillRating(progress, skillId) {
  return progress.skills[skillId]?.rating ?? BASE_RATING;
}

/** يختار من الأسئلة غير المطروحة أقربها إلى فرصة نجاح 70%. */
export function pickNextQuestion(questions, rating, askedIds = new Set()) {
  let best = null;
  let bestGap = Infinity;
  for (const q of questions) {
    if (askedIds.has(q.id)) continue;
    const gap = Math.abs(expectedScore(rating, q.difficulty) - TARGET_SUCCESS);
    if (gap < bestGap - 1e-9 || (Math.abs(gap - bestGap) < 1e-9 && q.difficulty < best.difficulty)) {
      best = q;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * جدولة المراجعة: الخطأ يعيد السؤال للصندوق 1 (مراجعة اليوم)،
 * والصواب ينقله لصندوق أعلى بفاصل أطول، وبعد الصندوق الأخير يتخرّج السؤال (null).
 */
export function scheduleReview(entry, correct, now) {
  if (!correct) return { box: 1, due: now };
  if (!entry) return null; // سؤال جديد أُجيب صحيحاً: لا حاجة لمراجعته
  const box = entry.box + 1;
  if (box > MAX_BOX) return null;
  return { box, due: now + REVIEW_INTERVALS_DAYS[box] * DAY_MS };
}

export function dueReviews(review, now) {
  return Object.entries(review ?? {})
    .filter(([, e]) => e.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([key, e]) => ({ key, ...e }));
}

export const xpForAnswer = (difficulty, correct) => (correct ? 5 + 5 * difficulty : 1);

/** المستوى n يبدأ عند 50 × (n-1)² نقطة. */
export function levelProgress(xp) {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const start = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, start, next, pct: Math.round(((xp - start) / (next - start)) * 100) };
}

export function dayKey(date) {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function nextStreak(streak, lastActiveDay, now) {
  const today = dayKey(now);
  if (lastActiveDay === today) return { streak: Math.max(1, streak), lastActiveDay: today };
  const yesterday = dayKey(now - DAY_MS);
  return { streak: lastActiveDay === yesterday ? streak + 1 : 1, lastActiveDay: today };
}

/**
 * يطبّق إجابة واحدة على التقدّم ويعيد نسخة جديدة.
 * reviewKey معرّف ثابت للسؤال، وsnapshot نسخة منه تُحفظ لاستخدامها في المراجعة.
 */
export function applyAnswer(progress, { skill, question, correct, now, reviewKey, snapshot }) {
  const prev = progress.skills[skill] ?? { rating: BASE_RATING, attempts: 0, correct: 0 };
  const rating = updateRating(prev.rating, question.difficulty, correct, prev.attempts);
  const xpGained = xpForAnswer(question.difficulty, correct);

  const review = { ...progress.review };
  const scheduled = scheduleReview(review[reviewKey], correct, now);
  if (scheduled) review[reviewKey] = { ...review[reviewKey], ...scheduled, skill, q: snapshot ?? question };
  else delete review[reviewKey];

  return {
    progress: {
      ...progress,
      ...nextStreak(progress.streak, progress.lastActiveDay, now),
      xp: progress.xp + xpGained,
      skills: {
        ...progress.skills,
        [skill]: { rating, attempts: prev.attempts + 1, correct: prev.correct + (correct ? 1 : 0) },
      },
      review,
    },
    xpGained,
    masteryBefore: mastery(prev.attempts ? prev : null),
    masteryAfter: mastery({ rating, attempts: prev.attempts + 1 }),
  };
}

/** يسجّل إتمام درس إذا تجاوزت النتيجة حد النجاح، مع مكافأة أول إتمام. */
export function completeLesson(progress, { courseId, lessonId, score, total, now }) {
  const key = lessonKey(courseId, lessonId);
  const passed = total > 0 && score / total >= LESSON_PASS_RATIO;
  if (!passed) return { progress, passed, bonus: 0 };
  const first = !progress.completed[key];
  const best = Math.max(progress.completed[key]?.best ?? 0, Math.round((score / total) * 100));
  return {
    passed,
    bonus: first ? LESSON_BONUS_XP : 0,
    progress: {
      ...progress,
      xp: progress.xp + (first ? LESSON_BONUS_XP : 0),
      completed: { ...progress.completed, [key]: { at: now, best } },
    },
  };
}

export function courseCompletion(course, progress) {
  const total = course.lessons.length;
  const done = course.lessons.filter((l) => progress.completed[lessonKey(course.id, l.id)]).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/**
 * يوصي بالخطوة التالية:
 * 1) درس متعثّر (مهارة جُرّبت وإتقانها أقل من 50%) لإعادته،
 * 2) وإلا الدرس التالي في دورة بدأها المتدرب،
 * 3) وإلا أول درس في أول دورة لم تكتمل.
 */
export function recommendNext(courses, progress) {
  let weakest = null;
  for (const course of courses) {
    for (const lesson of course.lessons) {
      const skill = progress.skills[lesson.skill];
      if (!skill?.attempts) continue;
      const m = mastery(skill);
      if (m < 50 && (!weakest || m < weakest.m)) weakest = { course, lesson, m };
    }
  }
  if (weakest) {
    return { course: weakest.course, lesson: weakest.lesson, reason: "weak", mastery: weakest.m };
  }

  for (const course of courses) {
    const { done, total } = courseCompletion(course, progress);
    if (done > 0 && done < total) {
      const lesson = course.lessons.find((l) => !progress.completed[lessonKey(course.id, l.id)]);
      return { course, lesson, reason: "continue" };
    }
  }
  for (const course of courses) {
    const lesson = course.lessons.find((l) => !progress.completed[lessonKey(course.id, l.id)]);
    if (lesson) return { course, lesson, reason: "start" };
  }
  return null;
}
