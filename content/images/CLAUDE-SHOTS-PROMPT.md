# طلب جاهز لـ Claude: رفع اللقطات المتبقية إلى المستودع

يعمل هذا الطلب في Claude على جهازك: تطبيق Claude لسطح المكتب مع Claude in Chrome أو التحكم بالحاسوب، أو Claude Code. انسخ ما تحت الخط كاملاً والصقه هناك.

---

أريد رفع لقطات شاشة حقيقية لأدوات الذكاء الاصطناعي إلى مستودع منصتي التدريبية على GitHub.

- **المستودع:** `MagdyAqel/SMART-Ai`
- **الفرع:** `claude/upbeat-ramanujan-weryd0` فقط. لا تنشئ فرعاً آخر، ولا تنشئ طلب دمج.

## ١) اجمع اللقطات
أنتج ChatGPT هذه اللقطات قبل قليل. تجدها غالباً في مجلد «التنزيلات»، إما داخل ملف ZIP أو ملفات PNG منفصلة. ابحث عنها، وفكّ الضغط إن لزم، ولا تغيّر أسماء الملفات.

**أ) لقطات المهارة الثالثة:** ترفع إلى `content/skill-03/raw/shots/`
- `chatgpt-card-3-edit.png`
- `music-2-prompt.png`
- `music-3-result.png`
- `gemini-image-result.png`
- `gemini-video-NOT-AVAILABLE.png`

**ب) لقطات Gemini Notebook:** ترفع إلى `content/skill-12/raw/shots/`
- كل الملفات التي يبدأ اسمها بـ `notebooklm-`، من `notebooklm-0` إلى `notebooklm-12-video-result.png`.
- أهمها: الاستوديو، والخريطة الذهنية، ونافذة الاختبار ونتيجته، ونافذة تخصيص الملخص الصوتي، ونافذة الملخص بالفيديو، والفيديو الناتج.

**ج) ملف الحالة:** إن وجدت `STATUS.txt` فارفعه إلى `content/images/`.

## ٢) إن لم تجد لقطة، صوّرها بنفسك
افعل ذلك في متصفحي وأنا مسجّل الدخول:
- **`chatgpt-card-3-edit.png`:** افتح محادثة البطاقة التربوية في ChatGPT، وأرسل: «صحّح كتابة الكلمات العربية في البطاقة، وكبّر الخط، واجعل الأسهم أوضح». ثم صوّر الطلب والبطاقة بعد التعديل.
- **`music-2-prompt.png`:** في gemini.google.com اضغط «+» ثم «إنشاء موسيقى»، واكتب دون إرسال: «أنشودة مرحة سريعة الإيقاع لطلاب الصف الثالث لحفظ جدول ضرب العدد سبعة، بصوت أطفال، مدتها دقيقة».
- **`music-3-result.png`:** أرسل الأمر السابق، ثم صوّر الأنشودة الناتجة بغلافها وزر التشغيل.
- **`gemini-image-result.png`:** اضغط «+» ثم «إنشاء صورة»، واكتب: «رسم توضيحي مسطح بألوان هادئة لمراحل دورة الماء، بأسهم واضحة، خلفية بيضاء، بلا أي نصوص». أرسل، ثم صوّر الأمر والصورة.
- **لقطات Notebook:** إن لم تجدها، صوّرها من دفتر «رحلة قطرة الماء في الطبيعة» في Gemini Notebook:
  - `notebook-studio.png`: لوحة Studio.
  - `notebook-mindmap.png`: الخريطة الذهنية مفتوحة.
  - `notebook-quiz.png`: نافذة إعداد الاختبار.
  - `notebook-quiz-result.png`: سؤال من الاختبار.
  - `notebook-audio.png`: نافذة «تخصيص الملخّص الصوتي».
  - `notebook-video.png`: نافذة «تخصيص الملخّص بالفيديو».
  - `notebook-video-result.png`: الفيديو الناتج.

## قواعد إلزامية
1. صوّر الواجهة الحقيقية فقط. لا تولّد صوراً، ولا تعدّل محتوى أي لقطة.
2. لا تكتب كلمة مرور ولا تطلبها. إن ظهرت صفحة تسجيل دخول، توقّف واطلب مني أن أسجّل الدخول بنفسي.
3. **الخصوصية:** افحص كل لقطة قبل رفعها. يجب ألا يظهر فيها اسم الحساب ولا البريد ولا الصورة الشخصية ولا قوائم المحادثات أو الدفاتر السابقة. اطمس ما يظهر من ذلك أو قصّه.
4. احفظ اللقطات بصيغة PNG فقط.
5. لا ترفع أي ملف غير اللقطات وملف STATUS.txt.

## ٣) ارفع اللقطات
**إن كان المستودع منسوخاً على جهازي:**
```
git fetch origin claude/upbeat-ramanujan-weryd0
git checkout claude/upbeat-ramanujan-weryd0
git pull
# انسخ الملفات إلى مجلداتها، ثم:
git add content/skill-03/raw/shots content/skill-12/raw/shots content/images/STATUS.txt
git commit -m "Add remaining real tool screenshots"
git push origin claude/upbeat-ramanujan-weryd0
```

**وإلا فارفعها من موقع GitHub في المتصفح:**
1. افتح هذا الرابط: `https://github.com/MagdyAqel/SMART-Ai/tree/claude/upbeat-ramanujan-weryd0/content/skill-03/raw/shots`
2. اضغط «Add file» ثم «Upload files»، واسحب لقطات المهارة الثالثة.
3. اختر «Commit directly to the claude/upbeat-ramanujan-weryd0 branch»، ثم اضغط «Commit changes».
4. كرّر الخطوات نفسها للمجلد `content/skill-12/raw/shots` ولقطات Notebook.

## ٤) في النهاية أعطني
- قائمة بما رُفع، مع مسار كل ملف.
- قائمة بما لم يُرفع، وسبب ذلك.
- رابط الـ commit على GitHub.
