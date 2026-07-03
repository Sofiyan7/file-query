import express from "express";
import cors from "cors";
import multer from "multer";
import { Queue } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import "dotenv/config";
import Groq from "groq-sdk";
import fs from "fs";
import path from "path";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());

// Registry setup
const REGISTRY_FILE = path.join("uploads", "registry.json");
const CHATS_FILE = path.join("uploads", "chats.json");

function readChats() {
  try {
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads", { recursive: true });
    }
    if (!fs.existsSync(CHATS_FILE)) {
      fs.writeFileSync(CHATS_FILE, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(CHATS_FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch (err) {
    console.error("Error reading chats:", err);
    return [];
  }
}

function writeChats(data) {
  try {
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads", { recursive: true });
    }
    fs.writeFileSync(CHATS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing chats:", err);
  }
}

function readRegistry() {
  try {
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads", { recursive: true });
    }
    if (!fs.existsSync(REGISTRY_FILE)) {
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(REGISTRY_FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch (err) {
    console.error("Error reading registry:", err);
    return [];
  }
}

function writeRegistry(data) {
  try {
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads", { recursive: true });
    }
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing registry:", err);
  }
}
async function ensurePayloadIndexes(vectorStore) {
  try {
    await vectorStore.client.createPayloadIndex("langchainjs-testing", {
      field_name: "metadata.userId",
      field_schema: "keyword",
    });
    await vectorStore.client.createPayloadIndex("langchainjs-testing", {
      field_name: "metadata.filename",
      field_schema: "keyword",
    });
    console.log("[Qdrant] Payload indexes verified/created.");
  } catch (err) {
    // Already exists or creation ignored
  }
}

console.log({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  hasPassword: !!process.env.REDIS_PASSWORD,
});
const queue = new Queue("file-upload-queue", {
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    tls: {},
  },
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".pdf" || ext === ".docx" || ext === ".doc") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, and DOC files are allowed"));
    }
  },
});

app.get("/", (req, res) => res.json({ status: "All Good!" }));

// Main file upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const userId = req.body.userId || "anonymous";
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const registry = readRegistry();
    const docId = Date.now().toString();
    const ext = path.extname(req.file.originalname).toLowerCase().replace(".", "");

    const newDoc = {
      id: docId,
      filename: req.file.originalname,
      path: req.file.path,
      status: "processing",
      type: ext,
      uploadedAt: new Date().toISOString(),
      userId: userId,
    };

    registry.push(newDoc);
    writeRegistry(registry);

    await queue.add(
      "file-ready",
      JSON.stringify({
        id: docId,
        filename: req.file.originalname,
        destination: req.file.destination,
        path: req.file.path,
        userId: userId,
      }),
    );

    return res.json(newDoc);
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: error.message || "Failed to upload file" });
  }
});

// Legacy/Compatibility upload route
app.post("/upload/pdf", upload.single("pdf"), async (req, res) => {
  try {
    const userId = req.body.userId || "anonymous";
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const registry = readRegistry();
    const docId = Date.now().toString();
    const ext = path.extname(req.file.originalname).toLowerCase().replace(".", "");

    const newDoc = {
      id: docId,
      filename: req.file.originalname,
      path: req.file.path,
      status: "processing",
      type: ext,
      uploadedAt: new Date().toISOString(),
      userId: userId,
    };

    registry.push(newDoc);
    writeRegistry(registry);

    await queue.add(
      "file-ready",
      JSON.stringify({
        id: docId,
        filename: req.file.originalname,
        destination: req.file.destination,
        path: req.file.path,
        userId: userId,
      }),
    );

    return res.json({ message: "uploaded", doc: newDoc });
  } catch (error) {
    console.error("Upload compatibility error:", error);
    return res.status(500).json({ error: "Failed to upload file" });
  }
});

// Get all uploaded files (filtered by user)
app.get("/documents", (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId query param" });
    }
    const registry = readRegistry();
    const userDocs = registry.filter((d) => d.userId === userId);
    return res.json(userDocs);
  } catch (error) {
    return res.status(500).json({ error: "Failed to retrieve documents" });
  }
});

