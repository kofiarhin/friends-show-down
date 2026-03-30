import { configureStore } from "@reduxjs/toolkit";
import gameReducer from "./gameSlice";
import { persistGameSession } from "../utils/gameSessionStorage";

export const store = configureStore({
  reducer: {
    game: gameReducer,
  },
  devTools: import.meta.env.DEV,
});

store.subscribe(() => {
  persistGameSession(store.getState().game);
});
