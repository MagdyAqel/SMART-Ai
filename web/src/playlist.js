// قائمة تشغيل فيديوهات المهارة: مشغّل واحد كبير، وبطاقات للفيديوهات تحته،
// وزرّا «السابق/التالي»، واقتراح تلقائي للفيديو التالي عند انتهاء الفيديو الحالي.
import { ar, esc } from "./ui.js";

const KIND = { video: "فيديو تعريفي", tutorial: "شرح تطبيقي" };
const WATCHED = "watched-videos";

/** يجمع فيديوهات المهارة بالترتيب: التعريفي، ثم التطبيقي، ثم الإضافية. */
export function skillVideos(skill) {
  return [
    skill.video && { ...skill.video, kind: "video" },
    skill.tutorial && { ...skill.tutorial, kind: "tutorial" },
    ...(skill.videos || []).map((v) => ({ ...v, kind: "extra" })),
  ].filter((v) => v?.url);
}

const watchedSet = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(WATCHED) || "[]"));
  } catch {
    return new Set();
  }
};
const saveWatched = (url) => {
  try {
    const s = watchedSet();
    s.add(url);
    localStorage.setItem(WATCHED, JSON.stringify([...s]));
  } catch {
    /* التخزين غير متاح: نكتفي بالعرض في هذه الجلسة */
  }
};
const shortTitle = (t = "") => t.replace(/^(فيديو تعريفي|شرح تطبيقي خطوة بخطوة|شرح تطبيقي)\s*:\s*/, "");
const label = (v, i) => (v.kind === "extra" ? `فيديو ${ar(i + 1)}` : KIND[v.kind]);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function playlistHtml(videos) {
  if (!videos.length) return `<p class="muted">سيُضاف الفيديو قريباً.</p>`;
  const seen = watchedSet();
  const v0 = videos[0];
  const many = videos.length > 1;
  return `<div class="playlist" data-count="${videos.length}">
    <div class="pl-stage">
      <video controls preload="metadata" playsinline controlsList="nodownload" ${v0.poster ? `poster="${esc(v0.poster)}"` : ""}>
        <source src="${esc(v0.url)}" type="video/mp4" />
        ${v0.captions ? `<track kind="captions" srclang="ar" label="العربية" src="${esc(v0.captions)}" />` : ""}
      </video>
      <div class="pl-next" hidden>
        <span class="pl-next-label">التالي</span>
        <strong class="pl-next-title"></strong>
        <div class="row"><button class="btn primary small" data-pl="go">▶ شغّل الآن <span class="pl-count"></span></button>
        <button class="btn small" data-pl="stay">ابقَ هنا</button></div>
      </div>
    </div>
    <div class="pl-bar">
      <div class="pl-now"><span class="pl-kind">${esc(label(v0, 0))}</span><h3 class="pl-title">${esc(shortTitle(v0.title))}</h3></div>
      ${
        many
          ? `<div class="pl-nav"><button class="btn small" data-pl="prev" aria-label="الفيديو السابق">→ السابق</button>
             <span class="pl-pos">${ar(1)} / ${ar(videos.length)}</span>
             <button class="btn small primary" data-pl="next" aria-label="الفيديو التالي">التالي ←</button></div>`
          : ""
      }
    </div>
    <p class="muted small pl-hint">يمكنك تفعيل الترجمة العربية من زر CC</p>
    ${
      many
        ? `<ol class="pl-list" aria-label="فيديوهات المهارة">${videos
            .map(
              (v, i) => `<li><button class="pl-item ${i === 0 ? "active" : ""} ${seen.has(v.url) ? "seen" : ""}" data-i="${i}" aria-current="${i === 0}">
                <span class="pl-thumb" ${v.poster ? `style="background-image:url('${esc(v.poster)}')"` : ""}><span class="pl-play" aria-hidden="true">▶</span><span class="pl-dur" data-dur="${i}"></span></span>
                <span class="pl-meta"><span class="pl-kind">${esc(label(v, i))}</span><span class="pl-name">${esc(shortTitle(v.title))}</span>
                <span class="pl-seen">✓ تمت المشاهدة</span></span>
              </button></li>`,
            )
            .join("")}</ol>`
        : ""
    }
  </div>`;
}

