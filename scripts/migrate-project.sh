#!/bin/bash

# Script to migrate a teacher project to use the shared package

PROJECT_NAME=$1
API_BASE_URL=$2
ADMIN_NAME=$3
VERSION=${4:-"1.0.0"}

if [ -z "$PROJECT_NAME" ] || [ -z "$API_BASE_URL" ] || [ -z "$ADMIN_NAME" ]; then
    echo "Usage: ./migrate-project.sh <project_name> <api_base_url> <admin_name> [version]"
    echo "Example: ./migrate-project.sh tamer_shaaban https://us-central1-tamer-shaaban.cloudfunctions.net tamer-shaaban 1.0.12"
    exit 1
fi

PROJECT_DIR="/Users/saif/StudioProjects/teacher_folder/${PROJECT_NAME}/${PROJECT_NAME}_web_desktop"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "Error: Project directory not found: $PROJECT_DIR"
    exit 1
fi

echo "🚀 Migrating project: $PROJECT_NAME"
echo "   API URL: $API_BASE_URL"
echo "   Admin Name: $ADMIN_NAME"
echo "   Version: $VERSION"
echo ""

cd "$PROJECT_DIR"

# Step 1: Install the shared package
echo "📦 Installing @nexwave/custom_web_desktop_package..."
npm install @nexwave/custom_web_desktop_package

# Step 2: Backup and remove old files
echo "🗑️  Removing old shared files..."
rm -rf src/components/common
rm -rf src/components/login  
rm -rf src/components/video
rm -rf src/context
rm -rf src/hooks
rm -rf src/models
rm -rf src/services
rm -rf src/utils
rm -rf src/types

# Step 3: Create config directory if not exists
mkdir -p src/config

# Step 4: Create teacher-config.ts
echo "📝 Creating teacher-config.ts..."
cat > src/config/teacher-config.ts << EOF
import { TeacherAppConfig } from '@nexwave/custom_web_desktop_package';

export const teacherConfig: TeacherAppConfig = {
  apiBaseUrl: '${API_BASE_URL}',
  nameAdmin: '${ADMIN_NAME}',
  primaryColor: '#6B7280',
  watchedOffline: false,
  usingApi: true,
  version: '${VERSION}',
};
EOF

# Step 5: Update layout.tsx
echo "📝 Updating layout.tsx..."
cat > src/app/layout.tsx << 'EOF'
import { AppProvider } from '@nexwave/custom_web_desktop_package';
import { teacherConfig } from '../config/teacher-config';
import './globals.css';

export const metadata = {
  title: 'Teacher App',
  description: 'Desktop teacher application',
};

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
EOF

# Step 6: Update page.tsx
echo "📝 Updating page.tsx..."
cat > src/app/page.tsx << EOF
'use client';

import { LoginController } from '@nexwave/custom_web_desktop_package';
import logo from '../../assets/icons/logo.png';
import background from '../../assets/images/BG.jpg';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <LoginController 
        version="${VERSION}"
        logo={logo}
        background={background}
      />
    </main>
  );
}
EOF

# Step 7: Update video page
echo "📝 Updating video/page.tsx..."
mkdir -p src/app/video
cat > src/app/video/page.tsx << 'EOF'
'use client';

import { VideoView } from '@nexwave/custom_web_desktop_package';

export default function VideoPage() {
  return <VideoView />;
}
EOF

# Step 8: Update next.config.js
echo "📝 Updating next.config.js..."
cat > next.config.js << EOF
/** @type {import('next').NextConfig} */

const API_BASE_URL = '${API_BASE_URL}';

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
          destination: \`\${API_BASE_URL}/:path*\`,
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
          destination: \`\${API_BASE_URL}/:path*\`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
EOF

echo ""
echo "✅ Migration complete for $PROJECT_NAME!"
echo ""
echo "⚠️  Please verify:"
echo "   1. Assets exist at: assets/icons/logo.png and assets/images/BG.jpg"
echo "   2. Run 'npm run dev' to test locally"
echo "   3. Commit and push to deploy to Vercel"
