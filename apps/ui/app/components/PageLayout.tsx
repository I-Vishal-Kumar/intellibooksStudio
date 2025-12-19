"use client";

import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "./Sidebar";

interface PageLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageLayout({ title, description, children, actions }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                {description && (
                  <p className="text-sm text-gray-500 mt-0.5">{description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {actions}
                <UserButton afterSignOutUrl="/sign-in" />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
