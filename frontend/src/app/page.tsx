"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui";
import { useAppSelector } from "@/store/hooks";

/**
 * The only route outside a guarded group: it decides where "/" goes once the
 * persisted token has been read.
 */
export default function RootPage() {
  const router = useRouter();
  const { token, hydrated } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(token ? "/connections" : "/login");
  }, [hydrated, token, router]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
