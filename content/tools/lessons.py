# فيديو إنفوجرافيك لكل درس: يشرح تنفيذ الدرس بالصوت والحركة ومثال تطبيقي داخل الفيديو.
# المخرجات لكل درس في مجلد المهارة: lesson-{id}.json و lesson-{id}-narration.txt
# ويُضاف الفيديو إلى وسائط الدرس (lesson.media) فيظهر أعلى صفحة الدرس.
#   python3 lessons.py [lesson-id ...]     يبني المواصفات (كلها أو المحددة)
#   ثم بعد التعليق الصوتي:  node render-video.mjs ../skill-03 lesson-music-lyria
import json
import os
import sys

from explainers import closing, first, hook

ROOT = os.path.join(os.path.dirname(__file__), "..")
NTH = ["", "الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة",
       "العاشرة", "الحادية عشرة", "الثانية عشرة", "الثالثة عشرة"]


def checklist(lead, title, items):
    """items: (النص الظاهر، الجملة المنطوقة)؛ أول كلمتين من الجملة المنطوقة توقيت الظهور."""
    return {"type": "checklist", "icon": "shield-check", "title": title,
            "say": lead + " " + " ".join(said for _, said in items),
            "items": [{"text": t, "at": said} for t, said in items]}


def build(sid, lesson_id, v):
    d = os.path.join(ROOT, sid)
    path = os.path.join(d, "skill.json")
    skill = json.load(open(path))
    n = skill["number"]
    name = f"lesson-{lesson_id}"
    scenes, parts = [], []
    for i, sc in enumerate(v["scenes"]):
        sc = dict(sc)
        say = sc.pop("say")
        parts.append(say)
        if sc["type"] == "hook":
            sc["kicker"] = f"المهارة {NTH[n]} · شرح الدرس"
        scenes.append({"id": f"l{i + 1}", "text": first(say), **sc})
    spec = {"badge": f"المهارة {n} · {v['kicker']}", "sting": v["kicker"], "posterAt": 4.2, "scenes": scenes}
    json.dump(spec, open(os.path.join(d, f"{name}.json"), "w"), ensure_ascii=False, indent=2)
    text = "\n\n".join(parts)
    open(os.path.join(d, f"{name}-narration.txt"), "w").write(text + "\n")

    entry = {"type": "video", "url": f"/media/{sid}/{name}-video.mp4", "poster": f"/media/{sid}/{name}-poster.jpg",
             "captions": f"/media/{sid}/{name}-video.ar.vtt", "caption": v["title"]}
    for L in skill["lessons"]:
        if L["id"] == lesson_id:
            # فيديو الدرس أولاً، ثم أي وسائط أخرى موجودة
            L["media"] = [entry] + [m for m in L.get("media", []) if m.get("url") != entry["url"]]
            break
    else:
        raise SystemExit(f"لا يوجد درس {lesson_id} في {sid}")
    json.dump(skill, open(path, "w"), ensure_ascii=False, indent=2)
    words = len(text.split())
    print(f"{sid}/{name}: {len(scenes)} مشاهد · {words} كلمة (≈ {words / 1.75:.0f} ث)")


