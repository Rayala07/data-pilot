import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/guards";

/**
 * Protected routes. RequireAuth sends anonymous visitors to /login and never
 * renders children while unauthenticated, so no page inside this group has to
 * think about auth - or leaks a flash of its contents before redirecting.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
