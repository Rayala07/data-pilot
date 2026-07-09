"use client";

import { useEffect, useRef } from "react";
import { Provider } from "react-redux";
import { hydrate } from "@/features/auth/auth.slice";
import { getToken } from "@/lib/api";
import { makeStore, type AppStore } from "./store";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) storeRef.current = makeStore();

  // Read the persisted token in an effect, never during render. localStorage
  // doesn't exist on the server, so hydrating during render would make the
  // server's markup (logged out) disagree with the client's (logged in).
  // `auth.hydrated` stays false until this runs; guards wait on it.
  useEffect(() => {
    storeRef.current?.dispatch(hydrate(getToken()));
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}
