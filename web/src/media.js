// عرض فيديوهات الدروس وصورها. نسمح بالتضمين (iframe) من مزوّدي فيديو معروفين فقط.
import { esc } from "./ui.js";

const EMBEDS = [
  // YouTube (بوضع الخصوصية المحسّن)
  {
    re: /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/,
    src: (m) => `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`,
  },
  // Vimeo، بما فيها الروابط الخاصة ذات رمز h
  {
    re: /vimeo\.com\/(?:video\/)?(\d+)(?:\/([\da-f]+))?(?:.*[?&]h=([\da-f]+))?/,
    src: (m) => `https://player.vimeo.com/video/${m[1]}${m[2] || m[3] ? `?h=${m[2] || m[3]}` : ""}`,
  },
  // Bunny Stream
  { re: /^https:\/\/(?:iframe|player)\.mediadelivery\.net\/(?:embed|play)\/(\d+)\/([\w-]+)/, src: (m) => `https://iframe.mediadelivery.net/embed/${m[1]}/${m[2]}` },
  // Cloudflare Stream
  { re: /^https:\/\/([\w-]+\.cloudflarestream\.com\/[\w-]+)\/iframe/, src: (m) => `https://${m[1]}/iframe` },
];

/** يحدد طريقة عرض الرابط: تضمين من مزوّد، أو ملف فيديو، أو صورة. */
export function resolveMedia(item) {
  const url = String(item?.url ?? "").trim();
  // ملفات الموقع نفسه (/media/...) أو روابط https، دون الروابط النسبية للبروتوكول (//)
  const local = /^\/(?!\/)/.test(url);
  if (!local && !/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(url)) return null;
  if (item.type === "image") return { kind: "image", src: url };
  for (const e of EMBEDS) {
    const m = url.match(e.re);
    if (m) return { kind: "embed", src: e.src(m) };
  }
  return { kind: "video", src: url };
}

export function renderMedia(item) {
  const r = resolveMedia(item);
  if (!r) return "";
  const caption = item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : "";
  if (r.kind === "image") {
    return `<figure class="media"><img src="${esc(r.src)}" alt="${esc(item.caption || "")}" loading="lazy" />${caption}</figure>`;
  }
  if (r.kind === "embed") {
    return `<figure class="media"><div class="video-frame"><iframe src="${esc(r.src)}" title="${esc(
      item.caption || "فيديو الدرس",
    )}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>${caption}</figure>`;
  }
  const local = (u) => typeof u === "string" && /^\/(?!\/)|^https:\/\//.test(u);
  const poster = local(item.poster) ? ` poster="${esc(item.poster)}"` : "";
  const track = local(item.captions) ? `<track kind="captions" srclang="ar" label="العربية" src="${esc(item.captions)}" />` : "";
  return `<figure class="media"><video controls preload="metadata" controlsList="nodownload" playsinline${poster}><source src="${esc(r.src)}" type="video/mp4" />${track}</video>${caption}</figure>`;
}
