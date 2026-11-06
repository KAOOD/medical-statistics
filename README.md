# نظام الإحصاء الطبي — نسخة متعددة الملفات

مشروع واجهة عربية RTL يعمل على **GitHub Pages**، يستخدم **Firebase Authentication** لتسجيل الدخول، و**Firebase Cloud Functions** لإدارة الحسابات على الخادم. ملف العمليات يقرأه **المتصفح محلياً** بصيغة `xlsx`؛ لا يرفع الملف ولا أسماء المرضى إلى Firebase أو خدمة ذكاء اصطناعي. يعتمد المشروع على ملف المستخدم الأصلي `index (5)(1).html` مع فصل الصفحات والوظائف.

> **حالة التجهيز:** الكود جاهز للإعداد والرفع، لكنه **غير مربوط بمشروع Firebase فعلي** لأن بيانات إعداد مشروعك وحساب المدير غير متوفرة داخل المرفقات. قبل الاستخدام يجب تنفيذ خطوات الربط والنشر أدناه. لا تضع أي مفتاح سري لخادمك داخل GitHub.

## 1) شجرة المشروع

```text
medical-statistics/
├── index.html                ← فحص الجلسة ثم التحويل
├── README.md                 ← هذا الدليل
├── pages/
│   ├── login.html            ← تسجيل الدخول
│   ├── dashboard.html        ← Excel + 9 أعمدة + فرز/تحرير/حذف/إضافة
│   ├── specialties.html      ← إحصائيات الاختصاصات
│   ├── doctors.html          ← إحصائيات الأطباء والاختصاص
│   ├── doctor-details.html   ← جداول كل اختصاص وأطبائه
│   └── admin.html            ← إدارة المستخدمين للمدير
├── components/
│   ├── header.html
│   ├── sidebar.html
│   └── footer.html
├── css/style.css
├── js/
│   ├── app.js                ← نقطة تشغيل جميع الصفحات
│   ├── routes.js             ← مسارات GitHub Pages
│   ├── firebase-config.js    ← معرفات مشروع Firebase العامة
│   ├── auth.js               ← الهوية + claims + callable functions
│   ├── components.js         ← تحميل الأجزاء المشتركة
│   ├── dashboard.js          ← أحداث وعرض جدول العمليات
│   ├── reports.js            ← عرض وفرز تقارير الإحصاء
│   ├── admin.js              ← شاشة إدارة الحسابات
│   ├── excel.js              ← معالجة XLSX وتحميل القالب والتصدير
│   ├── statistics.js         ← **الحساب المشترك لكل التقارير**
│   ├── storage.js            ← sessionStorage خاص بتبويب المستخدم
│   └── utils.js              ← توحيد درجات العمليات والتواريخ والتحقق
├── vendor/jszip.min.js       ← JSZip 3.10.1 الموجودة في الملف الأصلي
├── functions/
│   ├── index.js              ← Backend محمي (5 عمليات إدارة)
│   ├── package.json
│   └── scripts/set-first-admin.cjs
├── firebase.json             ← إعداد نشر Cloud Functions
├── package.json              ← اختبارات محلية
├── tests/statistics.test.mjs
└── .gitignore
```

## 2) إنشاء مشروع Firebase

