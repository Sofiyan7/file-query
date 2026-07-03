"use client";

import * as React from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { X, ShieldAlert, Cpu, Key, Server, Save, LogOut, User, Trash2 } from "lucide-react";

export interface ProviderSettings {
  provider: "groq" | "gemini" | "ollama" | "huggingface";
  apiKey?: string;
  ollamaHost?: string;
  ollamaModel?: string;
  hfModel?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: ProviderSettings) => void;
}

export default function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [provider, setProvider] = React.useState<ProviderSettings["provider"]>("groq");
  const [apiKey, setApiKey] = React.useState("");
  const [ollamaHost, setOllamaHost] = React.useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = React.useState("llama3.1");
  const [hfModel, setHfModel] = React.useState("Qwen/Qwen2.5-72B-Instruct");

  // Load settings from localStorage on mount/open
  React.useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem("resolveai_settings");
        if (stored) {
          const parsed: ProviderSettings = JSON.parse(stored);
          setProvider(parsed.provider || "groq");
          setApiKey(parsed.apiKey || "");
          setOllamaHost(parsed.ollamaHost || "http://localhost:11434");
          setOllamaModel(parsed.ollamaModel || "llama3.1");
          setHfModel(parsed.hfModel || "Qwen/Qwen2.5-72B-Instruct");
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const settings: ProviderSettings = {
      provider,
      apiKey: apiKey.trim() || undefined,
      ollamaHost: provider === "ollama" ? ollamaHost.trim() : undefined,
      ollamaModel: provider === "ollama" ? ollamaModel.trim() : undefined,
      hfModel: provider === "huggingface" ? hfModel.trim() : undefined,
    };
    localStorage.setItem("resolveai_settings", JSON.stringify(settings));
    onSave(settings);
    onClose();
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    const confirmed = confirm(
      "WARNING: This will permanently DELETE your account, all uploaded documents, your chats, and your vector embeddings. This action CANNOT be undone. Are you sure?"
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`http://localhost:8000/api/users/${user.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Your account and all associated data have been permanently deleted.");
        onClose();
        await signOut();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete account.");
      }
    } catch (err) {
      console.error("Failed to delete account:", err);
      alert("An error occurred during account deletion.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Modal Card */}
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Settings className="size-5 text-indigo-400" />
            <span className="font-semibold text-neutral-200">Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5 font-sans text-sm">
          
          {/* 1. Account Section */}
          {isLoaded && user && (
            <div className="flex flex-col gap-3.5 p-4 bg-neutral-850 rounded-xl border border-neutral-750/70 animate-in fade-in duration-150">
              <div className="text-xxs font-bold text-neutral-450 uppercase tracking-wider">
                User Account
              </div>
              <div className="flex items-center gap-3">
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className="size-10 rounded-full border border-neutral-750 shadow-md select-none"
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-bold text-neutral-200 truncate">
                    {user.fullName || user.username || "ResolveAI User"}
                  </span>
                  <span className="text-xs text-neutral-450 truncate">
                    {user.primaryEmailAddress?.emailAddress}
                  </span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex gap-2 border-t border-neutral-800/60 pt-3.5 mt-1">
                <button
                  onClick={handleSignOut}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-neutral-300 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded-lg cursor-pointer transition duration-150"
                >
                  <LogOut className="size-3.5" />
                  Sign Out
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 rounded-lg cursor-pointer transition duration-150"
                >
                  <Trash2 className="size-3.5" />
                  Delete Account
                </button>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-neutral-800/80 my-1" />

          {/* 2. Provider Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              LLM Provider
            </label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as any);
                setApiKey(""); // Clear API Key input for fresh security typing
              }}
              className="bg-neutral-850 border border-neutral-750 text-neutral-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
            >
              <option value="groq" style={{ backgroundColor: "#1c1c1e", color: "#e5e5e5" }}>Groq (Llama 3.3 70B)</option>
              <option value="gemini" style={{ backgroundColor: "#1c1c1e", color: "#e5e5e5" }}>Google Gemini (Gemini 2.0 Flash)</option>
              <option value="ollama" style={{ backgroundColor: "#1c1c1e", color: "#e5e5e5" }}>Ollama (Local LLM)</option>
              <option value="huggingface" style={{ backgroundColor: "#1c1c1e", color: "#e5e5e5" }}>Hugging Face (Serverless Inference)</option>
            </select>
          </div>

          {/* Key Input Fields (Groq / Gemini / HF) */}
          {provider !== "ollama" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Key className="size-3.5 text-neutral-400" />
                API Key / Token
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  provider === "groq"
                    ? "Groq API Key (leave empty for server default)"
                    : provider === "gemini"
                    ? "Gemini API Key (leave empty for server default)"
                    : "Hugging Face Token (leave empty for server default)"
                }
                className="bg-neutral-850 border border-neutral-750 text-neutral-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition placeholder:text-neutral-550"
              />
              <span className="text-[10px] text-neutral-500">
                Your keys are stored locally in your browser's localStorage and never saved on the server.
              </span>
            </div>
          )}

          {/* Ollama Host URL Input */}
          {provider === "ollama" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Server className="size-3.5 text-neutral-400" />
                  Ollama Host URL
                </label>
                <input
                  type="text"
                  value={ollamaHost}
                  onChange={(e) => setOllamaHost(e.target.value)}
                  placeholder="e.g. http://localhost:11434"
                  className="bg-neutral-850 border border-neutral-750 text-neutral-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Cpu className="size-3.5 text-neutral-400" />
                  Ollama Model Name
                </label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="e.g. llama3.1, qwen2.5:14b"
                  className="bg-neutral-850 border border-neutral-750 text-neutral-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            </div>
          )}

          {/* Hugging Face Model Input */}
          {provider === "huggingface" && (
            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Cpu className="size-3.5 text-neutral-400" />
                Hugging Face Model Repo
              </label>
              <input
                type="text"
                value={hfModel}
                onChange={(e) => setHfModel(e.target.value)}
                placeholder="e.g. Qwen/Qwen2.5-72B-Instruct"
                className="bg-neutral-850 border border-neutral-750 text-neutral-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>
          )}

          {/* Empty Key Notice */}
          {provider !== "ollama" && !apiKey && (
            <div className="flex gap-2.5 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-indigo-400 animate-in fade-in duration-200">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>
                Using default keys. The server will use its own configured key for this provider.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-neutral-800 bg-neutral-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md transition cursor-pointer"
          >
            <Save className="size-3.5" />
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
}

// Inline fallback class definition if Settings icon import is not needed separately
function Settings({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