// Delete a document
app.delete("/documents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId query param" });
    }

    const registry = readRegistry();
    const docIndex = registry.findIndex((d) => d.id === id && d.userId === userId);
    if (docIndex === -1) {
      return res.status(404).json({ error: "Document not found" });
    }

    const doc = registry[docIndex];

    // Delete the file from local storage if it exists
    if (fs.existsSync(doc.path)) {
      try {
        fs.unlinkSync(doc.path);
      } catch (err) {
        console.error(`Failed to delete local file ${doc.path}:`, err);
      }
    }

    // Delete points from Qdrant vector store
    try {
      const embeddings = new HuggingFaceInferenceEmbeddings({
        model: "sentence-transformers/all-MiniLM-L6-v2",
        apiKey: process.env.HUGGINGFACEHUB_API_KEY,
      });
      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          url: process.env.QDRANT_URL || "http://localhost:6333",
          collectionName: "langchainjs-testing",
        },
      );

      await ensurePayloadIndexes(vectorStore);

      // Delete points matching filename and userId
      await vectorStore.client.delete("langchainjs-testing", {
        filter: {
          must: [
            {
              key: "metadata.filename",
              match: {
                value: doc.filename,
              },
            },
            {
              key: "metadata.userId",
              match: {
                value: userId,
              },
            },
          ],
        },
      });
      console.log(`Deleted points for ${doc.filename} (user: ${userId}) from Qdrant`);
    } catch (qdrantError) {
      console.error("Failed to delete points from Qdrant:", qdrantError);
    }

    // Remove from registry
    registry.splice(docIndex, 1);
    writeRegistry(registry);

    return res.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    return res.status(500).json({ error: "Failed to delete document" });
  }
});

// --- UPDATED CHAT ROUTE ---


