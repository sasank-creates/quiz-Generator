import {configureStore} from '@reduxjs/toolkit';
import fileReducer from '@/config/redux/reducer';

const store = configureStore({
  reducer: {
    file: fileReducer,
  },
});

export default store;