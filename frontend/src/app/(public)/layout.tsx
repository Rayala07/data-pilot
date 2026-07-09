import { AuthLayout } from "@/components/AppShell";
import { RequireGuest } from "@/components/guards";

/**
 * Public routes. RequireGuest bounces an authenticated user to /connections,
 * so /login and /signup can never be reached while signed in.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireGuest>
      <AuthLayout>{children}</AuthLayout>
    </RequireGuest>
  );
}
