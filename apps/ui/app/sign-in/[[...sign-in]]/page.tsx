import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600 mt-2">Sign in to Audio Insight</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-xl border border-gray-200",
              headerTitle: "text-gray-900",
              headerSubtitle: "text-gray-600",
              formButtonPrimary:
                "bg-blue-600 hover:bg-blue-700 text-white",
              footerActionLink: "text-blue-600 hover:text-blue-700",
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
        />
      </div>
    </div>
  );
}
