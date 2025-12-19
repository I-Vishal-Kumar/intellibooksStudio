import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication (only sign-up and sign-in)
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  
  // Protect all routes except public ones
  if (!isPublicRoute(request)) {
    if (!userId) {
      // Redirect to sign-up if not authenticated
      const signUpUrl = new URL("/sign-up", request.url);
      return NextResponse.redirect(signUpUrl);
    }
    // User is authenticated, allow access
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

