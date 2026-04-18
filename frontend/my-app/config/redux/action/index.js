import { createAsyncThunk } from "@reduxjs/toolkit";
import Backend_config from "@/config/Backend_config";
export const uploadFile = createAsyncThunk(
  "file/uploadFile",
  async (fileData, thunkAPI) => {
    try {
      const formData = new FormData();
      formData.append("file", fileData);
      const response = await Backend_config.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 120000, // 2 minutes — Gemini AI processing can be slow
      });
      return response.data;
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        return thunkAPI.rejectWithValue({
          error: "Request timed out. The file may be too large or complex. Please try again.",
        });
      }
      return thunkAPI.rejectWithValue(
        error.response && error.response.data
          ? error.response.data
          : { error: error.message || "Network error. Please check your connection." }
      );
    }
  }
);