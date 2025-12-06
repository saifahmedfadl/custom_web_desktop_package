# @nexwave/custom_web_desktop_package

حزمة مشتركة لتطبيقات المعلمين على الويب والديسكتوب مع مصادقة QR Code وتشغيل الفيديو.

## التثبيت

```bash
npm install @nexwave/custom_web_desktop_package
```

## الاستخدام

### 1. إعداد الـ Configuration

أنشئ ملف `config/teacher-config.ts` في مشروعك:

```typescript
import { TeacherAppConfig } from '@nexwave/custom_web_desktop_package';

export const teacherConfig: TeacherAppConfig = {
  apiBaseUrl: 'https://us-central1-YOUR-PROJECT.cloudfunctions.net',
  nameAdmin: 'your-project-name',
  primaryColor: '#6B7280',
  watchedOffline: false,
  usingApi: true,
  version: '1.0.0',
};
```

### 2. إعداد الـ Provider

في ملف `app/layout.tsx`:

```tsx
import { AppProvider } from '@nexwave/custom_web_desktop_package';
import { teacherConfig } from '../config/teacher-config';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AppProvider config={teacherConfig}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
```

### 3. استخدام الـ Components

```tsx
import { LoginController, VideoView } from '@nexwave/custom_web_desktop_package';
import logo from '../assets/icons/logo.png';
import background from '../assets/images/BG.jpg';

// في صفحة تسجيل الدخول
export default function LoginPage() {
  return (
    <LoginController 
      version="1.0.0"
      logo={logo}
      background={background}
    />
  );
}

// في صفحة الفيديو
export default function VideoPage() {
  return <VideoView />;
}
```

### 4. إعداد next.config.js

```javascript
const API_BASE_URL = 'https://us-central1-YOUR-PROJECT.cloudfunctions.net';

const nextConfig = {
  reactStrictMode: true,
  env: {
    API_BASE_URL: API_BASE_URL,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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

## الهيكل

```
src/
├── components/     # React components (Login, Video, Common)
├── config/         # Configuration types and context
├── context/        # App context for state management
├── hooks/          # Custom React hooks
├── models/         # TypeScript interfaces
├── services/       # API and Firebase services
└── utils/          # Utility functions
```

## التخصيص

كل مشروع يحتاج فقط إلى:
1. **ملف الإعدادات** (`teacher-config.ts`) - يحتوي على الـ API URL والإعدادات الخاصة
2. **الـ Assets** - الشعار والخلفية في مجلد `assets/`
3. **ملف `next.config.js`** - مع الـ API URL الصحيح

## النشر

### على npm (عام)
```bash
npm publish --access public
```

### على GitHub Packages (خاص)
```bash
npm publish --registry=https://npm.pkg.github.com
```

## الترخيص

MIT
