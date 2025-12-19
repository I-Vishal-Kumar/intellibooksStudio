# Audio Insight UI

Next.js 16 frontend for the Audio Insight platform with Clerk authentication.

## Features

- Audio file upload with drag & drop
- Real-time processing status
- Chat interface for AI interactions
- Processing options (transcribe, translate, summarize, etc.)
- Results panel with collapsible sections
- Clerk authentication (sign-in, sign-up, user management)

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Clerk account for authentication

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Clerk keys from [Clerk Dashboard](https://dashboard.clerk.com/last-active?path=api-keys):

```env
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
CLERK_SECRET_KEY=YOUR_SECRET_KEY
```

### 3. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Project Structure

```
app/
├── components/          # React components
│   ├── AudioUploader.tsx
│   ├── ChatInterface.tsx
│   ├── ProcessingOptions.tsx
│   └── ResultsPanel.tsx
├── lib/                 # Utility functions
│   └── utils.ts
├── sign-in/             # Clerk sign-in page
├── sign-up/             # Clerk sign-up page
├── globals.css          # Global styles
├── layout.tsx           # Root layout with ClerkProvider
└── page.tsx             # Home page
proxy.ts                 # Clerk authentication middleware (Next.js 16+)
```

## Clerk Configuration

The app uses Clerk for authentication with the latest `@clerk/nextjs` SDK (v6.x).

### Key Files

**proxy.ts** - Clerk middleware for route protection:
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**app/layout.tsx** - Root layout with ClerkProvider:
```typescript
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <header>
            <SignedOut>
              <SignInButton />
              <SignUpButton />
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

### Route Configuration

- **Public routes**: `/`, `/sign-in`, `/sign-up`, `/api/health`
- **Protected routes**: All other routes require authentication

### Customizing Authentication

Edit `proxy.ts` to modify which routes are public:

```typescript
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",
  "/your-public-route(.*)",  // Add more public routes here
]);
```

## Available Scripts

```bash
# Development
pnpm dev

# Build
pnpm build

# Start production server
pnpm start

# Lint
pnpm lint
```

## API Integration

The UI connects to these backend services:

| Service | Default URL | Purpose |
|---------|-------------|---------|
| Agent Service | http://localhost:8001 | Audio processing |
| RAG Service | http://localhost:8002 | Knowledge base queries |

Update `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_RAG_API_URL` in `.env.local` to change these.

## Styling

- Tailwind CSS 4 for styling
- Custom CSS variables for theming
- Geist font family

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Next.js Quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart)
- [Tailwind CSS](https://tailwindcss.com/docs)
