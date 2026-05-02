# QR Code: Polling → Firestore onSnapshot Migration

دليل تفصيلي لتحويل تدفق الـ QR في تطبيقات الديسكتوب من **HTTP polling** إلى **Firestore `onSnapshot`** عبر Firebase Web SDK مع bootstrap تلقائي للـ config — لتطبيقه على عدة مشاريع بنفس البنية.

> هذا المستند يصف **النسخة النهائية** من الحل. مر بمرحلة وسيطة عبر Server-Sent Events (SSE) تم رفضها لأنها كانت تبقي Cloud Function مفتوحة لـ ~9 دقائق لكل ديسكتوب نشط، وده أعلى تكلفة من اللازم.

---

## 1) المشكلة الأصلية

الديسكتوب كان:
1. `POST /createNewQr` → ينشئ doc جديد في `qrWindows`.
2. كل **5 ثواني**: `GET /getQrData?id={qrId}` (`setInterval`).
3. بعد **10 محاولات** (~50 ثانية) بدون scan → خطأ `"تم انتهاء وقت الاتصال"`.
4. زر *"إعادة المحاولة"* كان ينادي `createQrCode()` → **QR doc جديد** كل مرة، رغم إن الأول لم يستخدم.

**الأضرار:** ركوستات HTTP كتيرة (12/دقيقة لكل ديسكتوب) + تضخم `qrWindows` بـ docs مهجورة + تأخير حتى 5 ثوان لظهور الفيديو + الـ retry يخلق صفحات QR متعددة.

---

## 2) الحل المُختار: Firestore `onSnapshot` من الـ Web SDK

### لماذا هذا الحل (وليس SSE/FCM/Webhook)؟

| الحل | تكلفة الانتظار | تعقيد الإعداد | يعمل في WebView | السرعة |
|---|---|---|---|---|
| Polling (الأصلي) | 12 invocations/min | بسيط | ✓ | تأخير حتى 5s |
| **SSE Cloud Function** | function مفتوحة 5+ دقايق | متوسط | ✓ | < 1s |
| FCM Web Push | function ~100ms لكل update | عالي (service worker, VAPID, permission prompt) | ⚠️ مش موثوق | < 1s |
| **Firestore onSnapshot** ⭐ | **صفر function calls** — Firestore reads فقط | منخفض | ✓ | < 1s |

`onSnapshot` يستخدم اتصال WebSocket واحد مدار من Firebase Web SDK مباشرة لـ Firestore — Cloud Functions لا تتدخل أبدًا. التكلفة تنحصر في reads ضئيلة (1 read على الاتصال + read لكل تحديث).

### مشكلة الإعداد عبر مشاريع متعددة (والحل)

كل مشروع له Firebase web config مختلف (apiKey, projectId, ...). نسخها يدويًا في كل ديسكتوب جديد عمل ممل ومُعرض للأخطاء. **الحل**: endpoint بسيط `firebaseConfig` في Cloud Functions كل مشروع يخدم القيم. الـ package يـ fetch منه تلقائيًا عند أول استخدام ويـ initialize Firebase. **النتيجة**: مشروع جديد = `firebase deploy` للـ function + تحديث نسخة الـ package — صفر إعداد يدوي في الديسكتوب.

