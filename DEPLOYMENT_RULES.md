# 🚨 DEPLOYMENT RULES - READ BEFORE CHANGING CONFIGS 🚨

## Golden Rule: Keep It Simple

Firebase Hosting with Next.js is finicky. **The simpler your configuration, the better.**

---

## ❌ NEVER DO THESE THINGS

### 1. **NEVER add `force-dynamic` to root layout**

```typescript
// ❌ BAD - in app/layout.tsx
export const dynamic = 'force-dynamic';  // This breaks EVERYTHING!
export const dynamicParams = true;
```

**Why?** This disables ALL static optimization and breaks Firebase's build process.

**Result:** 403 errors on ALL pages when deployed.

---

### 2. **NEVER change firebase.json from object to array without testing**

```json
// ❌ BAD
{
  "hosting": [
    {
      "site": "kanvacommissions",
      ...
    }
  ]
}

// ✅ GOOD - Keep it as a simple object
{
  "hosting": {
    "site": "kanvacommissions",
    "source": ".",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "frameworksBackend": {
      "region": "us-central1"
    }
  }
}
```

---

### 3. **NEVER add complex webpack configurations without testing locally AND on Firebase**

```javascript
// ❌ BAD - in next.config.js
const nextConfig = {
  experimental: {
    outputFileTracingExcludes: { ... }
  },
  webpack: (config, { isServer }) => {
    // Complex webpack modifications
  }
}

// ✅ GOOD - Keep it simple
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true,
  },
}
```

---

### 4. **NEVER use `useSearchParams()` without Suspense**

```typescript
// ❌ BAD
export default function MyComponent() {
  const searchParams = useSearchParams();  // Breaks static generation!
  ...
}

// ✅ GOOD - Wrap in separate component with Suspense
function SearchParamsHandler() {
  const searchParams = useSearchParams();
  // Use params here
  return null;
}

export default function MyComponent() {
  return (
    <Suspense fallback={null}>
      <SearchParamsHandler />
    </Suspense>
  );
}
```

---

## ✅ DO THESE THINGS

### 1. **DO use `force-dynamic` ONLY in individual pages/routes that need it**

```typescript
// ✅ GOOD - in app/dashboard/page.tsx
'use client';

export const dynamic = 'force-dynamic';  // Only affects this page

export default function Dashboard() {
  // Page content
}
```

---

### 2. **DO add `force-dynamic` to API routes that use `request.url`**

```typescript
// ✅ GOOD - in app/api/my-route/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';  // Required for request.url

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Handle request
}
```

---

### 3. **DO test locally with `npm run build` before deploying**

```bash
# Always test the production build locally
npm run build

# If build fails, FIX IT before deploying
# If build succeeds, then deploy
firebase deploy --only hosting
```

---

### 4. **DO keep firebase.json as simple as possible**

```json
{
  "hosting": {
    "site": "kanvacommissions",
    "source": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "frameworksBackend": {
      "region": "us-central1"
    }
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log",
        "*.local"
      ],
      "predeploy": [
        "npm --prefix \"$RESOURCE_DIR\" run lint"
      ]
    }
  ]
}
```

**DO NOT ADD:**
- Headers configurations (unless absolutely necessary and tested)
- CSP policies (handle in middleware or headers.ts instead)
- Complex routing rules
- Redirects (use Next.js redirects instead)

---

## 🔍 When Things Break

If you get 403 errors or build failures after deployment:

### Step 1: Check git history
```bash
git log --oneline --since="1 week ago"
```

Look for recent changes to:
- `firebase.json`
- `next.config.js`
- `app/layout.tsx`

### Step 2: Compare with working commit
```bash
# This commit (Oct 14-15) was the last known working version
git show 50ada75e:firebase.json
git show 50ada75e:next.config.js
git show 50ada75e:app/layout.tsx
```

### Step 3: Revert if needed
```bash
git checkout 50ada75e -- firebase.json next.config.js app/layout.tsx
git commit -m "Revert to working configuration"
firebase deploy --only hosting
```

---

## 📋 Pre-Deployment Checklist

Before running `firebase deploy --only hosting`:

- [ ] Did you modify `firebase.json`? **If yes, double-check against this guide**
- [ ] Did you modify `next.config.js`? **If yes, test locally with `npm run build` first**
- [ ] Did you modify `app/layout.tsx`? **If yes, make sure no `force-dynamic` export exists**
- [ ] Did you add `useSearchParams()` anywhere? **If yes, wrap in Suspense**
- [ ] Did `npm run build` succeed locally? **If no, fix it before deploying**
- [ ] Did you test the app in dev mode? **If no, run `npm run dev` first**

---

## 🎯 Working Configuration Reference

### firebase.json (WORKING)
```json
{
  "hosting": {
    "site": "kanvacommissions",
    "source": ".",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "frameworksBackend": {
      "region": "us-central1"
    }
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [...]
}
```

### next.config.js (WORKING)
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
```

### app/layout.tsx (WORKING)
```typescript
// NO force-dynamic export here!
export const metadata: Metadata = {
  title: 'Kanva Commission Calculator',
  description: 'Sales commission tracking and calculation for Kanva Botanicals',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## 📚 Additional Resources

- [Next.js Static vs Dynamic Rendering](https://nextjs.org/docs/app/building-your-application/rendering/server-components#dynamic-rendering)
- [Firebase Hosting Next.js Docs](https://firebase.google.com/docs/hosting/frameworks/nextjs)
- [useSearchParams and Suspense](https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout)

---

## 🔑 Key Takeaways

1. **Simplicity wins** - Complex configs break Firebase deployments
2. **Test before deploy** - Always run `npm run build` locally first
3. **Force-dynamic is a scalpel, not a hammer** - Use it on individual pages/routes only
4. **Suspense is your friend** - Wrap `useSearchParams()` properly
5. **Document everything** - Future you will thank present you

---

**Last Updated**: October 24, 2025
**Last Known Working Commit**: `50ada75e` (October 14-15, 2025)
**Current Status**: ✅ **DEPLOYED AND WORKING**
**Live URL**: https://kanvacommissions.web.app
