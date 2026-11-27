# طلب جاهز لـ Claude: إكمال اللقطات المتبقية ورفعها إلى المستودع

يعمل هذا الطلب في Claude على جهازك: تطبيق Claude لسطح المكتب مع «Claude in Chrome» أو مع التحكم بالحاسوب، أو Claude Code. انسخ ما تحت الخط كاملاً والصقه هناك.

---

أنت تساعدني في رفع لقطات شاشة حقيقية لأدوات الذكاء الاصطناعي إلى مستودع منصتي التدريبية على GitHub.

**المستودع:** `MagdyAqel/SMART-Ai`، والفرع `claude/upbeat-ramanujan-weryd0`. ارفع إلى هذا الفرع فقط، ولا تنشئ فرعاً آخر ولا طلب دمج.

## أولاً: ابحث عن اللقطات الجاهزة
أنتج ChatGPT هذه اللقطات قبل قليل، فهي غالباً في مجلد التنزيلات داخل ملف ZIP أو كملفات PNG منفصلة. ابحث عنها بأسمائها، وفك الضغط إن لزم. ولا تعد تصوير ما وجدته.

| الملف | يُرفع إلى المجلد |
|---|---|
| `chatgpt-card-3-edit.png` | `content/skill-03/raw/shots/` |
| `music-2-prompt.png` | `content/skill-03/raw/shots/` |
| `music-3-result.png` | `content/skill-03/raw/shots/` |
| `gemini-image-result.png` | `content/skill-03/raw/shots/` |
| `gemini-video-NOT-AVAILABLE.png` | `content/skill-03/raw/shots/` |
| `notebooklm-0…` حتى `notebooklm-12-video-result.png` (13 ملفاً) | `content/skill-12/raw/shots/` |
| `STATUS.txt` إن وُجد | `content/images/` |

احتفظ بأسماء الملفات كما هي تماماً.

## ثانياً: صوّر ما لم تجده فقط
إن لم تجد لقطة منها فصوّرها بنفسك في المتصفح، وأنا مسجّل الدخول:
- **`chatgpt-card-3-edit.png`:** في محادثة البطاقة في ChatGPT، أرسل «صحّح كتابة الكلمات العربية في البطاقة، وكبّر الخط، واجعل الأسهم أوضح»، ثم صوّر الطلب والبطاقة بعد التعديل.
- **`music-2-prompt.png`:** في gemini.google.com اضغط «+» ثم «إنشاء موسيقى»، واكتب دون إرسال: «أنشودة مرحة سريعة الإيقاع لطلاب الصف الثالث لحفظ جدول ضرب العدد سبعة، بصوت أطفال، مدتها دقيقة».
- **`music-3-result.png`:** أرسل الأمر، وصوّر المقطع الناتج بغلافه وزر التشغيل.
- **`gemini-image-result.png`:** اضغط «+» ثم «إنشاء صورة»، واكتب: «رسم توضيحي مسطح بألوان هادئة لمراحل دورة الماء، بأسهم واضحة، خلفية بيضاء، بلا أي نصوص»، ثم أرسل وصوّر الأمر والصورة.
- **لقطات NotebookLM:** إن لم تجدها فأخبرني ولا تصوّرها، لأن ترتيبها محدد مسبقاً.

## قواعد إلزامية
1. صوّر الواجهة الحقيقية فقط. لا تولّد صوراً ولا تعدّل محتواها.
2. لا تكتب كلمة مرور ولا تطلبها. إن ظهرت صفحة تسجيل دخول فتوقّف واطلب مني أن أسجّل الدخول بنفسي.
3. **الخصوصية:** يجب ألا يظهر اسم الحساب أو البريد أو الصورة الشخصية أو قوائم المحادثات السابقة. افحص كل لقطة قبل رفعها، واطمس ما يظهر من ذلك أو قصّه.
4. احفظ كل لقطة بصيغة PNG.
5. لا ترفع أي ملف غير اللقطات وملف STATUS.txt، ولا ترفع أي ملف فيه مفاتيح أو كلمات مرور.

## ثالثاً: الرفع
**إن كان المستودع منسوخاً على جهازي وتستطيع تشغيل git:**
```
git fetch origin claude/upbeat-ramanujan-weryd0
git checkout claude/upbeat-ramanujan-weryd0
git pull
# انسخ الملفات إلى مجلداتها
git add content/skill-03/raw/shots content/skill-12/raw/shots content/images/STATUS.txt
git commit -m "Add remaining real tool screenshots"
git push origin claude/upbeat-ramanujan-weryd0
```

**وإلا فارفعها من موقع GitHub في المتصفح:**
1. افتح `https://github.com/MagdyAqel/SMART-Ai/tree/claude/upbeat-ramanujan-weryd0/content/skill-03/raw/shots`.
2. اضغط «Add file» ثم «Upload files»، واسحب ملفات skill-03.
3. اختر «Commit directly to the claude/upbeat-ramanujan-weryd0 branch»، ثم اضغط «Commit changes».
4. كرّر الخطوات نفسها لمجلد `content/skill-12/raw/shots`. إن لم يكن المجلد موجوداً فاكتب المسار في خانة اسم الملف قبل الرفع.

## في النهاية أعطني
- قائمة بما رُفع، مع مسار كل ملف.
- ما لم يُرفع، وسببه.
- رابط الـ commit على GitHub.
