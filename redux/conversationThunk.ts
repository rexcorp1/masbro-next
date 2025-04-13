import { createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "./store"; // Pastikan path ini benar
import { Message } from "@/types/conversation-types"; // Asumsi tipe Message kamu punya { id, sender, text }
// Import komponen LangChain yang sudah kita siapkan dan export dari lib
import {
  chain,
  createDynamicPromptInput,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from "@/lib/langchain";
import axios from "axios";

// THUNK UTAMA YANG DIPERBAIKI: Untuk mengirim prompt user dan mendapatkan respons AI
export const sendUserPropmtToAI = createAsyncThunk<
  Message, // Tipe data yang di-return jika sukses (pesan dari AI)
  { prompt: string; isEdited?: boolean; messageId?: string; image?: string }, // Input parameter untuk thunk
  { rejectValue: string; state: RootState } // Opsi thunk
>(
  "conversation/sendUserPropmtToAI",
  async (
    { prompt, isEdited = false, messageId, image }, // Default isEdited ke false
    { rejectWithValue, getState }
  ) => {
    const state = getState(); // Tidak perlu 'as RootState' di sini jika store dikonfigurasi benar

    // Dapatkan session aktif
    const currentSession = state.conversation.sessions.find(
      (session) => session.id === state.conversation.currentSessionId
    );

    if (!currentSession) {
      return rejectWithValue("No current session found");
    }

    // --- PERBAIKAN 1: Memformat History untuk LangChain ---
    // Ambil history pesan dari state Redux untuk session ini
    // dan konversikan ke format LangChain (HumanMessage/AIMessage)
    // Kita filter juga agar tidak memasukkan pesan yang sedang diedit (jika isEdited true)
    const chatHistoryForAI: BaseMessage[] = currentSession.messages
      .filter(msg => !(isEdited && msg.id === messageId)) // Jangan sertakan pesan yg diedit dlm history
      .map(msg => {
          // Hati-hati jika 'text' di state bisa jadi objek karena error sebelumnya
          // Idealnya pastikan text selalu string di state
          const messageText = typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text);
          return msg.sender === "user"
            ? new HumanMessage(messageText)
            : new AIMessage(messageText);
      });

    // --- PERBAIKAN 2: Handle Input (Termasuk Placeholder untuk Image) ---
    // Siapkan input untuk fungsi helper LangChain kita
    // CATATAN: Penanganan 'image' memerlukan setup multimodal di lib/langchain.ts
    // Untuk sekarang, kita fokus pada teks dan beri peringatan jika ada image.
    if (image) {
        console.warn("Image parameter provided to sendUserPropmtToAI, but multimodal handling is not fully implemented in langchain.ts yet.");
        // TODO: Implement multimodal logic here if needed.
        // Ini akan melibatkan perubahan cara memanggil 'chain.invoke' atau 'model.invoke'
        // dengan menyertakan data gambar dalam HumanMessage terakhir.
        // Contoh kasar:
        // const lastMessageContent = [{ type: "text", text: prompt }];
        // if (image) lastMessageContent.push({ type: "image_url", image_url: { url: image }}); // Asumsi image = data URL
        // const messagesForInvoke = [...chatHistoryForAI, new HumanMessage({ content: lastMessageContent })];
        // const aiResponseString = await model.invoke(messagesForInvoke); // Panggil model langsung
        // Untuk saat ini, kita abaikan gambar agar fokus ke perbaikan teks.
    }

    const inputForHelper: Parameters<typeof createDynamicPromptInput>[0] = {
        userInput: prompt, // Prompt/pesan user saat ini
        chatHistory: chatHistoryForAI, // History dalam format LangChain
    };
    const formattedInput = createDynamicPromptInput(inputForHelper);

    // --- PERBAIKAN 3: Memanggil LangChain Chain dengan Benar ---
    try {
      console.log("Calling LangChain chain with input:", formattedInput);
      // Panggil 'chain.invoke' yang kita ekspor dari langchain.ts
      const aiResponseString = await chain.invoke(formattedInput);
      console.log("Received AI response:", aiResponseString);

      // Pastikan responsnya adalah string
      if (typeof aiResponseString !== "string") {
        console.error("AI response is not a string:", aiResponseString);
        // Mungkin ini hasil dari safety settings block atau error lain
        // Kembalikan pesan error yang jelas
        return rejectWithValue("Received invalid response format from AI.");
      }

      // --- PERBAIKAN 4: Return Pesan AI dengan Format Benar ---
      // Buat objek Message untuk AI dengan 'text' berisi string respons
      const aiMessageResponse: Message = {
        // Buat ID unik baru untuk pesan AI ini, JANGAN pakai messageId dari user
        // Bisa pakai library seperti uuid atau cara lain
        id: `ai-${Date.now()}-${Math.random().toString(16).substring(2, 8)}`, // Contoh ID sederhana
        sender: "ai",
        text: aiResponseString, // <-- Respons AI yang sudah berupa string
        // timestamp: new Date().toISOString(), // Opsional: tambahkan timestamp
        // chatId: currentSession.id, // Opsional: tambahkan chatId jika tipe Message punya
      };

      return aiMessageResponse; // Return pesan AI ini ke reducer

    } catch (error: any) {
      console.error("Error during LangChain chain invocation:", error);
      // Kirim pesan error yang lebih informatif jika memungkinkan
      const errorMessage = error.message || "An unexpected error occurred contacting the AI.";
      return rejectWithValue(errorMessage);
    }
  }
);

// Thunk untuk mengambil data chat dari backend
export const fetchChatsSession = createAsyncThunk(
  "conversation/fetchChatsSession",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get("/api/chat"); // Panggil GET /api/chat
      return response.data; // Kembalikan data sesi (array of chats)
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        return rejectWithValue("Unauthorized. Please log in."); // Handle 401
      }
      return rejectWithValue("Failed to fetch chats sessions");
    }
  }
);

