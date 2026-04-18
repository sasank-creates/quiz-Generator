import { createSlice } from "@reduxjs/toolkit";
import { uploadFile } from "@/config/redux/action";

const initialState = {
  loading: false,
  error: null,
  data: {},
  latestUploadedId: null,
};
const fileSlice = createSlice({
  name: "file",
  initialState,
  reducers: {
    reset: () => {
      return {
        loading: false,
        error: null,
        latestUploadedId: null,
      };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(uploadFile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadFile.fulfilled, (state, action) => {
        state.loading = false;
        state.latestUploadedId = action.payload.id;
      })
      .addCase(uploadFile.rejected, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        if (typeof payload === "string") {
          state.error = payload;
        } else if (payload?.error) {
          state.error = payload.error;
        } else if (payload?.message) {
          state.error = payload.message;
        } else {
          state.error = "Something went wrong. Please try again.";
        }
      });
  },
});
export const { reset } = fileSlice.actions;
export default fileSlice.reducer;