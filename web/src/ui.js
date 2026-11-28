// أدوات واجهة صغيرة مشتركة.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

export const ar = (n) => Number(n).toLocaleString("ar");

export function go(path) {
  if (location.hash !== `#${path}`) location.hash = path;
}

let toastTimer;
export function toast(message, kind = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = "toast"), 4000);
}

/** رسالة خطأ مفهومة من أخطاء Firebase. */
export function errorMessage(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة.",
    "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
    "auth/email-already-in-use": "هذا البريد مسجّل مسبقاً، سجّل الدخول بدلاً من ذلك.",
    "auth/weak-password": "كلمة المرور ضعيفة: 6 أحرف على الأقل.",
    "auth/too-many-requests": "محاولات كثيرة، انتظر قليلاً ثم حاول.",
    "auth/popup-closed-by-user": "أُغلقت نافذة تسجيل الدخول.",
    "auth/network-request-failed": "تعذّر الاتصال بالشبكة.",
    "functions/deadline-exceeded": "استغرق الطلب وقتاً أطول من المتوقع، حاول مرة أخرى.",
    "permission-denied": "ليست لديك صلاحية لهذه العملية.",
    "app/not-invited": "هذا الحساب غير مسجّل في المنصة. التسجيل يتم عن طريق المشرف؛ تواصل معه ليضيفك.",
    "auth/requires-recent-login": "لأمان حسابك، سجّل الدخول من جديد ثم غيّر كلمة المرور.",
    "auth/operation-not-allowed": "طريقة الدخول هذه غير مفعّلة في إعدادات Firebase.",
  };
  if (map[code]) return map[code];
  // أخطاء الدوال السحابية تحمل رسائل عربية جاهزة من الخادم.
  if (code.startsWith("functions/") && err.message && code !== "functions/internal") return err.message;
  if (code === "functions/internal") return err.message && err.message !== "internal" ? err.message : "حدث خطأ في الخادم.";
  return err?.message || "حدث خطأ غير متوقع.";
}

export function spinner(label = "جارٍ التحميل…") {
  return `<div class="loading" role="status"><span class="spin" aria-hidden="true"></span>${esc(label)}</div>`;
}

export function progressBar(pct, label) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="bar" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100" ${
    label ? `aria-label="${esc(label)}"` : ""
  }><span style="width:${v}%"></span></div>`;
}

/** محوّل Markdown مبسّط وآمن (يهرّب HTML أولاً) لردود المدرّب. */
export function markdown(src) {
  const blocks = [];
  let text = String(src ?? "").replace(/```[^\n]*\n([\s\S]*?)(```|$)/g, (_, code) => {
    blocks.push(`<pre dir="ltr"><code>${esc(code.replace(/\n$/, ""))}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  text = esc(text);
  const inline = (s) =>
    s
      .replace(/`([^`]+)`/g, '<code dir="ltr">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  const out = [];
  let list = null;
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const line of text.split("\n")) {
    const block = line.match(/^\u0000(\d+)\u0000$/);
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (block) {
      closeList();
      out.push(blocks[Number(block[1])]);
    } else if (heading) {
      closeList();
      out.push(`<h4>${inline(heading[2])}</h4>`);
    } else if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
    } else if (!line.trim()) {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("").replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[Number(i)]);
}
