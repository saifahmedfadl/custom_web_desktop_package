# دليل تحويل المشاريع لاستخدام الحزمة المشتركة

## الخطوة 1: نشر الحزمة على npm

### الخيار أ: npm (عام)
```bash
cd /Users/saif/StudioProjects/teacher_folder/custom_web_desktop_package
npm login
npm publish --access public
```

### الخيار ب: GitHub Packages (خاص)
1. أنشئ Personal Access Token من GitHub مع صلاحية `write:packages`
2. سجل دخول:
```bash
npm login --registry=https://npm.pkg.github.com
```
3. انشر:
```bash
npm publish --registry=https://npm.pkg.github.com
```

---

## الخطوة 2: تحويل مشروع موجود (مثال: tamer_shaaban)

### 2.1 تثبيت الحزمة
```bash
cd /Users/saif/StudioProjects/teacher_folder/tamer_shaaban/tamer_shaaban_web_desktop
npm install @nexwave/custom_web_desktop_package
```

### 2.2 حذف الملفات المكررة
احذف المجلدات التالية (لأنها الآن في الحزمة):
```bash
rm -rf src/components/common
rm -rf src/components/login
rm -rf src/components/video
rm -rf src/context
rm -rf src/hooks
rm -rf src/models
rm -rf src/services
rm -rf src/utils
rm -rf src/types
```

### 2.3 إنشاء ملف الإعدادات الخاص بالمشروع
أنشئ ملف `src/config/teacher-config.ts`:

```typescript
import { TeacherAppConfig } from '@nexwave/custom_web_desktop_package';

export const teacherConfig: TeacherAppConfig = {
  apiBaseUrl: 'https://us-central1-tamer-shaaban.cloudfunctions.net',
  nameAdmin: 'tamer-shaaban',
  primaryColor: '#6B7280',
  watchedOffline: false,
  usingApi: true,
  version: '1.0.12',
};
```

### 2.4 تحديث `src/app/layout.tsx`
```tsx
import { AppProvider } from '@nexwave/custom_web_desktop_package';
import { teacherConfig } from '../config/teacher-config';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AppProvider config={teacherConfig}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
```

### 2.5 تحديث `src/app/page.tsx`
```tsx
'use client';

import { LoginController } from '@nexwave/custom_web_desktop_package';
import logo from '../../assets/icons/logo.png';
import background from '../../assets/images/BG.jpg';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <LoginController 
        version="1.0.12"
        logo={logo}
        background={background}
      />
    </main>
  );
}
```

### 2.6 تحديث `src/app/video/page.tsx`
```tsx
'use client';

import { VideoView } from '@nexwave/custom_web_desktop_package';

export default function VideoPage() {
  return <VideoView />;
}
```

### 2.7 تحديث `next.config.js`
```javascript
const API_BASE_URL = 'https://us-central1-tamer-shaaban.cloudfunctions.net';

const nextConfig = {
  reactStrictMode: true,
  env: {
    API_BASE_URL: API_BASE_URL,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['@nexwave/custom_web_desktop_package'],
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${API_BASE_URL}/:path*`,
          has: [
            {
              type: 'header',
              key: 'x-invoke-proxy',
              value: '1',
            },
          ],
        },
        {
          source: '/api/:path*',
          destination: `${API_BASE_URL}/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
```

---

## الخطوة 3: هيكل المشروع بعد التحويل

```
tamer_shaaban_web_desktop/
├── assets/
│   ├── icons/
│   │   └── logo.png          # شعار خاص بالمشروع
│   └── images/
│       └── BG.jpg            # خلفية خاصة بالمشروع
├── src/
│   ├── app/
│   │   ├── layout.tsx        # يستخدم AppProvider من الحزمة
│   │   ├── page.tsx          # يستخدم LoginController من الحزمة
│   │   ├── video/
│   │   │   └── page.tsx      # يستخدم VideoView من الحزمة
│   │   └── globals.css
│   └── config/
│       └── teacher-config.ts # إعدادات خاصة بالمشروع
├── public/
├── next.config.js            # API URL خاص بالمشروع
├── package.json
└── tsconfig.json
```

---

## الخطوة 4: تحديث الحزمة في المستقبل

### عند تعديل الكود المشترك:
1. عدّل الكود في `/Users/saif/StudioProjects/teacher_folder/custom_web_desktop_package`
2. زِد رقم الإصدار في `package.json`
3. ابنِ وانشر:
```bash
cd /Users/saif/StudioProjects/teacher_folder/custom_web_desktop_package
npm run build
npm publish
```

### في كل مشروع:
```bash
npm update @nexwave/custom_web_desktop_package
```

---

## سكريبت تحويل تلقائي

يمكنك استخدام هذا السكريبت لتحويل مشروع:

```bash
#!/bin/bash

PROJECT_NAME=$1
API_BASE_URL=$2
ADMIN_NAME=$3

if [ -z "$PROJECT_NAME" ] || [ -z "$API_BASE_URL" ] || [ -z "$ADMIN_NAME" ]; then
    echo "Usage: ./migrate.sh <project_name> <api_base_url> <admin_name>"
    echo "Example: ./migrate.sh tamer_shaaban https://us-central1-tamer-shaaban.cloudfunctions.net tamer-shaaban"
    exit 1
fi

PROJECT_DIR="/Users/saif/StudioProjects/teacher_folder/${PROJECT_NAME}/${PROJECT_NAME}_web_desktop"

cd "$PROJECT_DIR"

# Install package
npm install @nexwave/custom_web_desktop_package

# Remove old files
rm -rf src/components/common
rm -rf src/components/login  
rm -rf src/components/video
rm -rf src/context
rm -rf src/hooks
rm -rf src/models
rm -rf src/services
rm -rf src/utils
rm -rf src/types

echo "Migration complete for $PROJECT_NAME"
echo "Please update the following files manually:"
echo "  - src/config/teacher-config.ts"
echo "  - src/app/layout.tsx"
echo "  - src/app/page.tsx"
echo "  - src/app/video/page.tsx"
echo "  - next.config.js"
```

---

## ملاحظات مهمة

1. **الـ Assets**: كل مشروع يحتفظ بالشعار والخلفية الخاصة به في مجلد `assets/`

2. **الـ API URL**: يُحدد في ملفين:
   - `src/config/teacher-config.ts`
   - `next.config.js`

3. **Vercel**: سيعمل تلقائياً لأن npm يسحب الحزمة عند البناء

4. **التحديثات**: عند تحديث الحزمة، كل المشاريع تستفيد من التحديث بمجرد تشغيل `npm update`
