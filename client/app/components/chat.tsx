"use client";

import * as React from "react";
import { ProviderSettings } from "./settings-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, FileText, Sparkles, User, Info, X, HelpCircle, Layers, Loader2 } from "lucide-react";

interface Doc {
  pageContent?: string;
  metadata?: {
    filename?: string;
    loc?: {
      pageNumber?: number;
    };
    source?: string;
  };
}

interface IMessage {
  role: "assistant" | "user";
  content?: string;
  documents?: Doc[];
}

interface Citation {
  filename: string;
  pageNumber: number;
  chunks: Doc[];
}

interface ChatComponentProps {
  chatId: string | null;
  selectedFiles: string[];
  userId: string;
  providerSettings: ProviderSettings;
  onChatCreated?: (newChatId: string) => void;
}

const ChatComponent: React.FC<ChatComponentProps> = ({ chatId, selectedFiles, userId, providerSettings, onChatCreated }) => {
  const [message, setMessage] = React.useState<string>("");
  const [messages, setMessages] = React.useState<IMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isHistoryLoading, setIsHistoryLoading] = React.useState<boolean>(false);
  const [selectedCitation, setSelectedCitation] = React.useState<Citation | null>(null);
  const [activeMessageDocs, setActiveMessageDocs] = React.useState<Doc[]>([]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Load chat messages when chatId changes
  React.useEffect(() => {
    if (chatId) {
      const loadChatHistory = async () => {
        setIsHistoryLoading(true);
        try {
          const res = await fetch(`http://localhost:8000/chats/${chatId}?userId=${userId}`);
          if (res.ok) {
            const data = await res.json();
            setMessages(data.messages || []);
          }
        } catch (err) {
          console.error("Failed to load chat history:", err);
        } finally {
          setIsHistoryLoading(false);
        }
      };
      loadChatHistory();
    } else {
      setMessages([]);
    }
  }, [chatId, userId]);

  // Auto scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendChatMessage = async () => {
    if (!message.trim() || isLoading || isHistoryLoading) return;

    const userMessage = message;
    setMessage("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          chatId: chatId || undefined, // pass current chatId if available
          selectedFiles: selectedFiles, // pass active context file names
          userId: userId, // pass authenticated user id
          providerSettings: providerSettings, // pass LLM provider settings
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Append response
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data?.message,
            documents: data?.docs || [],
          },
        ]);

        // Callback if new chat was initialized
        if (!chatId && data?.chatId && onChatCreated) {
          onChatCreated(data.chatId);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I encountered an error communicating with the server.",
          },
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to connect to the server. Please verify the backend is running.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getCleanFilename = (doc: Doc): string => {
    let filename = doc.metadata?.filename;
    if (!filename && doc.metadata?.source) {
      const basename = doc.metadata.source.split(/[/\\]/).pop() || "";
      const match = basename.match(/^\d+-(.*)/);
      filename = match ? match[1] : basename;
    }
    return filename || "Document";
  };

  const getCitations = (docs: Doc[] = []): Citation[] => {
    const citationsMap: { [key: string]: Citation } = {};

    docs.forEach((doc) => {
      const filename = getCleanFilename(doc);
      const pageNumber = doc.metadata?.loc?.pageNumber ?? 1;
      const key = `${filename}-${pageNumber}`;

      if (!citationsMap[key]) {
        citationsMap[key] = {
          filename,
          pageNumber,
          chunks: [],
        };
      }
      citationsMap[key].chunks.push(doc);
    });

    return Object.values(citationsMap);
  };

  const openGroundTruthModal = (citation: Citation, allDocs: Doc[]) => {
    setSelectedCitation(citation);
    setActiveMessageDocs(allDocs);
  };

  // Custom regex-based renderer to structure LLM text beautifully
  const renderMessageContent = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, index) => {
      if (line.startsWith("### ")) {
        return (
          <h4 key={index} className="text-sm font-semibold text-neutral-200 mt-3 mb-1">
            {line.slice(4)}
          </h4>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3 key={index} className="text-base font-semibold text-neutral-250 mt-4 mb-2">
            {line.slice(3)}
          </h3>
        );
      }
      if (line.startsWith("# ")) {
        return (
          <h2 key={index} className="text-lg font-bold text-neutral-100 mt-5 mb-2">
            {line.slice(2)}
          </h2>
        );
      }

      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <li key={index} className="ml-4 list-disc text-neutral-300 my-0.5 leading-relaxed">
            {parseInlineMarkup(line.slice(2))}
          </li>
        );
      }

      const numListMatch = line.match(/^(\d+)\.\s(.*)/);
      if (numListMatch) {
        return (
          <li key={index} className="ml-4 list-decimal text-neutral-300 my-0.5 leading-relaxed">
            {parseInlineMarkup(numListMatch[2])}
          </li>
        );
      }

      return line.trim() === "" ? (
        <div key={index} className="h-2" />
      ) : (
        <p key={index} className="text-neutral-350 leading-relaxed my-1.5 text-sm">
          {parseInlineMarkup(line)}
        </p>
      );
    });
  };

  const parseInlineMarkup = (text: string) => {
    const parts = [];
    let currentText = text;
    let key = 0;

    while (currentText.length > 0) {
      const boldIndex = currentText.indexOf("**");
      const codeIndex = currentText.indexOf("`");

      if (boldIndex === -1 && codeIndex === -1) {
        parts.push(currentText);
        break;
      }

      if (boldIndex !== -1 && (codeIndex === -1 || boldIndex < codeIndex)) {
        if (boldIndex > 0) {
          parts.push(currentText.substring(0, boldIndex));
        }
        const nextBold = currentText.indexOf("**", boldIndex + 2);
        if (nextBold !== -1) {
          parts.push(
            <strong key={key++} className="font-semibold text-neutral-150">
              {currentText.substring(boldIndex + 2, nextBold)}
            </strong>
          );
          currentText = currentText.substring(nextBold + 2);
        } else {
          parts.push(currentText.substring(boldIndex));
          break;
        }
      } else {
        if (codeIndex > 0) {
          parts.push(currentText.substring(0, codeIndex));
        }
        const nextCode = currentText.indexOf("`", codeIndex + 1);
        if (nextCode !== -1) {
          parts.push(
            <code key={key++} className="bg-neutral-800 text-indigo-300 px-1 py-0.5 rounded text-xs font-mono">
              {currentText.substring(codeIndex + 1, nextCode)}
            </code>
          );
          currentText = currentText.substring(nextCode + 1);
        } else {
          parts.push(currentText.substring(codeIndex));
          break;
        }
      }
    }

    return parts;
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 relative">
      {/* Scrollable messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isHistoryLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Loader2 className="size-8 animate-spin text-indigo-400 mb-2" />
            <p className="text-sm text-neutral-500">Loading conversation history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="p-4 rounded-full bg-neutral-900 border border-neutral-800 text-indigo-400 mb-4 animate-pulse">
              <Sparkles className="size-8" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-200 mb-1.5">Contextual AI Assistant</h3>
            <p className="text-sm text-neutral-500 leading-relaxed font-sans">
              Upload PDF or Word documents to the Knowledge Base on the sidebar, then ask queries. The assistant will answer using context extracted from your files.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const citations = !isUser && msg.documents ? getCitations(msg.documents) : [];

            return (
              <div
                key={index}
                className={`flex gap-4 max-w-3xl mx-auto ${isUser ? "justify-end" : "justify-start"}`}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <div className="size-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-indigo-400 shrink-0 select-none">
                    <Sparkles className="size-4" />
                  </div>
                )}

                {/* Message Block */}
                <div className={`flex flex-col min-w-0 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                  <div
                    className={`p-3.5 rounded-2xl ${
                      isUser
                        ? "bg-indigo-600/90 text-white rounded-tr-none shadow-md shadow-indigo-600/10 text-sm"
                        : "bg-neutral-900 border border-neutral-850 text-neutral-300 rounded-tl-none font-sans"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      renderMessageContent(msg.content || "")
                    )}
                  </div>

                  {/* Message Citations (Assistant Only) */}
                  {!isUser && citations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 ml-1">
                      <span className="text-xxs text-neutral-500 flex items-center gap-1 select-none">
                        <Info className="size-3" /> Grounded context:
                      </span>
                      {citations.map((citation, citIdx) => (
                        <div key={citIdx} className="relative group select-none">
                          <button
                            onClick={() => openGroundTruthModal(citation, msg.documents || [])}
                            className="flex items-center gap-1 py-0.5 px-2 rounded-md bg-neutral-900 hover:bg-neutral-800 text-xxs text-indigo-400 hover:text-indigo-300 border border-neutral-800 hover:border-neutral-700 transition cursor-pointer"
                          >
                            <FileText className="size-2.5" />
                            {citation.filename} (Pg {citation.pageNumber})
                          </button>

                          {/* Hover Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col bg-neutral-900 border border-neutral-800 rounded-md p-2 shadow-2xl z-20 min-w-[180px] pointer-events-none text-left">
                            <span className="text-xxs text-neutral-500 font-semibold uppercase tracking-wider mb-0.5">
                              Source Info
                            </span>
                            <span className="text-xs text-neutral-200 font-medium truncate">
                              {citation.filename}
                            </span>
                            <span className="text-xxs text-neutral-450 mt-0.5">
                              Page/Section: {citation.pageNumber}
                            </span>
                            <div className="text-[10px] text-indigo-400/80 mt-1 flex items-center gap-0.5 font-semibold">
                              Click to view raw ground truth
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {isUser && (
                  <div className="size-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 shrink-0 select-none">
                    <User className="size-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex gap-4 max-w-3xl mx-auto justify-start">
            <div className="size-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-indigo-400 shrink-0 select-none animate-pulse">
              <Sparkles className="size-4 animate-spin" />
            </div>
            <div className="bg-neutral-900 border border-neutral-855 p-4 rounded-2xl rounded-tl-none flex items-center gap-1.5 text-sm text-neutral-400">
              <span className="size-1.5 bg-neutral-550 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="size-1.5 bg-neutral-550 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="size-1.5 bg-neutral-550 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input controls container */}
      <div className="p-4 border-t border-neutral-800 bg-neutral-955/80 backdrop-blur-md shrink-0">
        <div className="max-w-3xl mx-auto relative flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendChatMessage();
              }
            }}
            disabled={isLoading || isHistoryLoading}
            suppressHydrationWarning
            placeholder="Ask a query or operation regarding your uploaded documents..."
            className="flex-1 bg-neutral-900 border-neutral-800 text-neutral-200 placeholder-neutral-500 rounded-xl py-5 focus-visible:ring-indigo-500 focus-visible:ring-2 focus-visible:border-transparent text-sm h-11"
          />
          <Button
            onClick={handleSendChatMessage}
            disabled={!message.trim() || isLoading || isHistoryLoading}
            className="rounded-xl px-4 bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 cursor-pointer h-11"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-[10px] text-neutral-600 text-center mt-2 select-none">
          Contextual conversation history. Chat messages and grounding are retained locally.
        </p>
      </div>

      {/* Ground Truth Modal (Detailed Context View) */}
      {selectedCitation && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-950 text-indigo-400">
                  <Layers className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-100 flex items-center gap-1.5">
                    Ground Truth Reality
                  </h3>
                  <p className="text-xs text-neutral-450 mt-0.5 truncate max-w-[500px]">
                    Source: <strong className="text-neutral-300">{selectedCitation.filename}</strong> (Page/Section {selectedCitation.pageNumber})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCitation(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Part 1: Primary Matching Chunks from this page */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-neutral-450 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <HelpCircle className="size-3.5" /> Retrieved Chunks from this Page ({selectedCitation.chunks.length})
                </h4>
                <div className="space-y-3">
                  {selectedCitation.chunks.map((chunk, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-neutral-950 border border-neutral-850 text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap font-sans relative"
                    >
                      {chunk.pageContent}
                    </div>
                  ))}
                </div>
              </div>

              {/* Part 2: All Context Chunks used for response */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-neutral-455 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <Layers className="size-3.5" /> Complete Ground Truth Context (All {activeMessageDocs.length} Chunks)
                </h4>
                <div className="space-y-3">
                  {activeMessageDocs.map((doc, idx) => {
                    const isCurrent =
                      getCleanFilename(doc) === selectedCitation.filename &&
                      (doc.metadata?.loc?.pageNumber ?? 1) === selectedCitation.pageNumber;

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border text-xs transition ${
                          isCurrent
                            ? "bg-indigo-950/20 border-indigo-900/60"
                            : "bg-neutral-950/40 border-neutral-850/80"
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold mb-2 select-none">
                          <span className={`${isCurrent ? "text-indigo-400" : "text-neutral-400"} truncate max-w-[400px]`}>
                            Chunk {idx + 1}: {getCleanFilename(doc)}
                          </span>
                          <span className={`${isCurrent ? "text-indigo-400" : "text-neutral-500"}`}>
                            Page/Section {doc.metadata?.loc?.pageNumber ?? 1} {isCurrent && "(Current)"}
                          </span>
                        </div>
                        <div className="text-neutral-350 leading-relaxed font-sans">{doc.pageContent}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-900 flex justify-end gap-2 shrink-0">
              <Button
                onClick={() => setSelectedCitation(null)}
                className="bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700 cursor-pointer text-xs py-1.5 h-8 rounded-lg"
              >
                Close Ground Truth
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatComponent;