> **ملاحظة أمنية**: قيم Firebase web config (apiKey وغيرها) **مش أسرار** بحكم تصميم Firebase. الأمان الفعلي بيجي من **Firestore Security Rules**. راجع [توثيق Firebase الرسمي](https://firebase.google.com/docs/projects/api-keys) لو محتاج تأكيد.

### تدفق العمل الجديد

```
[Desktop AppProvider mounts]
  │
  ├─► (lazy) GET /api/firebaseConfig                      [Cloud Function ~100ms]
  │   ◄── { apiKey, projectId, ... }
  │
  ├─► initializeApp(config) + getFirestore()              [client-side, in-memory]
  │
  ├─► POST /api/createNewQr  (still hits Cloud Function)
  │   ◄── { id, ... }
  │
  └─► onSnapshot(qrWindows/{id})                          [WebSocket — direct to Firestore]
        │
        │  (Teacher attaches video from another device)
        │
        ▼
      [snap fires within < 1s]
        │
        ├─► onUpdate(data)
        └─► if resolved → onDone(data) + close
```

---

## 3) التغييرات على المستوى التفصيلي

### 3.1) Cloud Functions — `functions/src/index.js`

أضفنا export واحد فقط: `firebaseConfig`. (الـ `qrEvents` SSE القديم تم حذفه نهائيًا.)

```js
exports.firebaseConfig = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    res.set('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      apiKey: process.env.FIREBASE_WEB_API_KEY || 'AIzaSy...',
      authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN || 'muyasser-hassan.firebaseapp.com',
      projectId: process.env.FIREBASE_WEB_PROJECT_ID || 'muyasser-hassan',
      storageBucket: process.env.FIREBASE_WEB_STORAGE_BUCKET || '...',
      messagingSenderId: process.env.FIREBASE_WEB_MESSAGING_SENDER_ID || '...',
      appId: process.env.FIREBASE_WEB_APP_ID || '...',
      databaseURL: process.env.FIREBASE_WEB_DATABASE_URL || '...',
      measurementId: process.env.FIREBASE_WEB_MEASUREMENT_ID || '...',
    });
  });
});
```

**نقاط مهمة:**
- `Cache-Control: max-age=300` — الـ config ثابت، يكفي 5 دقائق cache على المتصفح/CDN.
- القيم الافتراضية = config المشروع الحالي. لتطبيقها على مشروع تاني، إما عدّل الافتراضيات أو ضع env vars (`firebase functions:config:set` أو `.env`).

### 3.2) Firestore Rules — `firestore.rules`

أضفنا rule صريح يسمح بقراءة `qrWindows` من client SDK ويمنع الكتابة (الكتابة من Admin SDK في Cloud Functions فقط):

```
match /qrWindows/{qrId} {
  allow read: if true;
  allow write: if false;
}
```

**ليه `allow read: if true`؟** الـ QR id هو timestamp (`Date.now().toString()`)، ليس سرًا، ولا يحتوي على بيانات حساسة قبل ما الطالب يـ scan. بعد الـ scan، الديسكتوب اللي خلق الـ QR هو الجهاز الوحيد اللي يعرف الـ id، فعمليًا لا أحد آخر يقدر يقراه. لو محتاج قيود أكثر، يمكن تشييد rule على match `deviceID` من custom claims.

نشر القواعد:
```
firebase deploy --only firestore:rules
```

### 3.3) Package — `services/firebase.ts`

تم إعادة الكتابة بالكامل. الـ class صار:
- يحتفظ بـ `bootstrapPromise` — أول caller يـ fetch الـ config، الباقي يستنوا نفس الـ promise.
- `setConfigUrl()` لـ override الـ URL (افتراضي `/api/firebaseConfig`).
- `subscribeToQrCode()` يـ return `Promise<Unsubscribe>` — الـ promise يتحلل بعد ما Firebase يكون جاهز و الـ listener متصل.
- يحافظ على الـ APIs القديمة (`createQrCode`, `checkVersion`, `incrementVideoEntryCounter`, `updateVideoProgress`) لكن كلها بقت تـ await `ensureReady()` بدلًا من الاعتماد على `initialize()` صريح.
- استخدام `getApps()` لتجنب `initializeApp` duplicate-name error في حالات HMR.

```ts
private async ensureReady(): Promise<Firestore> {
  if (this.db) return this.db;
  if (this.bootstrapPromise) return this.bootstrapPromise;

  this.bootstrapPromise = (async () => {
    const res = await fetch(this.configUrl, { credentials: 'omit' });
    if (!res.ok) throw new Error(`firebaseConfig endpoint returned ${res.status}`);
    const config = (await res.json()) as FirebaseWebConfig;

    const existing = getApps();
    this.app = existing.length > 0 ? existing[0] : initializeApp(config);
    this.db = getFirestore(this.app);
    return this.db;
  })();

  try { return await this.bootstrapPromise; }
  catch (err) { this.bootstrapPromise = null; throw err; }
}
```

### 3.4) Package — `services/api.ts`

الـ API لـ `subscribeToQrUpdates` **لم يتغير** (نفس `QrEventHandlers` interface). داخليًا يستخدم `firebaseService.subscribeToQrCode` بدلًا من `EventSource`:

```ts
subscribeToQrUpdates(qrId, handlers): QrEventSubscription {
  let unsubscribe = null, closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (unsubscribe) try { unsubscribe(); } catch (_) {}
  };

  firebaseService.subscribeToQrCode(qrId,
    (data) => {
      if (closed) return;
      handlers.onUpdate(data);
      if (qrIsResolved(data)) {
        handlers.onDone?.(data);
        close();
      }
    },
    (err) => { if (!closed) { handlers.onError?.(err); close(); } }
  ).then((unsub) => {
    // Caller may have closed before bootstrap finished.
    if (closed) try { unsub(); } catch (_) {}
    else unsubscribe = unsub;
  }).catch((err) => {
    if (!closed) handlers.onError?.(err);
  });

  return { close };
}
```

`onTimeout` يبقى موجود في الـ interface (backward compat) لكنه لن يُستدعى أبدًا — Firestore SDK يعيد الاتصال تلقائيًا على network drops بدون ما يقطعنا.

### 3.5) Package — `context/AppContext.tsx`

**لم يتغير عمليًا** — يستخدم نفس `apiService.subscribeToQrUpdates` بنفس الـ handlers. لو طبقت التغييرات على مشروع آخر سابقًا (نسخة SSE)، الـ `AppContext.tsx` السابقة تعمل بدون تعديل. التعليقات فقط تم تحديثها لتعكس الـ backend الجديد.

### 3.6) Package — `hooks/useQrCode.ts` و `index.ts`

تحديثات تعليقات بسيطة + تصدير `FirebaseWebConfig` type:
```ts
export type { FirebaseWebConfig } from './services/firebase';
```

### 3.7) Next.js Proxy — `next.config.js`

**لم يتغير**. الـ rewrite `/api/:path*` → Cloud Functions يخدم `firebaseConfig` و `createNewQr` و كل HTTP requests التانية. Firestore `onSnapshot` لا يمر عبر هذا الـ proxy — يفتح اتصال WebSocket مباشر لـ `firestore.googleapis.com`.

---

## 4) خطوات التطبيق على مشروع جديد بنفس المواصفات

> **افتراض**: المشروع لديه نفس الثلاثية (functions Cloud, package shared, app Next.js) ونفس مجموعة Firestore `qrWindows`.

### الخطوة 1 — Cloud Functions (دقيقتين)
1. افتح `functions/src/index.js`.
2. ضع `firebaseConfig` export قبل أي export `getQrData` (3.1).
3. عدّل القيم الافتراضية لتطابق مشروعك. الـ values دي موجودة في `lib/firebase_options.dart` لو فيه Flutter app في نفس المشروع، أو في Firebase Console → Project Settings → Your apps → Web app → Firebase SDK snippet.
4. `cd functions && firebase deploy --only functions:firebaseConfig`.
5. اختبر:
   ```bash
   curl https://REGION-PROJECT.cloudfunctions.net/firebaseConfig
   ```
   يجب أن ترجع JSON كامل.

### الخطوة 2 — Firestore Rules (دقيقة)
1. افتح `firestore.rules` في المشروع.
2. أضف rule `qrWindows` (3.2).
3. `firebase deploy --only firestore:rules`.

### الخطوة 3 — الـ Package (مرة واحدة لكل النسخة)
المفروض يكون عندك نسخة محدثة من الـ package بالفعل. لو لأ، طبق الكود في 3.3, 3.4, 3.5, 3.6 على الـ package. ابن:
```
cd custom_web_desktop_package
npm install
npm run build
```
زود رقم الإصدار في `package.json` وانشر.

### الخطوة 4 — تطبيق الديسكتوب (Next.js)
1. حدّث الاعتماد على الـ package إلى الإصدار الجديد:
   ```
   npm install @nexwave/custom_web_desktop_package@latest
   ```
2. **بدون أي تغيير في كود الديسكتوب** — `LoginController` وكل المكونات تشتغل بنفس الـ API.
3. ابن وانشر.

### الخطوة 5 — التحقق
1. افتح الديسكتوب في المتصفح. افتح DevTools → Network.
2. **أول لمحة**: ركوست واحد لـ `firebaseConfig` (200 OK).
3. ركوست واحد لـ `createNewQr` (200 OK).
4. ركوست واحد لـ `firestore.googleapis.com/.../Listen/channel` (دائم، WebSocket-style — هذا هو الـ onSnapshot).
5. **لا يجب أن ترى أي ركوستات `getQrData` متكررة**.
6. عدّل الدوك من Firebase Console (مثلًا أضف `videoID: "test"`). خلال < 1 ثانية، الديسكتوب يجب أن ينتقل لصفحة الفيديو.

---

## 5) الـ rollback (إن لزم)

عندك خياران:

### A) Rollback سريع (دون deploy للـ functions)
- ال endpoints القديمة `getQrData` و `createNewQr` ما زالت تعمل.
- ارجع لنسخة الـ package القديمة (polling) في `package.json` للديسكتوب.
- `npm install && npm run build && deploy`.

### B) Full rollback
- `firebase functions:delete firebaseConfig --region us-central1` — لن يؤثر على أي شيء آخر.
- إعادة rule `qrWindows` للوضع السابق (أو مسحه — اللي تحت في الـ rules ما يأثرش).
- ارجع نسخة الـ package القديمة.

النسخ القديمة من الكود متاحة في git history.

---

## 6) الفرق في الأرقام

| المقياس | قبل (Polling) | بعد (onSnapshot) |
|---|---|---|
| طلبات HTTP لكل ديسكتوب/دقيقة (انتظار) | 12 | **0** |
| Cloud Functions invocations لكل QR session | ~12 polls × 5min = 60 | **~2** (firebaseConfig مرة + createNewQr مرة) |
| Firestore reads لكل QR session | 0 (السيرفر بيجيب) | **~2-3** (snapshot أولي + 1-2 تحديث) |
| تأخير ظهور الفيديو بعد scan | حتى 5 ثوان | < 1 ثانية |
| QR docs مهجورة لكل user retry n مرات | n+1 | **1** |

**التكلفة بالأرقام (تقريبية):** Firestore reads = $0.06 لكل 100K read = ~$0.0000018 لكل QR session. حتى مع 10K QR/شهر = ~$0.018. **شبه صفر**.

---

## 7) سيناريوهات الفشل وكيف تتم معالجتها

| سيناريو | السلوك |
|---|---|
| `firebaseConfig` endpoint مش متاح وقت أول subscribe | `onError` يُستدعى → الديسكتوب يظهر retry. الـ retry يـ retry الـ fetch (لأن الـ promise اتمسحت). |
| Rules ترفض القراءة | `onSnapshot error` → `onError` → الديسكتوب يظهر retry. اتأكد إن rule `qrWindows` متنشرة. |
| الشبكة سقطت لحظيًا | Firebase SDK يعيد الاتصال تلقائيًا. لا UI error. |
| الشبكة سقطت تمامًا | Firebase SDK يحاول تلقائيًا. بعد عدة محاولات يطلق `onError` → retry. |
| الـ QR doc اتمسح من Firestore | `snap.exists()` = false → نتجاهل (لا نقفل). |
| المستخدم قفل التبويب | React unmount → `closeSubscription()` يُستدعى → Firebase listener يُلغى. |
| أكتر من ديسكتوب على نفس الجهاز | كل واحد يفتح اتصال منفصل. لا تداخل. |

---

## 8) ملخص الملفات المُعدَّلة

```
functions/src/index.js                                       ← +firebaseConfig export (-qrEvents SSE)
firestore.rules                                              ← +qrWindows read rule
custom_web_desktop_package/src/services/firebase.ts          ← rewrite (lazy bootstrap + subscribeToQrCode)
custom_web_desktop_package/src/services/api.ts               ← subscribeToQrUpdates uses Firestore (signature unchanged)
custom_web_desktop_package/src/context/AppContext.tsx        ← (unchanged behavior, comments updated)
custom_web_desktop_package/src/hooks/useQrCode.ts            ← (unchanged behavior, comments updated)
custom_web_desktop_package/src/index.ts                      ← +FirebaseWebConfig type export
```

لا تغييرات في:
```
muyassar_hassan_desktop_web/next.config.js                   (rewrite يخدم /api/firebaseConfig)
muyassar_hassan_desktop_web/src/                             (لا حاجة)
muyassar_hassan_desktop_v2/lib/main.dart                     (Flutter wrapper لا يحتاج تعديل)
packages_v2/shared_functions/src/services/codeService.js     (createNewQr/verifyQrCode/getQrData كما هي)
```
