import { callTutor } from "../firebase.js";
import { findLesson, state } from "../store.js";
import { errorMessage, esc, markdown } from "../ui.js";

// نحتفظ بالمحادثة لكل سياق (درس أو عام) طوال الجلسة.
const threads = new Map();

const SUGGESTIONS_GENERAL = [
  "كيف أنظّم وقتي للتعلّم يومياً؟",
  "اشرح لي الفرق بين الحفظ والفهم مع مثال",
  "اقترح عليّ خطة لتعلّم مهارة جديدة في شهر",
];
const SUGGESTIONS_LESSON = ["لخّص لي هذا الدرس في نقاط", "أعطني مثالاً عملياً إضافياً", "اختبرني بسؤال واحد عن الدرس"];

export async function render(el, _params, query) {
  const courseId = query.get("course");
  const lessonId = query.get("lesson");
  const ctx = courseId && lessonId ? await findLesson(courseId, lessonId) : {};
  const key = ctx.lesson ? `${courseId}/${lessonId}` : "general";
  if (!threads.has(key)) threads.set(key, []);
  const messages = threads.get(key);
  let busy = false;
  let controller = null;

  const quizActive = state.quiz && !state.quiz.finished;
  el.innerHTML = `
    <div class="tutor">
      <header class="tutor-head">
        <div>
          <h1 class="page-title">🤖 المدرّب الذكي</h1>
          <p class="muted">${
            ctx.lesson
              ? `يساعدك في درس: <b>${esc(ctx.lesson.title)}</b> · <a href="#/tutor">محادثة عامة</a>`
              : "اسأل عن أي موضوع تتعلّمه. لتحصل على إجابات مرتبطة بدرس، افتحه واضغط «اسأل المدرّب»."
          }</p>
        </div>
        <div class="row">
          ${quizActive ? `<a class="btn small" href="#/quiz">↩ عودة للاختبار</a>` : ""}
          ${ctx.lesson ? `<a class="btn small ghost" href="#/lesson/${esc(courseId)}/${esc(lessonId)}">الدرس</a>` : ""}
          <button class="btn small ghost" id="clear">محادثة جديدة</button>
        </div>
      </header>
      <div class="chat" id="chat" aria-live="polite"></div>
      <form class="composer" id="composer">
        <label for="msg" class="sr-only">رسالتك</label>
        <textarea id="msg" rows="2" maxlength="4000" placeholder="اكتب سؤالك… (Enter للإرسال، Shift+Enter لسطر جديد)"></textarea>
        <button class="btn primary" type="submit" id="send">إرسال</button>
      </form>
    </div>`;

  const chat = el.querySelector("#chat");
  const input = el.querySelector("#msg");
  const send = el.querySelector("#send");

  function draw() {
    if (!messages.length) {
      const sugg = ctx.lesson ? SUGGESTIONS_LESSON : SUGGESTIONS_GENERAL;
      chat.innerHTML = `<div class="empty"><p>مرحباً! كيف أساعدك اليوم؟</p><div class="chips">${sugg
        .map((s) => `<button class="chip" type="button">${esc(s)}</button>`)
        .join("")}</div></div>`;
      return;
    }
    chat.innerHTML = messages
      .map(
        (m) => `<div class="msg ${m.role}${m.error ? " error" : ""}">${
          m.role === "user" ? `<p>${esc(m.content).replace(/\n/g, "<br>")}</p>` : markdown(m.content) || '<span class="typing"><i></i><i></i><i></i></span>'
        }</div>`,
      )
      .join("");
    chat.scrollTop = chat.scrollHeight;
  }

  async function ask(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    messages.push({ role: "user", content: text });
    const reply = { role: "assistant", content: "" };
    messages.push(reply);
    draw();

    const history = messages
      .filter((m) => m !== reply && !m.error && m.content)
      .map(({ role, content }) => ({ role, content }));
    controller = new AbortController();
    let frame = 0;
    try {
      const { stream, data } = await callTutor.stream(
        { messages: history, courseId: ctx.lesson ? courseId : null, lessonId: ctx.lesson ? lessonId : null },
        { signal: controller.signal },
      );
      for await (const chunk of stream) {
        reply.content += chunk;
        if (!frame) frame = requestAnimationFrame(() => ((frame = 0), draw()));
      }
      const result = await data;
      if (!reply.content && result?.text) reply.content = result.text;
    } catch (err) {
      if (controller.signal.aborted) return;
      // نحذف السؤال الفاشل من السياق حتى لا يُرسل مجدداً بلا رد.
      messages.splice(messages.indexOf(reply) - 1, 2);
      messages.push({ role: "assistant", content: `⚠️ ${errorMessage(err)}`, error: true });
    } finally {
      busy = false;
      send.disabled = false;
      controller = null;
      if (chat.isConnected) draw();
    }
  }

  el.querySelector("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = "";
    ask(text);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      el.querySelector("#composer").requestSubmit();
    }
  });
  chat.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) ask(chip.textContent);
  });
  el.querySelector("#clear").addEventListener("click", () => {
    if (busy) return;
    messages.length = 0;
    draw();
  });

  draw();
  if (state.tutorPrefill) {
    const text = state.tutorPrefill;
    state.tutorPrefill = null;
    ask(text);
  } else {
    input.focus();
  }

  return () => controller?.abort();
}
