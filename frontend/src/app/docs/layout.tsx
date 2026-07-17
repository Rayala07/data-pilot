import type { ReactNode } from "react";
import Link from "next/link";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { SearchProvider } from "fumadocs-ui/contexts/search";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";

/**
 * The way out of the docs and back into the product.
 *
 * Lives in the sidebar because DocsLayout ignores BaseLayoutProps.links. Points
 * at "/" rather than /connections on purpose: the docs are public, and "/"
 * already sends a signed-in user to /connections and everyone else to /home —
 * linking straight to /connections would bounce a logged-out reader to /login.
 *
 * Styled with fd-* tokens so it follows the docs theme in light and dark.
 */
function BackToApp() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-3 py-2 text-sm font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
    >
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
      Back to DataPilot
    </Link>
  );
}

// Theme context comes from the root RootProvider. Search is mounted here and
// nowhere else, so its Ctrl/Cmd+K listener only exists while /docs is open and
// unmounts on navigation back to the app.
export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <SearchProvider>
      <DocsLayout tree={source.pageTree} sidebar={{ banner: <BackToApp /> }} {...baseOptions()}>
        {children}
      </DocsLayout>
    </SearchProvider>
  );
}
