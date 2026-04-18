import { createSlice} from "@reduxjs/toolkit";
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
    reset:()=>{
        return {
            loading:false,
            error:null,
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
        state.error = "Server Error " + action.payload;
      });
  },
});
export const {reset}=fileSlice.actions;
export default fileSlice.reducer;