// Thunk untuk menyimpan state sesi ke backend
export const saveChatSession = createAsyncThunk(
  "conversation/saveChatSession",
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as RootState;
    const sessions = state.conversation.sessions; // Ambil semua sesi dari state

    // PENTING: Pastikan data 'sessions' di state Redux sudah benar
    // sebelum dikirim. Reducer yang menangani 'sendUserPropmtToAI.fulfilled'
    // harus menyimpan pesan AI dengan 'text' berupa string.
    if (sessions.some(s => s.messages.some(m => typeof m.text !== 'string'))) {
        console.error("Attempting to save sessions with non-string message text!", sessions);
        // Sebaiknya jangan kirim data yang salah
        // return rejectWithValue("Cannot save invalid session data.");
        // Atau coba bersihkan datanya (tapi idealnya state selalu benar)
    }


    try {
      console.log("Saving sessions to POST /api/chat");
      // Kirim data sessions ke POST /api/chat
      await axios.post("/api/chat", { sessions });
      console.log("Sessions saved successfully.");
      // Tidak perlu return apa-apa jika hanya menyimpan
    } catch (error) {
      console.error("Error saving chat session:", error);
      if (axios.isAxiosError(error) && error.response) {
        return rejectWithValue(`Failed to save chat: ${error.response.status} ${error.response.data || error.response.statusText}`);
      }
      return rejectWithValue("Failed to save chat");
    }
  }
);

// Thunk untuk mengupdate pesan (edit)
export const updateMessage = createAsyncThunk<
  // Tidak perlu return value spesifik jika hanya trigger action lain
  void,
  { sessionId: string; messageId: string; text: string }, // Input parameter
  { rejectValue: string; state: RootState } // Opsi thunk
>(
  "conversation/updateMessage",
  async ({ sessionId, messageId, text }, { getState, dispatch, rejectWithValue }) => {
    const state = getState();
    const session = state.conversation.sessions.find(
      (session) => session.id === sessionId
    );

    if (!session) {
        return rejectWithValue("Session not found for update");
    }

    const messageExists = session.messages.some(
        (message) => message.id === messageId
    );

    if (!messageExists) {
        return rejectWithValue("Message not found for update");
    }

    try {
      // Dispatch action untuk update text di state (Diasumsikan ada reducer untuk ini)
      // dispatch(conversationSlice.actions.updateMessageText({ sessionId, messageId, text }));

      // Panggil AI lagi dengan prompt yang diedit
      console.log(`Dispatching sendUserPropmtToAI for edited message ${messageId}`);
      const aiResultAction = await dispatch(
        sendUserPropmtToAI({ prompt: text, isEdited: true, messageId })
      );

      // Cek jika pemanggilan AI gagal (rejected)
      if (sendUserPropmtToAI.rejected.match(aiResultAction)) {
          console.error("Failed to get AI response for edited message:", aiResultAction.payload);
          // Kembalikan error agar UI bisa tahu
          return rejectWithValue(aiResultAction.payload || "Failed to process edited message");
      }

      // Jika AI sukses, simpan sesi ke backend
      // Catatan: Pastikan state Redux sudah terupdate dengan pesan AI baru sebelum save
      // Ini mungkin butuh sedikit delay atau cara lain tergantung lifecycle Redux
      console.log("Dispatching saveChatSession after AI response for edit");
      await dispatch(saveChatSession());

    } catch (error) {
        console.error("Error in updateMessage thunk:", error);
        return rejectWithValue("Failed to update message and get AI response");
    }
  }
);