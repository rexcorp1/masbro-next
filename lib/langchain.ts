// src/lib/langchain.ts

// ----- Import LangChain dan Modul Terkait -----
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
// Hapus import ini karena kita pakai string literal di bawah
// import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

// ----- Konfigurasi -----

// 1. API Key
const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

if (!apiKey) {
  console.error("RUNTIME Error: NEXT_PUBLIC_GOOGLE_API_KEY tidak ditemukan di process.env.");
  // Pertimbangkan penanganan error yang lebih baik
}

// --- Peringatan Keamanan ---
// Ingat: NEXT_PUBLIC_ membuat key ini bisa diakses di browser.
// Gunakan nama tanpa NEXT_PUBLIC_ jika hanya dipakai di server.

// 2. Inisialisasi Model ChatGoogleGenerativeAI
const model = new ChatGoogleGenerativeAI({
  apiKey: apiKey || "", // Beri string kosong jika undefined
  model: "gemini-1.5-pro-latest",
  temperature: 1,
  maxOutputTokens: 8192,
  topK: 64,
  topP: 0.95,
  // --- PERBAIKAN DI SINI ---
  safetySettings: [
    {
      category: "HARM_CATEGORY_HARASSMENT", // Pakai string literal
      threshold: "BLOCK_LOW_AND_ABOVE",    // Pakai string literal
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH", // Pakai string literal
      threshold: "BLOCK_MEDIUM_AND_ABOVE", // Pakai string literal
    },
    // Tambahkan kategori lain jika perlu (dengan format string)
    // Contoh:
    // { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    // { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  ],
  // --- AKHIR PERBAIKAN ---
});

// 3. Output Parser
const outputParser = new StringOutputParser();

// 4. Prompt Template
const promptTemplate = ChatPromptTemplate.fromMessages([
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
]);

// 5. Membuat Chain (LCEL)
const chain = promptTemplate.pipe(model).pipe(outputParser);

// ----- Fungsi Helper: createDynamicPromptInput -----
interface DynamicPromptInputParams {
  userInput: string;
  chatHistory?: BaseMessage[];
}

interface LangChainInput {
  input: string;
  chat_history: BaseMessage[];
}

function createDynamicPromptInput(params: DynamicPromptInputParams): LangChainInput {
  console.log("Formatting input via createDynamicPromptInput with params:", params);
  const formattedHistory = params.chatHistory || [];
  const langChainInput: LangChainInput = {
    input: params.userInput,
    chat_history: formattedHistory,
  };
  return langChainInput;
}

// ----- Exports -----
export {
  model,
  promptTemplate,
  chain,
  createDynamicPromptInput,
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage
};
