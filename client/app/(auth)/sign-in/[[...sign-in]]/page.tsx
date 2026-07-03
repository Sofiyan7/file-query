import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full bg-[#09090b] flex items-center justify-center relative overflow-hidden px-4">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      
      <div className="w-full max-w-md z-10 flex flex-col items-center">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-3">
            <Sparkles className="size-6 text-indigo-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-white">ResolveAI</h2>
          <p className="text-xs text-gray-400 mt-1">Isolated Contextual RAG</p>
        </div>

        <SignIn
          appearance={{
            variables: {
              colorPrimary: "#6366f1", // Indigo 500
              colorBackground: "#18181b", // Zinc 900
              colorText: "#f4f4f5", // Zinc 100
              colorTextSecondary: "#a1a1aa", // Zinc 400
              colorInputBackground: "#09090b", // Zinc 950
              colorInputText: "#ffffff",
              colorBorder: "#27272a", // Zinc 800
            },
            elements: {
              card: "!shadow-2xl !border !border-zinc-800 !bg-[#18181b]/90 !backdrop-blur-xl !rounded-2xl !w-full !p-6",
              headerTitle: "!text-2xl !font-bold !tracking-tight !text-white !text-center",
              headerSubtitle: "!text-zinc-400 !text-sm !mt-1 !text-center",
              socialButtonsBlockButton: "!bg-[#27272a] hover:!bg-[#3f3f46] !text-white !border !border-[#3f3f46] transition-all duration-200 !py-2.5",
              socialButtonsBlockButtonText: "!text-white !font-medium",
              formButtonPrimary: "!bg-indigo-600 hover:!bg-indigo-500 !text-white transition-all duration-200 !border-none !shadow-lg !shadow-indigo-600/20 !py-2.5 !font-medium",
              formFieldLabel: "!text-zinc-300 !font-medium !text-xs !uppercase !tracking-wider !mb-1",
              formFieldInput: "!bg-[#09090b] !border !border-[#27272a] focus:!border-indigo-500 focus:!ring-1 focus:!ring-indigo-500 !rounded-lg !text-white !py-2 !px-3 transition-all !placeholder-zinc-500",
              dividerLine: "!bg-[#27272a]",
              dividerText: "!text-zinc-500 !text-xs !uppercase !tracking-wider",
              formFieldInputShowPasswordButton: "!text-zinc-400 hover:!text-white",
              badge: "!bg-indigo-600/20 !text-indigo-300 !border !border-indigo-500/30 !font-semibold !text-[10px] !py-0.5 !px-1.5 !rounded-full",
              footer: "!hidden", // Completely hide the footer containing Clerk branding and Dev mode banner
              main: "!gap-4",
            },
            layout: {
              unsafe_disableDevelopmentModeWarnings: true, // Disable development mode warnings
            }
          }}
        />

        {/* Custom Clean Footer */}
        <p className="text-sm text-zinc-400 mt-6 text-center">
          Don't have an account?{" "}
          <Link href="/sign-up" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