/** يفعّل القائمة. onWatched يُستدعى حين يشاهد المتدرب 80% من أي فيديو. */
export function mountPlaylist(root, videos, { onWatched } = {}) {
  const box = root.querySelector(".playlist");
  if (!box) return;
  const video = box.querySelector("video");
  const nextBox = box.querySelector(".pl-next");
  let cur = 0;
  let timer = null;

  const cancelAuto = () => {
    clearInterval(timer);
    timer = null;
    nextBox.hidden = true;
  };

  const load = (i, play = true) => {
    cancelAuto();
    cur = (i + videos.length) % videos.length;
    const v = videos[cur];
    video.pause();
    video.innerHTML = `<source src="${esc(v.url)}" type="video/mp4" />${
      v.captions ? `<track kind="captions" srclang="ar" label="العربية" src="${esc(v.captions)}" />` : ""
    }`;
    if (v.poster) video.poster = v.poster;
    else video.removeAttribute("poster");
    video.load();
    if (play) video.play().catch(() => {});
    box.querySelector(".pl-bar .pl-kind").textContent = label(v, cur);
    box.querySelector(".pl-title").textContent = shortTitle(v.title);
    const pos = box.querySelector(".pl-pos");
    if (pos) pos.textContent = `${ar(cur + 1)} / ${ar(videos.length)}`;
    box.querySelectorAll(".pl-item").forEach((b) => {
      const on = Number(b.dataset.i) === cur;
      b.classList.toggle("active", on);
      b.setAttribute("aria-current", String(on));
    });
  };

  box.addEventListener("click", (e) => {
    const item = e.target.closest(".pl-item");
    if (item) return load(Number(item.dataset.i));
    const act = e.target.closest("[data-pl]")?.dataset.pl;
    if (act === "next" || act === "go") load(cur + 1);
    if (act === "prev") load(cur - 1);
    if (act === "stay") cancelAuto();
  });

  let marked = false;
  video.addEventListener("timeupdate", () => {
    if (!video.duration || video.currentTime / video.duration < 0.8) return;
    const v = videos[cur];
    saveWatched(v.url);
    box.querySelector(`.pl-item[data-i="${cur}"]`)?.classList.add("seen");
    if (!marked) {
      marked = true;
      onWatched?.();
    }
  });

  // عند الانتهاء: اقتراح الفيديو التالي مع عدّ تنازلي يمكن إلغاؤه
  video.addEventListener("ended", () => {
    if (videos.length < 2 || cur === videos.length - 1) return;
    let left = 5;
    nextBox.querySelector(".pl-next-title").textContent = shortTitle(videos[cur + 1].title);
    const count = nextBox.querySelector(".pl-count");
    count.textContent = `(${ar(left)})`;
    nextBox.hidden = false;
    timer = setInterval(() => {
      left -= 1;
      count.textContent = `(${ar(left)})`;
      if (left <= 0) load(cur + 1);
    }, 1000);
  });
  video.addEventListener("play", cancelAuto);
  video.addEventListener(
    "error",
    () => box.querySelector(".pl-hint").insertAdjacentHTML("beforeend", ' · <span class="bad">تعذّر تحميل الفيديو.</span>'),
    true,
  );

  // مدة كل فيديو في بطاقته (تُقرأ من بيانات الملف فقط، دون تحميل الفيديو)
  box.querySelectorAll("[data-dur]").forEach((span) => {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = videos[Number(span.dataset.dur)].url;
    probe.addEventListener("loadedmetadata", () => {
      span.textContent = mmss(probe.duration);
      probe.removeAttribute("src");
      probe.load();
    });
  });
}
