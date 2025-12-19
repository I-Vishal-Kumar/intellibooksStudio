"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        router.push("/dashboard");
      } else {
        router.push("/sign-in");
      }
    }
  }, [isLoaded, isSignedIn, router]);

  // Show loading while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
          <span className="text-xl font-bold text-white">IB</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Intellibooks Studio</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  );
}
