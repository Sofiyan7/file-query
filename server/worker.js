import { Worker } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import "dotenv/config";

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    console.log(`Processing Job ID: ${job.id}`);
    const data = JSON.parse(job.data);
    console.log(`Processing File: ${data.filename}`);

    // 1. Load the PDF
    const loader = new PDFLoader(data.path);
    const rawDocs = await loader.load();
    console.log(`Loaded ${rawDocs.length} chunks from PDF`);

    // 2. Chunk the PDF
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
    });
    console.log("Initialized HuggingFace Inference Embeddings");

    // 4. Store in Qdrant
    try {
      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          url: "http://localhost:6333",
          collectionName: "langchainjs-testing",
        },
      );

      console.log("Initialized Qdrant Vector Store");

      await vectorStore.addDocuments(docs);

      console.log(`Successfully added ${docs.length} chunks to Qdrant`);
    } catch (error) {
      console.error("Error adding documents to Qdrant:", error);
      throw error;
    }
  },
  {
    concurrency: 10,
    connection: {
      host: "localhost",
      port: 6379,
    },
  },
);
