// تغيير كلمة المرور إلزامياً في أول دخول (للحسابات التي أنشأها المشرف بكلمة مرور مؤقتة).
import { updatePassword, signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { state } from "../store.js";
import { errorMessage, esc, toast } from "../ui.js";

export function render(root, done) {
  root.innerHTML = `
  <main class="center">
    <form class="card narrow form" id="pw-form" novalidate>
      <h1>🔐 اختر كلمة مرور جديدة</h1>
      <p class="muted">مرحباً ${esc(state.progress?.name || "")}. أنشأ المشرف حسابك بكلمة مرور مؤقتة؛ اختر كلمة مرور خاصة بك لتتابع.</p>
      <label class="field">كلمة المرور الجديدة
        <input name="pw" type="password" autocomplete="new-password" dir="ltr" minlength="8" required />
      </label>
      <label class="field">أعد كتابتها
        <input name="pw2" type="password" autocomplete="new-password" dir="ltr" minlength="8" required />
      </label>
      <p class="muted small">ثمانية أحرف على الأقل، ويُفضّل أن تجمع بين حروف وأرقام.</p>
      <p class="form-error" role="alert"></p>
      <button class="btn primary block" type="submit">حفظ والمتابعة</button>
      <button class="link" type="button" id="out">خروج</button>
    </form>
  </main>`;
  const form = root.querySelector("#pw-form");
  const errorEl = form.querySelector(".form-error");
  root.querySelector("#out").addEventListener("click", () => signOut(auth));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const pw = form.pw.value;
    if (pw.length < 8) return (errorEl.textContent = "كلمة المرور قصيرة: ثمانية أحرف على الأقل.");
    if (pw !== form.pw2.value) return (errorEl.textContent = "كلمتا المرور غير متطابقتين.");
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      await updatePassword(auth.currentUser, pw);
      await updateDoc(doc(db, "users", state.user.uid), { mustChangePassword: false });
      state.progress.mustChangePassword = false;
      toast("حُفظت كلمة المرور الجديدة.", "success");
      done();
    } catch (err) {
      errorEl.textContent = errorMessage(err);
      btn.disabled = false;
    }
  });
}
