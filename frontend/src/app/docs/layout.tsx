import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { SearchProvider } from "fumadocs-ui/contexts/search";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";

// Theme context comes from the root RootProvider. Search is mounted here and
// nowhere else, so its Ctrl/Cmd+K listener only exists while /docs is open and
// unmounts on navigation back to the app.
export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <SearchProvider>
      <DocsLayout tree={source.pageTree} {...baseOptions()}>
        {children}
      </DocsLayout>
    </SearchProvider>
  );
}
