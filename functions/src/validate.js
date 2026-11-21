// تحقق من مدخلات الدوال السحابية وتنظيف مخرجات النموذج.
// دوال نقية بلا اعتماد على Firebase، لتسهيل اختبارها.

export class InputError extends Error {}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 4000;

function str(value, { name, min = 0, max }) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string") throw new InputError(`${name} يجب أن يكون نصاً`);
  const v = value.trim();
  if (v.length < min) throw new InputError(`${name} قصير جداً`);
  if (max && v.length > max) throw new InputError(`${name} أطول من ${max} حرفاً`);
  return v;
}

function optionalId(value, name) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !ID_RE.test(value)) throw new InputError(`${name} غير صالح`);
  return value;
}

function int(value, { name, min, max, fallback }) {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new InputError(`${name} يجب أن يكون عدداً بين ${min} و${max}`);
  }
  return n;
}

export function parseTutorInput(data = {}) {
  const raw = data.messages;
  if (!Array.isArray(raw) || raw.length === 0) throw new InputError("المحادثة فارغة");
  let messages = raw.map((m, i) => {
    if (!m || (m.role !== "user" && m.role !== "assistant")) {
      throw new InputError(`الرسالة ${i + 1}: دور غير صالح`);
    }
    return { role: m.role, content: str(m.content, { name: "نص الرسالة", min: 1, max: MAX_MESSAGE_CHARS }) };
  });
  if (messages[messages.length - 1].role !== "user") {
    throw new InputError("يجب أن تنتهي المحادثة برسالة من المتدرب");
  }
  // نحتفظ بآخر الرسائل فقط، ونضمن أن تبدأ برسالة من المستخدم.
  messages = messages.slice(-MAX_HISTORY);
  while (messages.length && messages[0].role !== "user") messages.shift();
  return {
    messages,
    courseId: optionalId(data.courseId, "معرّف الدورة"),
    lessonId: optionalId(data.lessonId, "معرّف الدرس"),
  };
}

export function parseQuizInput(data = {}) {
  const topic = str(data.topic, { name: "الموضوع", max: 200 });
  const sourceText = str(data.sourceText, { name: "النص المرجعي", max: 12000 });
  if (topic.length < 2 && sourceText.length < 50) {
    throw new InputError("اكتب موضوعاً، أو الصق نصاً مرجعياً لا يقل عن 50 حرفاً");
  }
  const difficulty = data.difficulty === "mixed" || data.difficulty == null
    ? "mixed"
    : int(data.difficulty, { name: "الصعوبة", min: 1, max: 3 });
  const count = int(data.count, { name: "عدد الأسئلة", min: 3, max: 10, fallback: 5 });
  return { topic, sourceText, difficulty, count };
}

export function parseCourseInput(data = {}) {
  return {
    topic: str(data.topic, { name: "موضوع الدورة", min: 3, max: 200 }),
    audience: str(data.audience, { name: "الفئة المستهدفة", max: 200 }),
    lessonCount: int(data.lessonCount, { name: "عدد الدروس", min: 2, max: 6, fallback: 3 }),
  };
}

const clampDifficulty = (d) => Math.min(3, Math.max(1, Math.round(Number(d) || 2)));

/** يحذف الأسئلة المعيبة من مخرجات النموذج ويعطي كل سؤال معرّفاً ثابتاً. */
export function normalizeQuestions(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (!item || typeof item.q !== "string" || !item.q.trim()) continue;
    if (!Array.isArray(item.options)) continue;
    const options = item.options.map((o) => String(o ?? "").trim());
    if (options.length < 2 || options.length > 6 || options.some((o) => !o)) continue;
    if (new Set(options).size !== options.length) continue;
    const answer = Number(item.answer);
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
    out.push({
      id: `q${out.length + 1}`,
      q: item.q.trim(),
      options,
      answer,
      explanation: String(item.explanation ?? "").trim(),
      difficulty: clampDifficulty(item.difficulty),
    });
  }
  return out;
}

export function slugify(text, fallback = "item") {
  const s = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || fallback;
}

