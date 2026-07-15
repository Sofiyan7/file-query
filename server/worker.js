import { Worker } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import "dotenv/config";
import fs from "fs";
import path from "path";

const REGISTRY_FILE = path.join("uploads", "registry.json");

function readRegistry() {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) {
      return [];
    }
    const data = fs.readFileSync(REGISTRY_FILE, "utf-8");
    return JSON.parse(data || "[]");
  } catch (err) {
    console.error("Error reading registry in worker:", err);
    return [];
  }
}

function writeRegistry(data) {
  try {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing registry in worker:", err);
  }
}

function updateDocStatus(docId, filename, status) {
  try {
    const registry = readRegistry();
    let index = -1;
    if (docId) {
      index = registry.findIndex((d) => d.id === docId);
    } else {
      index = registry.findIndex((d) => d.filename === filename && d.status === "processing");
    }

    if (index !== -1) {
      registry[index].status = status;
      writeRegistry(registry);
      console.log(`Updated document status to ${status} for ${filename}`);
    } else {
      console.warn(`Document not found in registry: ${filename} (id: ${docId})`);
    }
  } catch (err) {
    console.error("Failed to update status in registry:", err);
  }
}

const redisConnection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || "6379"),
};
if (process.env.REDIS_PASSWORD) {
  redisConnection.password = process.env.REDIS_PASSWORD;
}
if (process.env.REDIS_TLS === "true" || (process.env.REDIS_HOST && process.env.REDIS_HOST.includes("upstash"))) {
  redisConnection.tls = {};
}

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    console.log(`Processing Job ID: ${job.id}`);
    const data = JSON.parse(job.data);
    console.log(`Processing File: ${data.filename}, ID: ${data.id}`);

    try {
      // 1. Load the File
      const ext = path.extname(data.filename).toLowerCase();
      let rawDocs = [];

      if (ext === ".pdf") {
        const loader = new PDFLoader(data.path);
        rawDocs = await loader.load();
        console.log(`Loaded ${rawDocs.length} pages from PDF`);
      } else if (ext === ".docx") {
        const loader = new DocxLoader(data.path);
        rawDocs = await loader.load();
        console.log(`Loaded ${rawDocs.length} sections from DOCX`);
      } else if (ext === ".doc") {
        const loader = new DocxLoader(data.path, { type: "doc" });
        rawDocs = await loader.load();
        console.log(`Loaded ${rawDocs.length} sections from DOC`);
      } else {
        throw new Error(`Unsupported file extension: ${ext}`);
      }

      // Ensure proper metadata format
      rawDocs.forEach((doc) => {
        doc.metadata.filename = data.filename;
        doc.metadata.userId = data.userId || "anonymous";
        if (!doc.metadata.loc) {
          doc.metadata.loc = {};
        }
        if (doc.metadata.loc.pageNumber === undefined) {
          doc.metadata.loc.pageNumber = 1;
        }
      });

      // 2. Chunk the Document
      const splitter = new CharacterTextSplitter({
        separator: "\n",
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const docs = await splitter.splitDocuments(rawDocs);
      console.log(`Split into ${docs.length} chunks`);

      // 3. Initialize HuggingFace Embeddings
      const embeddings = new HuggingFaceInferenceEmbeddings({
        model: "sentence-transformers/all-MiniLM-L6-v2",
        apiKey: process.env.HUGGINGFACEHUB_API_KEY,
      });
      console.log("Initialized HuggingFace Inference Embeddings");

      // 4. Store in Qdrant
      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          url: process.env.QDRANT_URL || "http://localhost:6333",
          collectionName: "langchainjs-testing",
        },
      );

      console.log("Initialized Qdrant Vector Store");

      // Verify and create payload indexes (critical for Qdrant Cloud)
      try {
        await vectorStore.client.createPayloadIndex("langchainjs-testing", {
          field_name: "metadata.userId",
          field_schema: "keyword",
        });
        await vectorStore.client.createPayloadIndex("langchainjs-testing", {
          field_name: "metadata.filename",
          field_schema: "keyword",
        });
        console.log("[Worker] Qdrant payload indexes verified/created.");
      } catch (idxErr) {
        // Ignore if index already exists
      }

      await vectorStore.addDocuments(docs);
      console.log(`Successfully added ${docs.length} chunks to Qdrant`);

      // 5. Update status
      updateDocStatus(data.id, data.filename, "indexed");
    } catch (error) {
      console.error("Error processing document:", error);
      updateDocStatus(data.id, data.filename, "failed");
      throw error;
    }
  },
  {
    concurrency: 10,
    connection: redisConnection,
  },
);