# ============================================================ المهارة 3: موسيقى تعليمية بـ Gemini
MUSIC = dict(
    kicker="موسيقى تعليمية بـ Gemini", title="شرح الدرس: موسيقى تعليمية بـ Gemini",
    scenes=[
        hook("هل تريد أن يحفظ طلابك جدول الضرب وهم يغنّون؟ في هذا الدرس ننشئ أنشودة تعليمية كاملة في Gemini، خطوةً خطوة.",
             "", "موسيقى تعليمية بـ Gemini", "من فكرة الدرس… إلى أنشودة يرددها الطلاب", "في هذا الدرس", "ex5.jpg"),
        {"type": "definition", "icon": "music", "term": "إنشاء الموسيقى في Gemini",
         "say": "يتيح تطبيق Gemini إنشاء مقاطع موسيقية بنموذج Lyria من Google. تختار «إنشاء موسيقى»، وتصف ما تريد بالنص أو بصورة، فيولّد لحناً بغناء أو بدونه.",
         "definition": "تصف المقطع بالكلمات… فيولّد Lyria لحناً بغناء أو بدونه",
         "chips": [{"label": "وصف نصي", "icon": "file-text", "at": "بالنص"}, {"label": "صورة", "icon": "image", "at": "بصورة"},
                   {"label": "بغناء", "icon": "mic", "at": "بغناء"}, {"label": "بلا غناء", "icon": "audio-lines", "at": "بدونه"}]},
        {"type": "cards", "title": "أين تستخدمها في صفك؟", "icon": "lightbulb",
         "say": "وفي الصف أربعة استخدامات: أنشودة لحفظ جدول الضرب أو قاعدة نحوية. وموسيقى هادئة لوقت القراءة. ومقدمة لإذاعة المدرسة أو فيديو تعليمي. ومؤثر قصير يشدّ الانتباه في بداية النشاط.",
         "cards": [{"title": "أنشودة للحفظ", "text": "جدول الضرب، أو قاعدة نحوية.", "icon": "music", "at": "أنشودة لحفظ", "tone": "teal"},
                   {"title": "موسيقى هادئة", "text": "لوقت القراءة أو التأمل.", "icon": "book-open", "at": "وموسيقى هادئة", "tone": "amber"},
                   {"title": "مقدمة موسيقية", "text": "للإذاعة المدرسية أو الفيديو.", "icon": "radio", "at": "ومقدمة لإذاعة", "tone": ""},
                   {"title": "مؤثر للانتباه", "text": "بداية النشاط أو الانتقال.", "icon": "bell", "at": "ومؤثر قصير", "tone": "teal"}]},
        {"type": "screen", "step": 0, "stepLabel": "مثال تطبيقي", "title": "أنشودة جدول السبعة", "tip": "الصف الثالث · دقيقة واحدة",
         "icon": "music", "window": "Gemini · إنشاء موسيقى", "botIcon": "music",
         "say": "لنطبّق. نكتب الكلمات بأنفسنا أولاً بالفصحى، ثم نكتب الأمر: أنشودة مرحة سريعة الإيقاع لطلاب الصف الثالث، لحفظ جدول ضرب العدد سبعة، بصوت أطفال، مدتها دقيقة. فيولّد Gemini المقطع مع غلاف، ونستمع إليه ونعدّل الإيقاع إن لزم.",
         "prompt": "أنشودة مرحة سريعة الإيقاع لطلاب الصف الثالث لحفظ جدول ضرب العدد ٧، بالكلمات المرفقة، بصوت أطفال، مدتها دقيقة",
         "typeAt": "ثم نكتب الأمر", "outputAt": "فيولّد Gemini",
         "output": [{"text": "🎵 «سبعة في واحد سبعة» · مدتها دقيقة", "head": True},
                    "سبعة في اثنين أربعة عشر… هيا نحفظ ونكبر",
                    "إيقاع مرح · صوت أطفال · غلاف ملوّن",
                    {"text": "استمع ← عدّل الإيقاع أو الصوت إن لزم", "mark": "edit", "markAt": "ونعدّل الإيقاع"}]},
        checklist("وقبل أن تعرضها على طلابك، راجع ثلاثة أمور.", "قبل العرض في الصف", [
            ("الكلمات صحيحة لغوياً وعلمياً", "صحة الكلمات لغوياً وعلمياً، فأنت من كتبها وأنت المسؤول عنها."),
            ("مناسبة لسياسة المدرسة وثقافة المجتمع", "ومناسبة الموسيقى لسياسة مدرستك وثقافة مجتمعك، ويمكنك الاكتفاء بالإيقاع وحده."),
            ("الإفصاح: مولّدة بالذكاء الاصطناعي", "والإفصاح لطلابك أنها مولّدة بالذكاء الاصطناعي، فهي تحمل علامة مائية رقمية تدل على ذلك."),
        ]),
        closing("إذن: اكتب الكلمات بنفسك، وصِف اللحن بدقة، ثم راجع وأفصح. وهكذا تصبح الأنشودة أداة حفظ ممتعة يرددها طلابك.",
                "اكتب… صِف… راجع وأفصح",
                [("اكتب الكلمات", "pencil", "اكتب الكلمات"), ("صِف اللحن", "music", "وصِف اللحن"), ("راجع وأفصح", "shield-check", "ثم راجع")]),
    ],
)

SPECS = {
    "music-lyria": ("skill-03", MUSIC),
}

if __name__ == "__main__":
    ids = sys.argv[1:] or list(SPECS)
    for lid in ids:
        sid, v = SPECS[lid]
        build(sid, lid, v)
