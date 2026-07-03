"use client";

import * as React from "react";
import { SignIn, SignUp } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";

export default function AuthLanding() {
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");

  return (
    <div className="min-h-screen w-screen bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-violet-600/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Auth Container */}
      <div className="w-full max-w-md flex flex-col items-center z-10">
        {/* Logo/Branding */}
        <div className="flex items-center gap-2.5 mb-8 select-none">
          <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl shadow-lg shadow-indigo-500/5">
            <Sparkles className="size-6 text-indigo-400 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h1 className="bg-gradient-to-r from-violet-300 via-indigo-200 to-indigo-400 bg-clip-text text-transparent font-bold text-2xl tracking-tight leading-none">
              ResolveAI
            </h1>
            <span className="text-[10px] text-neutral-500 tracking-wider uppercase font-semibold mt-1">
              Isolated Contextual RAG
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-neutral-900 border border-neutral-800 p-1.5 rounded-xl mb-6 w-full shadow-inner shadow-black/20">
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition duration-150 cursor-pointer ${mode === "signin"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition duration-150 cursor-pointer ${mode === "signup"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850"
              }`}
          >
            Sign Up
          </button>
        </div>

        {/* Clerk Sign In / Sign Up widgets */}
        <div className="w-full bg-neutral-900/60 backdrop-blur-md border border-neutral-850 rounded-2xl p-6 shadow-2xl flex justify-center">
          {mode === "signin" ? (
            <SignIn
              routing="hash"
              appearance={{
                elements: {
                  cardBox: "bg-transparent shadow-none border-none",
                  headerTitle: "text-neutral-100 font-semibold",
                  headerSubtitle: "text-neutral-450 text-xs",
                  socialButtonsBlockButton: "bg-neutral-850 hover:bg-neutral-800 text-neutral-300 border-neutral-750",
                  socialButtonsBlockButtonText: "text-neutral-300 font-medium",
                  dividerRow: "text-neutral-500",
                  dividerLine: "bg-neutral-800",
                  formFieldLabel: "text-neutral-400 font-medium text-xs",
                  formFieldInput: "bg-neutral-850 border-neutral-750 text-neutral-200 focus:border-indigo-500 focus:ring-indigo-500",
                  formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition cursor-pointer",
                  footerActionLink: "text-indigo-400 hover:text-indigo-300",
                  identityPreviewText: "text-neutral-300",
                  identityPreviewEditButtonIcon: "text-neutral-400",
                  footer: "hidden",
                },
                layout: {
                  unsafe_disableDevelopmentModeWarnings: true,
                }
              }}
            />
          ) : (
            <SignUp
              routing="hash"
              appearance={{
                elements: {
                  cardBox: "bg-transparent shadow-none border-none",
                  headerTitle: "text-neutral-100 font-semibold",
                  headerSubtitle: "text-neutral-450 text-xs",
                  socialButtonsBlockButton: "bg-neutral-850 hover:bg-neutral-800 text-neutral-300 border-neutral-750",
                  socialButtonsBlockButtonText: "text-neutral-300 font-medium",
                  dividerRow: "text-neutral-500",
                  dividerLine: "bg-neutral-800",
                  formFieldLabel: "text-neutral-400 font-medium text-xs",
                  formFieldInput: "bg-neutral-850 border-neutral-750 text-neutral-200 focus:border-indigo-500 focus:ring-indigo-500",
                  formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition cursor-pointer",
                  footerActionLink: "text-indigo-400 hover:text-indigo-300",
                  footer: "hidden",
                },
                layout: {
                  unsafe_disableDevelopmentModeWarnings: true,
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
