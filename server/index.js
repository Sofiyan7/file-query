import express from "express";
import cors from "cors";
import multer from "multer";
import { Queue } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
// Replace OpenAI imports with Google GenAI
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import "dotenv/config";
// If you need the raw SDK for other tasks
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = express();
app.use(cors());

// --- Setup remains mostly the same ---
const queue = new Queue("file-upload-queue", {
  connection: { host: "localhost", port: "6379" },
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});
const upload = multer({ storage: storage });

app.get("/", (req, res) => res.json({ status: "All Good!" }));

app.post("/upload/pdf", upload.single("pdf"), async (req, res) => {
  await queue.add(
    "file-ready",
    JSON.stringify({
      filename: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path,
    }),
  );
  return res.json({ message: "uploaded" });
});

// --- UPDATED CHAT ROUTE ---


app.get("/chat", async (req, res) => {
  const userQuery = req.query.message;

  try {
    // 1. SAME embeddings as worker (IMPORTANT)
    const embeddings = new HuggingFaceInferenceEmbeddings({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      apiKey: process.env.HUGGINGFACEHUB_API_KEY,
    });

    // 2. Connect to Qdrant
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: "http://localhost:6333",
        collectionName: "langchainjs-testing",
      },
    );

    // 3. Retrieve relevant docs
    const retriever = vectorStore.asRetriever({ k: 3 });
    const result = await retriever.invoke(userQuery);

    const contextText = result.map((doc) => doc.pageContent).join("\n---\n");

    // 4. System prompt
    const SYSTEM_PROMPT = `
You are a helpful AI Assistant.
Answer ONLY using the provided context.
If the answer is not in the context, say "I don't know".

Context:
${contextText}
`;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userQuery,
        },
      ],
    });

    return res.json({
      message: response.choices[0].message.content,
      docs: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

app.listen(8000, () => console.log(`Server started on PORT:8000`));
