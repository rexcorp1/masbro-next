// src/lib/langchain.ts

// ----- Import LangChain dan Modul Terkait -----
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

// ----- Konfigurasi -----

// 1. API Key
// Dibaca dari environment variable yang otomatis di-load oleh Next.js dari .env.local
const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

// Runtime check untuk memastikan API Key ada saat kode ini dijalankan
if (!apiKey) {
  // Di lingkungan server-side (API Route, getServerSideProps), error ini lebih baik di-handle
  // tanpa menghentikan proses (misal: return error response).
  // Di client-side, ini akan menghentikan script jika key tidak ada.
  console.error("RUNTIME Error: NEXT_PUBLIC_GOOGLE_API_KEY tidak ditemukan di process.env.");
  // Pertimbangkan cara penanganan error yang lebih baik di aplikasi production
  // throw new Error("Konfigurasi API Key Google tidak ditemukan.");
}

// --- Peringatan Keamanan ---
// Menggunakan NEXT_PUBLIC_ membuat key ini bisa diakses di browser.
// Jika kode ini HANYA akan berjalan di server (misal: API Route),
// lebih aman gunakan nama tanpa NEXT_PUBLIC_ (misal: GEMINI_API_KEY=...)
// di .env.local dan baca process.env.GEMINI_API_KEY di sini.

// 2. Inisialisasi Model ChatGoogleGenerativeAI
// Gunakan apiKey yang sudah dibaca, atau berikan string kosong jika tidak ada (akan error saat pemanggilan)
const model = new ChatGoogleGenerativeAI({
  apiKey: apiKey || "", // Beri string kosong jika undefined untuk menghindari error constructor
  model: "gemini-1.5-pro-latest", // Model stabil, ganti jika perlu dan yakin didukung
  temperature: 1,
  maxOutputTokens: 8192, // Sesuaikan jika perlu
  topK: 64,
  topP: 0.95,
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    // Tambahkan kategori lain jika perlu
  ],
});

// 3. Output Parser
const outputParser = new StringOutputParser();

// 4. Prompt Template
// Definisikan template dasar di sini
const promptTemplate = ChatPromptTemplate.fromMessages([
  // ["system", "You are a helpful AI named BroBot."], // Contoh system prompt (opsional)
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
]);

// 5. Membuat Chain (LCEL)
// Gabungkan prompt, model, dan parser
const chain = promptTemplate.pipe(model).pipe(outputParser);

// ----- Fungsi Helper: createDynamicPromptInput -----
// Fungsi ini yang tadi error karena belum ada/di-export

interface DynamicPromptInputParams {
  userInput: string;
  chatHistory?: BaseMessage[];
  // Tambahkan parameter lain sesuai kebutuhan state aplikasimu
  // otherState?: any;
}

// Struktur output yang diharapkan oleh chain.invoke() berdasarkan promptTemplate
interface LangChainInput {
  input: string;
  chat_history: BaseMessage[];
  // Tambahkan field lain jika ada placeholder lain di promptTemplate
}

/**
 * Memformat input mentah menjadi objek yang sesuai untuk LangChain chain.invoke().
 * @param params Objek berisi userInput, chatHistory, dll.
 * @returns Objek yang siap digunakan oleh chain.invoke().
 */
function createDynamicPromptInput(params: DynamicPromptInputParams): LangChainInput {
  console.log("Formatting input via createDynamicPromptInput with params:", params);

  const formattedHistory = params.chatHistory || [];

  const langChainInput: LangChainInput = {
    input: params.userInput,
    chat_history: formattedHistory,
    // Map parameter lain ke placeholder prompt jika ada
  };

  return langChainInput;
}


// ----- Exports -----
// Ekspor komponen yang perlu digunakan di bagian lain aplikasi
// Misalnya di Redux Thunk (conversationThunk.ts) atau API Route

export {
  model,             // Ekspor model jika perlu akses langsung (jarang)
  promptTemplate,    // Ekspor template jika perlu modifikasi di tempat lain (jarang)
  chain,             // Ekspor chain LCEL utama untuk dipanggil .invoke() atau .stream()
  createDynamicPromptInput, // Ekspor fungsi helper ini agar bisa dipakai di thunk/API
  // Ekspor tipe data Message jika perlu di tempat lain
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage
};

// Kamu tidak perlu mengekspor apiKey atau outputParser secara langsung biasanya.
// Fungsi runChat dan contoh penggunaannya TIDAK dimasukkan di sini,
// karena logika eksekusi biasanya ada di tempat pemanggilannya (thunk/API route).