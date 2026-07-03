import { QdrantVectorStore } from "@langchain/qdrant";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import "dotenv/config";

async function main() {
  const embeddings = new HuggingFaceInferenceEmbeddings({
    model: "sentence-transformers/all-MiniLM-L6-v2",
    apiKey: process.env.HUGGINGFACEHUB_API_KEY,
  });

  const vectorStore = await QdrantVectorStore.fromExistingCollection(
    embeddings,
    {
      url: "http://localhost:6333",
      collectionName: "langchainjs-testing",
    },
  );

  const client = vectorStore.client;
  
  // 1. Get collections list
  const collections = await client.getCollections();
  console.log("Qdrant Collections:", JSON.stringify(collections, null, 2));

  // 2. Get langchainjs-testing info
  try {
    const info = await client.getCollection("langchainjs-testing");
    console.log("langchainjs-testing Collection Info:", JSON.stringify(info, null, 2));

    // 3. Scroll points to see payload schema
    const points = await client.scroll("langchainjs-testing", {
      limit: 5,
      with_payload: true,
      with_vector: false
    });
    console.log("Qdrant Points Scroll:", JSON.stringify(points, null, 2));
  } catch (err) {
    console.log("langchainjs-testing collection info fetch failed:", err.message);
  }
}

main().catch(console.error);
