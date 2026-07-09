import { configureStore } from "@reduxjs/toolkit";
import { authReducer } from "@/features/auth/auth.slice";
import { connectionsReducer } from "@/features/connections/connections.slice";
import { queryReducer } from "@/features/query/query.slice";
import { retrievalReducer } from "@/features/retrieval/retrieval.slice";

// A factory, not a module-level singleton: Next renders on the server, and a
// shared store would leak one request's state into another's.
export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      connections: connectionsReducer,
      query: queryReducer,
      retrieval: retrievalReducer,
    },
    // configureStore installs redux-thunk by default — that's the middleware
    // every createApiThunk here runs on.
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