// Unified LLM dispatcher supporting Groq, Gemini, Ollama, and Hugging Face
async function getLLMResponse({ providerSettings, messages, temperature = 0.7 }) {
  const provider = providerSettings?.provider || "groq";
  const userApiKey = providerSettings?.apiKey;

  if (provider === "groq") {
    const apiKey = userApiKey || process.env.GROQ_API_KEY;
    const client = new Groq({ apiKey });
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature,
    });
    return response.choices[0].message.content;
  }

  if (provider === "gemini") {
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);

    // Translate standard system/user/assistant message roles to Gemini role/parts format
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find((m) => m.role === "system")?.content;
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction,
    });

    const result = await model.generateContent({
      contents,
      generationConfig: { temperature },
    });
    return result.response.text();
  }

  if (provider === "ollama") {
    const host = providerSettings?.ollamaHost || "http://localhost:11434";
    const modelName = providerSettings?.ollamaModel || "llama3.1";

    const res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        options: { temperature },
        stream: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama API error: ${errText}`);
    }

    const data = await res.json();
    return data.message.content;
  }

  if (provider === "huggingface") {
    const apiKey = userApiKey || process.env.HUGGINGFACEHUB_API_KEY;
    const { HfInference } = await import("@huggingface/inference");
    const hf = new HfInference(apiKey);

    const modelName = providerSettings?.hfModel || "Qwen/Qwen2.5-72B-Instruct";

    const response = await hf.chatCompletion({
      model: modelName,
      messages: messages,
      temperature: temperature,
      max_tokens: 1024,
    });

    return response.choices[0].message.content;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

// RAG Query Condensation Helper
async function condenseQuery(chatHistory, newQuery, providerSettings) {
  if (!chatHistory || chatHistory.length === 0) {
    return newQuery;
  }

  // Format the last 6 messages to keep context window tight
  const formattedHistory = chatHistory
    .slice(-6)
    .map((m) => `[${m.role === "user" ? "User" : "Assistant"}]: ${m.content}`)
    .join("\n");

  const CONDENSE_SYSTEM_PROMPT = `
You are an expert search query generator.
Given a conversation history and a follow-up question, rewrite the follow-up question into a standalone, search-optimized query.
The standalone query MUST contain all necessary details from the history so it can be used to search documents.
Do NOT answer the question. Only output the rewritten search query.

Example 1:
History:
[User]: is ollama there in resume
[Assistant]: Yes, Ollama is mentioned in the resume under experience.
Follow-up: how is it used
Rewrite: how is ollama used in the resume

Example 2:
History:
[User]: what is nodejs?
[Assistant]: Node.js is an open-source JS runtime.
Follow-up: explain http
Rewrite: explain http
`;

  try {
    const messages = [
      {
        role: "system",
        content: CONDENSE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `History:\n${formattedHistory}\nFollow-up: ${newQuery}\nRewrite:`,
      },
    ];

    const rewritten = await getLLMResponse({
      providerSettings,
      messages,
      temperature: 0.1,
    });

    const result = rewritten.trim();
    console.log(`[Query Condensation] Original: "${newQuery}" -> Rewritten: "${result}"`);
    return result;
  } catch (err) {
    console.error("Failed to condense query, using original query:", err);
    return newQuery;
  }
}

app.post("/chat", async (req, res) => {
  const userQuery = req.body.message;
  let chatId = req.body.chatId;
  const selectedFiles = req.body.selectedFiles; // Array of filenames
  const userId = req.body.userId;
  const providerSettings = req.body.providerSettings;

  console.log(`[Chat API] Received query: "${userQuery}" for ChatID: ${chatId || "New Chat"} (User: ${userId || "anonymous"})`);
  console.log(`[Chat API] Selected context files:`, selectedFiles || "None");

  try {
    if (!userQuery) {
      return res.status(400).json({ error: "Missing message field" });
    }
    if (!userId) {
      return res.status(400).json({ error: "Missing userId parameter" });
    }

    // 1. Get or create chat session
    const chats = readChats();
    let chat = null;

    if (chatId) {
      chat = chats.find((c) => c.id === chatId && c.userId === userId);
    }

    if (!chat) {
      chatId = Date.now().toString();
      chat = {
        id: chatId,
        userId: userId,
        title: userQuery.slice(0, 35) + (userQuery.length > 35 ? "..." : ""),
        messages: [],
        createdAt: new Date().toISOString(),
      };
      chats.push(chat);
    }

    const chatHistory = chat.messages || [];

    // Handle case when no files are selected for context
    if (!selectedFiles || selectedFiles.length === 0) {
      if (chatHistory.length === 0) {
        // If there's no chat history yet, we can't answer anything, so return the default warning
        const responseMsg = "No context documents are selected. Please toggle at least one document on in the sidebar to provide context.";
        chat.messages.push({ role: "user", content: userQuery });
        chat.messages.push({
          role: "assistant",
          content: responseMsg,
          documents: [],
        });
        writeChats(chats);

        return res.json({
          message: responseMsg,
          docs: [],
          chatId: chat.id,
          title: chat.title,
        });
      } else {
        // If we have chat history, let the LLM try to answer using ONLY the chat history
        console.log(`[Chat API] No documents selected, attempting to answer using chat history for User ID: ${userId}`);

        const formattedHistory = chatHistory
          .slice(-6)
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n");

        const HISTORY_ONLY_SYSTEM_PROMPT = `
You are a helpful AI Assistant.
Answer the user's question using ONLY facts previously mentioned in the conversation history below.
If the answer cannot be determined or answered using the conversation history, you MUST reply exactly with:
"No context documents are selected. Please toggle at least one document on in the sidebar to provide context."

Conversation History:
${formattedHistory}
`;

        const completionMessages = [
          { role: "system", content: HISTORY_ONLY_SYSTEM_PROMPT },
          { role: "user", content: userQuery }
        ];

        const assistantResponse = await getLLMResponse({
          providerSettings,
          messages: completionMessages,
          temperature: 0.1,
        });

        chat.messages.push({ role: "user", content: userQuery });
        chat.messages.push({
          role: "assistant",
          content: assistantResponse,
          documents: [],
        });
        writeChats(chats);

        return res.json({
          message: assistantResponse,
          docs: [],
          chatId: chat.id,
          title: chat.title,
        });
      }
    }

    // 2. SAME embeddings as worker (IMPORTANT)
    const embeddings = new HuggingFaceInferenceEmbeddings({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      apiKey: process.env.HUGGINGFACEHUB_API_KEY,
    });

    // 3. Connect to Qdrant
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: process.env.QDRANT_URL || "http://localhost:6333",
        collectionName: "langchainjs-testing",
      },
    );

    await ensurePayloadIndexes(vectorStore);

    // 4. History-Aware Retrieval (Rewrite the query based on past history and filter by active documents)
    const condensedQuery = await condenseQuery(chatHistory, userQuery, providerSettings);

    // Construct Qdrant filter condition to match only selected files and the specific user's ID
    const filter = {
      must: [
        {
          key: "metadata.userId",
          match: {
            value: userId,
          },
        },
        {
          key: "metadata.filename",
          match: {
            any: selectedFiles,
          },
        },
      ],
    };

    const retriever = vectorStore.asRetriever({
      k: 3,
      filter: filter
    });

    const result = await retriever.invoke(condensedQuery);

    console.log(`[Chat API] Qdrant retrieved ${result?.length || 0} document chunks using query "${condensedQuery}".`);

    // Handle no documents found gracefully by returning warning early but still saving history
    if (!result || result.length === 0) {
      const responseMsg = "I don't know the answer because no relevant context was found in the uploaded documents. Please ensure you have uploaded documents containing this information and that they are indexed.";

      chat.messages.push({ role: "user", content: userQuery });
      chat.messages.push({
        role: "assistant",
        content: responseMsg,
        documents: [],
      });
      writeChats(chats);

      return res.json({
        message: responseMsg,
        docs: [],
        chatId: chat.id,
        title: chat.title,
      });
    }

    function getCleanFilename(doc) {
      let filename = doc.metadata?.filename;
      if (!filename && doc.metadata?.source) {
        const basename = doc.metadata.source.split(/[/\\]/).pop() || "";
        const match = basename.match(/^\d+-(.*)/);
        filename = match ? match[1] : basename;
      }
      return filename || "Document";
    }

    result.forEach((doc, index) => {
      console.log(`  - Chunk ${index + 1}: filename=${getCleanFilename(doc)}, page=${doc.metadata?.loc?.pageNumber || "N/A"}`);
    });

    const contextText = result
      .map((doc) => {
        const filename = getCleanFilename(doc);
        const pageNum = doc.metadata?.loc?.pageNumber || 1;
        return `[Source Document: ${filename}, Page/Section: ${pageNum}]\n${doc.pageContent}`;
      })
      .join("\n\n---\n\n");

    // 5. System prompt
    const SYSTEM_PROMPT = `
You are a helpful AI Assistant.
Answer ONLY using the provided context.
If the answer is not in the context, say "I don't know".

Context:
${contextText}
`;

    // Compile message stream: system context + previous 6 turns + current user query
    const completionMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...chatHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userQuery }
    ];

    const assistantResponse = await getLLMResponse({
      providerSettings,
      messages: completionMessages,
      temperature: 0.7,
    });

    // 6. Save messages to history
    chat.messages.push({ role: "user", content: userQuery });
    chat.messages.push({
      role: "assistant",
      content: assistantResponse,
      documents: result,
    });
    writeChats(chats);

    console.log(`[Chat API] Sending response with ${result?.length || 0} docs for ChatID: ${chat.id}`);
    return res.json({
      message: assistantResponse,
      docs: result,
      chatId: chat.id,
      title: chat.title,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// Legacy support for GET /chat (redirects to POST flow with no chatId)
app.get("/chat", async (req, res) => {
  const userQuery = req.query.message;
  console.log(`[Chat Legacy GET] Query: ${userQuery}`);
  return res.redirect(307, "/chat");
});

// GET /chats - List all chats summary for user
app.get("/chats", (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId query param" });
    }
    const chats = readChats();
    const userChats = chats.filter((c) => c.userId === userId);
    const summary = userChats.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
    }));
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ error: "Failed to load chats" });
  }
});

// GET /chats/:id - Get full chat details (ownership enforced)
app.get("/chats/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId query param" });
    }
    const chats = readChats();
    const chat = chats.find((c) => c.id === id && c.userId === userId);
    if (!chat) {
      return res.status(404).json({ error: "Chat session not found" });
    }
    return res.json(chat);
  } catch (error) {
    return res.status(500).json({ error: "Failed to retrieve chat details" });
  }
});

// DELETE /chats/:id - Delete a chat session (ownership enforced)
app.delete("/chats/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId query param" });
    }
    const chats = readChats();
    const index = chats.findIndex((c) => c.id === id && c.userId === userId);
    if (index === -1) {
      return res.status(404).json({ error: "Chat session not found" });
    }
    chats.splice(index, 1);
    writeChats(chats);
    return res.json({ message: "Chat session deleted" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete chat session" });
  }
});

// DELETE /api/users/:userId - Delete user account and all user data (registry, chats, vectors, Clerk)
app.delete("/api/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`[Delete Account] Starting full deletion for user: ${userId}`);

    // 1. Read files and delete them locally and from Qdrant
    const registry = readRegistry();
    const userDocs = registry.filter((d) => d.userId === userId);

    // Connect to Qdrant
    let qdrantCleared = false;
    try {
      const embeddings = new HuggingFaceInferenceEmbeddings({
        model: "sentence-transformers/all-MiniLM-L6-v2",
        apiKey: process.env.HUGGINGFACEHUB_API_KEY,
      });
      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          url: process.env.QDRANT_URL || "http://localhost:6333",
          collectionName: "langchainjs-testing",
        },
      );

      await ensurePayloadIndexes(vectorStore);

      // Delete user vectors from Qdrant
      await vectorStore.client.delete("langchainjs-testing", {
        filter: {
          must: [
            {
              key: "metadata.userId",
              match: {
                value: userId,
              },
            },
          ],
        },
      });
      qdrantCleared = true;
      console.log(`[Delete Account] Cleared vectors in Qdrant for user: ${userId}`);
    } catch (qdrantError) {
      console.error("[Delete Account] Failed to clear Qdrant vectors:", qdrantError);
    }

    // Delete local files
    userDocs.forEach((doc) => {
      if (fs.existsSync(doc.path)) {
        try {
          fs.unlinkSync(doc.path);
          console.log(`[Delete Account] Deleted local file: ${doc.path}`);
        } catch (err) {
          console.error(`[Delete Account] Failed to delete local file ${doc.path}:`, err);
        }
      }
    });

    // Remove documents from registry
    const updatedRegistry = registry.filter((d) => d.userId !== userId);
    writeRegistry(updatedRegistry);

    // 2. Delete chat histories
    const chats = readChats();
    const updatedChats = chats.filter((c) => c.userId !== userId);
    writeChats(updatedChats);
    console.log(`[Delete Account] Deleted chat history from chats.json for user: ${userId}`);

    // 3. Delete user account from Clerk
    if (process.env.CLERK_SECRET_KEY) {
      console.log(`[Delete Account] Requesting Clerk deletion for userId: ${userId}`);
      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!clerkRes.ok) {
        const errText = await clerkRes.text();
        console.error(`[Delete Account] Failed to delete user from Clerk: ${errText}`);
        return res.status(clerkRes.status).json({ error: `Clerk deletion failed: ${errText}` });
      }
      console.log(`[Delete Account] Successfully deleted user ${userId} from Clerk.`);
    } else {
      console.warn("[Delete Account] CLERK_SECRET_KEY environment variable is not defined, skipping Clerk deletion.");
    }

    return res.json({ message: "User account and all associated data deleted successfully." });
  } catch (error) {
    console.error("[Delete Account] Error during full user account deletion:", error);
    return res.status(500).json({ error: error.message || "Failed to delete user account." });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server started on PORT:${PORT}`));