1. افتح [Firebase Console](https://console.firebase.google.com/) ثم **Add project / إنشاء مشروع**؛ سمّه مثلاً `medical-statistics` (أو اختر مشروع Firebase موجوداً).
2. من **Project settings → General → Your apps** اضغط رمز **Web `</>`** وسجّل تطبيق ويب. لا تحتاج Firebase Hosting لأن الواجهة ستُستضاف على GitHub Pages.
3. ستظهر إعدادات `firebaseConfig` (مثل `apiKey`, `authDomain`, `projectId`, `appId`, `messagingSenderId`). انسخ القيم إلى `js/firebase-config.js` بدل النصوص `PASTE_...` و`YOUR_PROJECT_ID`، مثلاً:

```js
export const firebaseConfig = {
  apiKey: 'قيمة apiKey الفعلية من Firebase',
  authDomain: 'PROJECT_ID.firebaseapp.com',
  projectId: 'PROJECT_ID',
  appId: 'قيمة appId الفعلية من Firebase',
  messagingSenderId: 'قيمة messagingSenderId الفعلية من Firebase'
};
export const functionRegion = 'us-central1';
```

**تنبيه:** إعدادات تطبيق Firebase Web أعلاه معرفات عميل عامة وليست كلمة مرور لخادم. لا تضع مطلقاً في هذا الملف `serviceAccountKey` أو `private_key` أو أي مفتاح خاص.

4. ادخل **Build → Authentication → Sign-in method** وفعّل مزوّد **Email/Password**.
5. افتح **Authentication → Settings → Authorized domains** وأضف `kaood.github.io` دون `https://` ودون `/medical-statistics`. إذا أردت التجربة محلياً أضف `localhost` أيضاً؛ لم يعد يُضاف تلقائياً إلى المشاريع الجديدة.
6. من **Authentication → Users** أنشئ حساب البريد الإلكتروني وكلمة المرور **الخاص بأول مدير فقط**. لا تنشئ واجهة تسجيل ذاتي. سيُمنح الحساب صلاحية Admin في الخطوة التالية.

> مهم: إظهار الواجهة فقط للمصرّح لهم لا يمنع محاولة تسجيل مستخدمين عبر Firebase REST مباشرة في بعض إعدادات Email/Password. **البرنامج لا يسمح بالدخول بدون claim `role: 'admin'` أو `role: 'user'`**، لذلك حتى الحساب الذي لا يملك الدور لا يستطيع فتح وظائف التقارير من خلال الواجهة. أما عمليات إدارة المستخدمين فتحميها صلاحيات الخادم فعلياً.

## 3) تفعيل Cloud Functions وإنشاء أول مدير

هذا الجزء يحتاج **خطة Blaze (ربط حساب فوترة)** لتنفيذ نشر Cloud Functions، وإن كان الاستخدام ضمن الحدود المجانية الممكنة فقد تكون التكلفة الفعلية منخفضة أو صفرية. تابع الفوترة وضع تنبيهات الميزانية.

1. ثبّت **Node.js 22** من [nodejs.org](https://nodejs.org/) و**Firebase CLI** من Terminal/PowerShell:

```bash
npm install -g firebase-tools
firebase login
```

2. افتح مجلد المشروع في Terminal:

```bash
cd medical-statistics
cd functions
npm install
cd ..
firebase use --add
```

اختر مشروع Firebase الصحيح. ينشئ الأمر ملف `.firebaserc` محلياً (محجوب عن Git بواسطة `.gitignore`).

3. لإنشاء أول مدير، نزّل **ملف مفاتيح حساب خدمة خاص بالخادم** من **Firebase Console → Project settings → Service accounts → Generate new private key** إلى مكان خاص **خارج مجلد الموقع وخارج GitHub**، مثلاً `C:\secure\my-firebase-admin.json`.

في **Windows PowerShell** (عدّل المسار والبريد):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\secure\my-firebase-admin.json"
cd functions
npm run bootstrap -- admin@example.com
cd ..
```

في **macOS / Linux**:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/secure/my-firebase-admin.json"
cd functions
npm run bootstrap -- admin@example.com
cd ..
```

هذه العملية تستخدم Admin SDK على جهازك لمنح أول حساب قمت بإنشائه في Authentication السمة `role: 'admin'`. لا تشغّل السكربت في المتصفح، ولا ترفع المفتاح الخاص إلى المستودع. استخدم إدارة أسرار صحيحة في بيئة تشغيل الإنتاج وقم بتدوير المفاتيح إذا تسرّبت.

4. انشر وظائف إدارة المستخدمين من جذر المشروع:

```bash
firebase deploy --only functions
```

سينشئ خمس وظائف **Callable** في المنطقة `us-central1`:

| الوظيفة | استخدامها |
|---|---|
| `listUsers` | قراءة قائمة الحسابات (بصفحات حتى 100 حساب) |
| `createUser` | إنشاء مستخدم وتحديد صلاحية `user`/`admin` |
| `setUserRole` | تعديل الصلاحية |
| `deleteUser` | حذف الحساب |
| `setUserDisabled` | تعطيل الحساب أو تفعيله |

كل وظيفة تتحقق من **Firebase ID token** ثم تقرأ صلاحية **المدير الحالية من Firebase Admin SDK**؛ لا تُقبل تعليمات المدير من HTML أو `localStorage`. يمنع الخادم حذف المدير لنفسه أو تخفيض صلاحية حسابه أو تعطيله وهو مسجل الدخول. إذا غيّرت منطقة الوظائف في `functions/index.js` فيجب تعديل `functionRegion` في `js/firebase-config.js` لنفس المنطقة وإعادة النشر.

> يمكن تجاهل مجلد `functions/` في GitHub Pages؛ هو **ليس خادماً على GitHub**. تنشره Firebase CLI فقط، بينما تُرفع ملفات الواجهة إلى GitHub.

## 4) رفع واجهة المشروع إلى GitHub Pages

1. افتح المستودع: [github.com/kaood/medical-statistics](https://github.com/kaood/medical-statistics) (إن كان لديك حق الوصول إليه).
2. ضع **محتويات المجلد `medical-statistics/` مباشرة في جذر المستودع**: `index.html`, `pages/`, `js/`, `css/`, `components/`, `vendor/` ... لا تضف مجلداً متداخلاً ثانياً يحمل اسم المستودع.
3. أسهل طريقة لتحديث الملفات بالجملة عبر Git:

```bash
git clone https://github.com/kaood/medical-statistics.git
cd medical-statistics
# انسخ هنا محتويات المشروع الجديد مع استبدال الملفات القديمة
git add .
git commit -m "Refactor medical statistics into modular Firebase application"
git push origin main
```

إن كانت نسختك تستخدم فرعاً آخر أو محتوى قديمًا، راجع التغييرات ولا تحذف بيانات أو ملفات مهمة قبل أخذ نسخة احتياطية.

4. من **GitHub → Repository → Settings → Pages** اختر **Deploy from a branch → main → /(root) → Save**.
5. بعد النشر افتح **https://kaood.github.io/medical-statistics/**. سيحوّلك `index.html` إلى `pages/login.html` أو `pages/dashboard.html` بحسب جلسة تسجيل الدخول وصلاحيتها.
6. سجّل بحساب المدير الذي عيّنت له `role: 'admin'`. ستظهر له **إدارة المستخدمين**. أنشئ موظفاً بصلاحية `user` وتأكد أن صفحة الإدارة لا تظهر له وأن محاولة فتح `pages/admin.html` تعيده إلى لوحة التحكم.

**ملاحظة:** صفحة `/pages/admin.html` ملف HTML عام على GitHub Pages؛ الحماية الحقيقية للعمليات في Cloud Functions، أما حجب الواجهة فهو سهولة استخدام وليس جداراً أمنياً.

## 5) تشغيل تجريبي على جهازك

لا تفتح `index.html` بالنقر المزدوج (`file://`)؛ لأن تحميل HTML المشترك عبر `fetch` يحتاج HTTP/HTTPS. افتح Terminal من جذر المشروع وشغّل:

```bash
python -m http.server 5500
```

ثم افتح **http://localhost:5500/** بعد إضافة `localhost` إلى قائمة نطاقات Firebase المسموح بها. لا تستخدم ملف Excel حقيقياً يحوي معلومات مرضى للتجارب العامة؛ استخدم بيانات وهمية.

## 6) طريقة عمل البيانات والإحصائيات

- **قالب Excel** ثابت من 7 أعمدة بالترتيب: `المريض`, `الدخول`, `التشخيص الأولي`, `تصنيف العملية`, `اسم العملية`, `درجة العملية`, `الطبيب المعالج`.
- يعرض جدول المراجعة 9 أعمدة: `ت`, `المريض`, `تاريخ الدخول`, `التشخيص الأولي`, `تصنيف العملية (الاختصاص)`, `اسم العملية`, `درجة العملية`, `الطبيب المعالج`, `إجراء`.
- `excel.js` يقرأ ملفات `.xlsx`، ويقبل القيم النصية أو الرقمية للتواريخ، ويتحقق من الأعمدة والصفوف؛ لا يستخدم AI أو Cloudflare Worker. الاستيراد يدعم **استبدال/إضافة**، وقالباً للتحميل، وتصدير السجلات المعدّلة.
- `storage.js` يحفظ بيانات العمليات فقط في `sessionStorage` باسم مرتبط بـ UID، ويمكن فتح الصفحات الأخرى في **التبويب نفسه** دون فقد البيانات. مسح البيانات أو تسجيل الخروج يحذف سجلات جلسة الإحصاء.
- `statistics.js` يحسب مرة واحدة التوزيع حسب الاختصاص/الطبيب/التفاصيل ودرجة العملية. كل الصفحات تُعيد استخدام الدالة نفسها، ويظهر تحقق مطابقة الإجماليات.
- درجات العمليات المعتمدة: `صغرى`, `متوسطة`, `كبرى`, `فوق الكبرى`, `خاصة`.
- **فصل القيصرية:** عند وجود الاختصاص القديم `نسائية وتوليد`، يُصنّف سجل العملية القيصرية إلى `قيصرية`، وبقية السجلات إلى `نسائية` **في التقارير الثلاثة كلها** لضمان التطابق. إذا كان مصدر Excel يستخدم `نسائية` و`قيصرية` منفصلين، تظل هذه القيم كما هي. راجع السجلات غير القيصرية التابعة للتوليد قبل الاعتماد الرسمي لهذه القاعدة.
- عدد العمليات في التقارير هو عدد سجلات العمليات الصحيحة، لا عدد المرضى الفريدين. وجود مريض في أكثر من عملية يساوي أكثر من سجل.

## 7) الخصوصية والأمان — مهم قبل الاستخدام في المستشفى

هذا التصميم **لا يرفع بيانات المرضى إلى Firebase ولا يخزنها في قاعدة بيانات**. لكن `sessionStorage` يخزنها على **جهاز الموظف بنص قابل للقراءة بواسطة JavaScript من نفس الموقع**، وهي ليست مشفّرة بتشفير تطبيقي خاص. لا تترك التبويب مفتوحاً على جهاز مشترك، وفكّر في سياسة مسح تلقائية للجلسات، وتقييد أجهزة العمل، ومراجعة خصوصية المستشفى قبل استخدام أسماء مرضى حقيقيين.

لا يمكن لموقع ثابت على **GitHub Pages** أن يجعل كود HTML/CSS/JS خاصاً بالمستخدم؛ كل الملفات العامة متاحة للزائر، وتتحقق الشفرة من المصادقة أثناء تشغيلها. لذلك هذا تطبيق مناسب لحساب إحصائيات محليّة **عندما تكون الأجهزة موثوقة والموظفون مرخّصين**، لكنه ليس بديلاً وحده عن مراجعة أمن معلومات صحية متكاملة. يجب إجراء اختبار أمني وتشغيلي قبل الإنتاج. لا ترفع مفاتيح Admin الخاصة إلى GitHub، واستخدم حسابات منفصلة وتفعيل MFA لحسابات الإدارة قدر الإمكان.

قد يحتوي الموقع على ملفات اعتماد JavaScript عامة من Google Firebase SDK. هذه ملفات كود وتوثيق هوية، وليست قناة لإرسال مصنفات Excel. إنشاء/إدارة الحسابات عبر Cloud Functions ينقل فقط بريد المستخدم ودوره وكلمة مرور إنشاء الحساب اللازمة لإنشاء الحساب؛ لا ينقل بيانات العمليات.

## 8) الاختبارات واستكشاف المشكلات

من جذر المشروع:

```bash
npm test
```

يشمل الاختبار سيناريو 216 عملية ومطابقة مجموع الاختصاصات والأطباء والتفاصيل، وفصل القيصرية، والتواريخ، وتوحيد درجات العمليات، والكشف عن القيود غير الصحيحة. لا يمكن إجراء **اختبار اتصال فعلي بـ Firebase** قبل إدخال مشروع Firebase ونشر الوظائف.

| المشكلة | الحل |
|---|---|
| `لم تُضبط إعدادات Firebase` | انسخ بيانات Web app الصحيحة إلى `js/firebase-config.js`. |
| `auth/unauthorized-domain` | أضف `kaood.github.io` إلى Authorized domains؛ وأضف localhost للتجربة المحلية. |
| دخول صحيح لكن **غير مخوّل** | حساب المستخدم لا يملك custom claim `role`; عيّنه من مدير النظام أو bootstrap أول مدير. |
| الصفحة لا تنقل Excel | تحقق من امتداد xlsx، أسماء الأعمدة السبعة في الصف الأول، وصحة الدرجات والتاريخ. |
| تبويب جديد لا يحمل البيانات | `sessionStorage` خاص بالتبويب؛ تنقّل عبر القائمة في التبويب نفسه. |
| `functions/not-found` أو `unavailable` | تأكد من نشر وظائف Firebase في المنطقة نفسها وتشغيل خطة Blaze. |
| `QuotaExceededError` أو خطأ مساحة الجلسة | حجم JSON تجاوز مساحة `sessionStorage` المسموحة من المتصفح؛ قسّم الملف أو قلل عدد السجلات، أو طور تخزيناً محلياً آخر مع مراجعة أمنية. |

## مراجع الإعداد الرسمية

- [إضافة Firebase إلى تطبيق JavaScript](https://firebase.google.com/docs/web/setup)
- [بناء تطبيقات Web باستخدام CDN](https://firebase.google.com/docs/web/alt-setup)
- [صلاحيات Firebase المخصصة (Custom Claims)](https://firebase.google.com/docs/auth/admin/custom-claims)
- [نشر وإدارة Cloud Functions](https://firebase.google.com/docs/functions/manage-functions)
- [توثيق GitHub Pages](https://docs.github.com/en/pages)
