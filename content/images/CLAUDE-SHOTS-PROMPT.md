# طلب جاهز لـ Claude (الجولة الثانية): لقطات الأدوات الباقية وإعادة التصوير بدقة أعلى

يعمل هذا الطلب في Claude على جهازك: تطبيق Claude لسطح المكتب مع Claude in Chrome أو التحكم بالحاسوب، أو Claude Code. انسخ ما تحت الخط كاملاً والصقه هناك.

---

أريد لقطات شاشة حقيقية لأدوات الذكاء الاصطناعي، وأن ترفعها مباشرة إلى مستودع منصتي التدريبية على GitHub.

- **المستودع:** `MagdyAqel/SMART-Ai`
- **الفرع:** `claude/upbeat-ramanujan-weryd0` فقط. لا تنشئ فرعاً آخر، ولا طلب دمج.

## مواصفات كل لقطة (إلزامية)
1. **الدقة:** اجعل نافذة المتصفح بملء الشاشة، وكبّر الصفحة إلى ١٢٥٪، والتقط النافذة بدقتها الأصلية. يجب ألا يقل عرض اللقطة عن **1400 بكسل**، ولا تصغّرها قبل الحفظ.
2. **الصيغة:** PNG فقط، وباسم الملف المحدد تماماً.
3. **الحقيقة:** صوّر الواجهة الحقيقية فقط. لا تولّد صوراً، ولا تعدّل محتوى اللقطة.
4. **الدخول:** لا تكتب كلمة مرور ولا تطلبها. إن ظهرت صفحة تسجيل دخول، توقّف واطلب مني أن أسجّل الدخول بنفسي.
5. **الخصوصية:** يجب ألا يظهر في اللقطة اسم الحساب ولا البريد ولا الصورة الشخصية ولا قوائم المحادثات أو الملفات السابقة. اطمس ذلك أو قصّه، ولا تستخدم أي بيانات طلاب.
6. **الانتظار:** انتظر اكتمال النتيجة قبل التصوير، وأبعد مؤشر الفأرة عن النص.
7. **الأداة غير المتاحة:** إن لم تكن الأداة متاحة في الحساب، فصوّر رسالة عدم الإتاحة باسم `<الاسم>-NOT-AVAILABLE.png`، ولا تصنع بديلاً.

## الجزء الأول: لقطات جديدة (11 لقطة)

**أ) `content/skill-13/raw/shots/` (الوكيل الذكي)**
- `gemini-skills-manage.png`: في gemini.google.com افتح القائمة الجانبية ثم «إدارة Gem» (أو «المهارات»). يجب أن تظهر رسالة «أصبحت Gems الآن مهارات» والمهارات الجاهزة من Google. أخفِ قائمة «Gems التي أنشأتها».
- `claude-skills-list.png`: في claude.ai افتح Settings ثم Capabilities أو Skills. يجب أن تظهر قائمة Skills النشطة.
- `openai-dots.png`: ميزة Dots في chatgpt.com إن كانت متاحة، ويظهر فيها إعداد Dot لمهمة «ورقة عمل العلوم».

**ب) `content/skill-04/raw/shots/` (أدوات Google)**
- `google-forms-gemini.png`: في forms.google.com أنشئ نموذجاً جديداً، ثم اضغط زر Gemini «ساعدني في إنشاء نموذج»، واكتب: «اختبار قصير من خمسة أسئلة عن الخلية للصف السابع». صوّر لوحة Gemini والأسئلة المقترحة.
- `classroom-gemini.png`: تبويب Gemini في classroom.google.com إن كان متاحاً، ويظهر فيه أدوات المعلم.
- `notebook-sources.png`: في Gemini Notebook أنشئ دفتراً جديداً، والصق نصاً قصيراً عن الخلية النباتية والحيوانية مصدراً، ثم اسأل: «ما الفرق بين الخلية النباتية والحيوانية؟». صوّر الإجابة بأرقام الإحالة.

**ج) `content/skill-05/raw/shots/` (أدوات Microsoft)**
- `copilot-chat.png`: في copilot.microsoft.com اكتب: «اقترح ثلاثة أسئلة قصيرة لقياس فهم طلاب الصف السابع للخلية، مع الإجابة المتوقعة». صوّر الأمر والإجابة كاملة.
- `powerpoint-copilot.png`: في PowerPoint على الويب افتح Copilot، وصوّر لوحته وخيار «إنشاء عرض تقديمي من ملف».
- `reading-coach.png`: الشاشة الرئيسية لأداة Reading Coach أو Reading Progress، إن كانت متاحة.

**د) `content/skill-06/raw/shots/` (البحث العلمي)**
- `consensus-results.png`: في consensus.app ابحث عن: «Does flipped learning improve middle school science achievement?». صوّر الملخص ومقياس الاتفاق وقائمة الدراسات.
- `elicit-table.png`: في elicit.com ابحث عن السؤال نفسه، وصوّر جدول الدراسات بأعمدته.

## الجزء الثاني: إعادة تصوير اللقطات الحالية بدقة أعلى
اللقطات الحالية عرضها نحو 600 بكسل، فيظهر النص فيها غير حاد. أعد تصويرها بالمواصفات أعلاه، بالأسماء نفسها، وفي مجلداتها نفسها، فتحلّ النسخ الجديدة محل القديمة. ابدأ بالأهم:
1. **`content/skill-03/raw/shots/`:**
   - `music-2-prompt.png`
   - `music-3-result.png`
   - `gemini-image-result.png`
   - `storybook-2-prompt.png`
   - `storybook-3-result.png`
   - `chatgpt-card-1-prompt.png`
   - `chatgpt-card-2-result.png`
   - `chatgpt-card-3-edit.png`
2. **`content/skill-12/raw/shots/`:**
   - `notebooklm-2-add-sources.png`
   - `notebook-sources.png`
   - `notebooklm-5-studio.png`
   - `notebooklm-6-mindmap.png`
   - `notebooklm-7-quiz-settings.png`
   - `notebooklm-8-audio-settings.png`
   - `notebooklm-9-quiz.png`
   - `notebooklm-11-audio-result.png`

   استخدم دفتر «رحلة قطرة الماء في الطبيعة» نفسه.

استخدم الأوامر نفسها المكتوبة في `content/images/SHOTS.md` لكل لقطة.

## الرفع
**إن كان المستودع منسوخاً على جهازي:**
```
git fetch origin claude/upbeat-ramanujan-weryd0
git checkout claude/upbeat-ramanujan-weryd0
git pull
# انسخ الملفات إلى مجلداتها، ثم:
git add content/*/raw/shots
git commit -m "Add remaining tool screenshots and high-res recaptures"
git push origin claude/upbeat-ramanujan-weryd0
```

**وإلا فمن موقع GitHub:**
1. افتح مجلد اللقطات على الفرع.
2. اضغط «Add file» ثم «Upload files».
3. اختر «Commit directly to the claude/upbeat-ramanujan-weryd0 branch».

## في النهاية أعطني
- قائمة بما رُفع، مع مسار كل ملف وعرضه بالبكسل.
- ما لم يتح، وسبب ذلك.
- رابط الـ commit.
