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
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response && error.response.data
          ? error.response.data
          : error.message
      );
    }
  }
);