/** يحوّل الدورة المولّدة إلى شكل وثيقة Firestore نفسه المستخدم في الدورات الجاهزة. */
export function normalizeCourse(course, { courseId }) {
  if (!course || !Array.isArray(course.lessons)) throw new InputError("مخرجات الدورة غير صالحة");
  const lessons = course.lessons
    .map((lesson, i) => {
      const questions = normalizeQuestions(lesson.questions);
      const content = (Array.isArray(lesson.content) ? lesson.content : [])
        .map((p) => String(p ?? "").trim())
        .filter(Boolean);
      if (!lesson.title || content.length === 0 || questions.length === 0) return null;
      const lessonId = `l${i + 1}`;
      return {
        id: lessonId,
        title: String(lesson.title).trim(),
        skill: `${courseId}-${lessonId}`,
        minutes: Math.min(60, Math.max(3, Math.round(Number(lesson.minutes) || 8))),
        content,
        media: [],
        questions,
        tasks: (Array.isArray(lesson.tasks) ? lesson.tasks : []).map(normalizeTask).filter(Boolean),
      };
    })
    .filter(Boolean);
  if (lessons.length === 0) throw new InputError("لم يُنتج النموذج دروساً صالحة");
  return {
    id: courseId,
    title: String(course.title ?? "").trim() || "دورة جديدة",
    description: String(course.description ?? "").trim(),
    icon: String(course.icon ?? "📘").trim().slice(0, 4) || "📘",
    level: String(course.level ?? "").trim() || "جميع المستويات",
    lessons,
  };
}

// ---------- المهام التطبيقية والتصحيح الذاتي ----------

export const TASK_TYPES = ["prompt", "written"];
const MAX_ANSWER_CHARS = 8000;

/** يوحّد شكل معايير التقييم: معرّفات ثابتة ودرجات صحيحة موجبة. */
export function normalizeRubric(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((c) => ({
      criterion: String(c?.criterion ?? "").trim(),
      description: String(c?.description ?? "").trim(),
      points: Math.min(100, Math.max(1, Math.round(Number(c?.points) || 0))),
    }))
    .filter((c) => c.criterion)
    .slice(0, 10)
    .map((c, i) => ({ id: `c${i + 1}`, ...c }));
}

export function normalizeTask(task, index = 0) {
  if (!task || !String(task.title ?? "").trim() || !String(task.instructions ?? "").trim()) return null;
  const rubric = normalizeRubric(task.rubric);
  if (rubric.length === 0) return null;
  const type = TASK_TYPES.includes(task.type) ? task.type : "written";
  return {
    id: task.id && /^[a-z0-9-]{1,40}$/.test(task.id) ? task.id : `t${index + 1}`,
    type,
    title: String(task.title).trim(),
    instructions: String(task.instructions).trim(),
    material: String(task.material ?? "").trim(),
    runPrompt: type === "prompt" && task.runPrompt !== false,
    passScore: Math.min(100, Math.max(1, Math.round(Number(task.passScore) || 70))),
    rubric,
  };
}

export function parseSubmissionInput(data = {}) {
  const id = (v, name) => {
    if (typeof v !== "string" || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(v)) throw new InputError(`${name} غير صالح`);
    return v;
  };
  return {
    courseId: id(data.courseId, "معرّف الدورة"),
    lessonId: id(data.lessonId, "معرّف الدرس"),
    taskId: id(data.taskId, "معرّف المهمة"),
    answer: str(data.answer, { name: "إجابتك", min: 20, max: MAX_ANSWER_CHARS }),
  };
}

/**
 * يجمع درجات المعايير من مخرجات المصحّح. المجموع يُحسب هنا لا من النموذج،
 * وكل درجة تُحصر بين 0 والحد الأقصى للمعيار.
 */
export function computeGrade(rubric, graded, passScore) {
  const byId = new Map((graded?.criteria ?? []).map((c) => [c.id, c]));
  const criteria = rubric.map((r) => {
    const g = byId.get(r.id) ?? {};
    const score = Math.min(r.points, Math.max(0, Math.round(Number(g.score) || 0)));
    return {
      id: r.id,
      criterion: r.criterion,
      points: r.points,
      score,
      evidence: String(g.evidence ?? "").trim(),
      feedback: String(g.feedback ?? "").trim(),
    };
  });
  const total = criteria.reduce((s, c) => s + c.score, 0);
  const max = criteria.reduce((s, c) => s + c.points, 0);
  const pct = max ? Math.round((total / max) * 100) : 0;
  const list = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 5) : []);
  return {
    criteria,
    total,
    max,
    pct,
    passed: pct >= passScore,
    strengths: list(graded?.strengths),
    improvements: list(graded?.improvements),
    overall: String(graded?.overall_feedback ?? "").trim(),
    improved: String(graded?.improved_version ?? "").trim(),
  };
}
