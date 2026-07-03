"use client";

import * as React from "react";
import FileUploadComponent from "./components/file-upload";
import ChatComponent from "./components/chat";
import SettingsModal, { ProviderSettings } from "./components/settings-modal";
import { useUser, UserButton } from "@clerk/nextjs";
import { FileText, Trash2, Loader2, XCircle, Plus, Sparkles, MessageSquare, Settings } from "lucide-react";
import { API_BASE } from "@/lib/api";

interface IDocument {
  id: string;
  filename: string;
  path: string;
  status: "processing" | "indexed" | "failed";
  type: string;
  uploadedAt: string;
}

interface IChatSummary {
  id: string;
  title: string;
  createdAt: string;
}

export default function Home() {
  const { user, isLoaded } = useUser();

  const [documents, setDocuments] = React.useState<IDocument[]>([]);
  const [chats, setChats] = React.useState<IChatSummary[]>([]);
  const [selectedFilenames, setSelectedFilenames] = React.useState<string[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = React.useState<boolean>(true);
  const [isLoadingChats, setIsLoadingChats] = React.useState<boolean>(true);
  const [currentChatId, setCurrentChatId] = React.useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState<boolean>(false);
  const [providerSettings, setProviderSettings] = React.useState<ProviderSettings>({ provider: "groq" });
  const hasInitializedSelectionRef = React.useRef(false);

  // Load settings from localStorage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("resolveai_settings");
      if (stored) {
        setProviderSettings(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to load settings in app:", err);
    }
  }, []);

  const fetchDocuments = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/documents?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);

        // Auto-select files that are successfully indexed if no selection is made yet
        setSelectedFilenames((prev) => {
          const indexedFiles = data.filter((d: IDocument) => d.status === "indexed").map((d: IDocument) => d.filename);
          if (!hasInitializedSelectionRef.current) {
            hasInitializedSelectionRef.current = true;
            return indexedFiles;
          }
          // Find files that are newly indexed (changed from processing/failed to indexed)
          const previouslyIndexed = documents.filter((d: IDocument) => d.status === "indexed").map((d: IDocument) => d.filename);
          const newlyIndexed = indexedFiles.filter((name: string) => !previouslyIndexed.includes(name));

          // Remove deleted files and append newly indexed files
          const cleaned = prev.filter((name: string) => indexedFiles.includes(name));
          return Array.from(new Set([...cleaned, ...newlyIndexed]));
        });
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [user?.id, documents]);

  const fetchChats = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/chats?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        // Sort chats by creation date descending
        data.sort((a: IChatSummary, b: IChatSummary) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setChats(data);
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    } finally {
      setIsLoadingChats(false);
    }
  }, [user?.id]);

  React.useEffect(() => {
    if (!user?.id) return;
    fetchDocuments();
    fetchChats();
    // Poll updates every 5 seconds
    const interval = setInterval(() => {
      fetchDocuments();
      fetchChats();
    }, 5000);
    return () => clearInterval(interval);
  }, [user?.id, fetchDocuments, fetchChats]);

  const handleToggleFileSelection = (filename: string) => {
    setSelectedFilenames((prev) =>
      prev.includes(filename)
        ? prev.filter((name) => name !== filename)
        : [...prev, filename]
    );
  };

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    if (!confirm("Are you sure you want to delete this document? This will remove its indexed context.")) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/documents/${id}?userId=${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      } else {
        alert("Failed to delete document.");
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Error deleting document.");
    }
  };

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    if (!confirm("Are you sure you want to delete this conversation?")) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/chats/${id}?userId=${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setChats((prev) => prev.filter((chat) => chat.id !== id));
        if (currentChatId === id) {
          setCurrentChatId(null);
        }
      } else {
        alert("Failed to delete chat session.");
      }
    } catch (err) {
      console.error("Error deleting chat:", err);
      alert("Error deleting chat.");
    }
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
  };

  const getActiveChatTitle = () => {
    if (!currentChatId) return "New Conversation";
    const active = chats.find(c => c.id === currentChatId);
    return active ? active.title : "RAG Assistant";
  };

  // Enforce loading states
  if (!isLoaded || !user) {
    return (
      <div className="h-screen w-screen bg-neutral-950 flex flex-col items-center justify-center gap-2">
        <Loader2 className="size-8 animate-spin text-indigo-400" />
        <span className="text-xs text-neutral-500 font-sans">Connecting to ResolveAI...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-80 border-r border-neutral-800 bg-neutral-900 flex flex-col justify-between shrink-0">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-indigo-400 animate-pulse" />
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent font-bold text-lg tracking-tight">
                ResolveAI
              </span>
            </div>
          </div>

          {/* New Chat Button */}
          <div className="p-3">
            <button
              onClick={handleNewChat}
              suppressHydrationWarning
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-neutral-850 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 hover:border-neutral-600 transition duration-150 text-sm font-medium cursor-pointer"
            >
              <Plus className="size-4" />
              New Chat
            </button>
          </div>

          {/* Layout Content (Scrollable sidebar chunks) */}
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            {/* Chat History Section */}
            <div className="flex flex-col px-3 py-2 shrink-0">
              <div className="text-xxs font-semibold text-neutral-450 uppercase tracking-wider mb-2 px-1">
                Conversations
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto pr-0.5">
                {isLoadingChats ? (
                  <div className="flex items-center justify-center py-4 text-xs text-neutral-500 gap-1.5">
                    <Loader2 className="size-3 animate-spin text-indigo-500" />
                    Loading chats...
                  </div>
                ) : chats.length === 0 ? (
                  <div className="text-center py-4 text-xs text-neutral-500 italic px-2 border border-neutral-850 rounded-lg">
                    No recent chats.
                  </div>
                ) : (
                  chats.map((chat) => {
                    const isActive = chat.id === currentChatId;
                    return (
                      <div
                        key={chat.id}
                        onClick={() => setCurrentChatId(chat.id)}
                        className={`flex items-center justify-between p-2 rounded-lg transition group cursor-pointer ${isActive
                          ? "bg-indigo-600/15 border border-indigo-500/40 text-neutral-100"
                          : "bg-transparent border border-transparent hover:bg-neutral-850 text-neutral-400 hover:text-neutral-200"
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MessageSquare className={`size-3.5 shrink-0 ${isActive ? "text-indigo-400" : "text-neutral-500"}`} />
                          <span className="text-xs font-medium truncate pr-1">
                            {chat.title}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteChat(chat.id, e)}
                          className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 opacity-0 group-hover:opacity-100 focus:opacity-100 transition duration-150 cursor-pointer"
                          title="Delete chat"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* divider */}
            <div className="border-t border-neutral-855 my-2 mx-4" />

            {/* Document Section */}
            <div className="flex flex-col flex-1 px-3 py-1 min-h-[180px]">
              <div className="text-xxs font-semibold text-neutral-450 uppercase tracking-wider mb-2 px-1">
                Knowledge Base
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                {isLoadingDocs ? (
                  <div className="flex items-center justify-center py-6 text-sm text-neutral-500 gap-2">
                    <Loader2 className="size-4 animate-spin text-indigo-500" />
                    Loading documents...
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-6 text-xs text-neutral-500 px-4 border border-dashed border-neutral-850 rounded-lg">
                    No files uploaded yet.
                  </div>
                ) : (
                  documents.map((doc) => {
                    const isIndexed = doc.status === "indexed";
                    const isSelected = selectedFilenames.includes(doc.filename);

                    return (
                      <div
                        key={doc.id}
                        onClick={() => isIndexed && handleToggleFileSelection(doc.filename)}
                        className={`flex items-center justify-between p-2 rounded-lg border transition group ${isIndexed
                          ? isSelected
                            ? "bg-neutral-800/80 border-indigo-500/50 hover:border-indigo-500/70"
                            : "bg-neutral-900/40 border-neutral-855 hover:bg-neutral-850/70 text-neutral-400 hover:text-neutral-300"
                          : "bg-neutral-900/20 border-neutral-900 text-neutral-500"
                          } ${isIndexed ? "cursor-pointer" : "cursor-not-allowed"}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Custom Checkbox Toggle for Indexed Files */}
                          {isIndexed ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleFileSelection(doc.filename)}
                              onClick={(e) => e.stopPropagation()} // Prevent trigger double toggle
                              className="size-3.5 rounded border-neutral-700 bg-neutral-800 text-indigo-600 focus:ring-indigo-500 accent-indigo-500 cursor-pointer"
                            />
                          ) : (
                            <div className="size-3.5 flex items-center justify-center shrink-0">
                              {doc.status === "processing" ? (
                                <Loader2 className="size-3 animate-spin text-indigo-400" />
                              ) : (
                                <XCircle className="size-3.5 text-rose-400" />
                              )}
                            </div>
                          )}

                          <FileText className={`size-3.5 shrink-0 ${isSelected ? "text-indigo-400" : "text-neutral-500"}`} />
                          <div className="flex flex-col min-w-0">
                            <span className={`text-xs font-medium truncate pr-1 ${isSelected ? "text-neutral-100 font-semibold" : "text-neutral-300"}`}>
                              {doc.filename}
                            </span>
                            <span className="text-[10px] text-neutral-550 capitalize">
                              {doc.type} • {new Date(doc.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Delete Action */}
                          <button
                            onClick={(e) => handleDeleteDocument(doc.id, e)}
                            className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 opacity-0 group-hover:opacity-100 focus:opacity-100 transition duration-150 cursor-pointer"
                            title="Delete document"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="px-4 py-2.5 border-t border-neutral-850 bg-neutral-900/30 flex items-center justify-between shrink-0">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition duration-150 cursor-pointer border border-neutral-800 bg-neutral-900/40 w-full justify-center"
          >
            <Settings className="size-3.5 text-indigo-400" />
            <span>Settings</span>
          </button>
        </div>

        {/* Sidebar Footer: Upload Area */}
        <div className="p-3 border-t border-neutral-805 bg-neutral-900/50">
          <FileUploadComponent userId={user.id} onUploadComplete={fetchDocuments} />
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col h-full bg-neutral-950 relative">
        <header className="h-14 border-b border-neutral-800 flex items-center justify-between px-6 bg-neutral-950/80 backdrop-blur-md z-10 shrink-0">
          <h2 className="text-sm font-medium text-neutral-300 truncate max-w-lg">
            {getActiveChatTitle()}
          </h2>
          {/* Settings handles profile & sign out */}
          <div className="size-6" />
        </header>

        <div className="flex-1 min-h-0">
          <ChatComponent
            chatId={currentChatId}
            selectedFiles={selectedFilenames}
            userId={user.id}
            providerSettings={providerSettings}
            onChatCreated={(newId) => {
              setCurrentChatId(newId);
              fetchChats();
            }}
          />
        </div>
      </main>

      {/* Settings Modal Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={setProviderSettings}
      />
    </div>
  );
}
