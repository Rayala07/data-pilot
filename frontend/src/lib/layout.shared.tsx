import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

// Shared nav/branding for every Fumadocs layout. The route back to the app is
// NOT configured here: DocsLayout ignores BaseLayoutProps.links entirely, so it
// is rendered as a sidebar slot in app/docs/layout.tsx instead.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: 6,
              background: "#2a78d6",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            D
          </span>
          <span style={{ fontWeight: 600 }}>DataPilot</span>
        </>
      ),
      url: "/docs",
    },
    githubUrl: "https://github.com/Rayala07/data-pilot",
  };
}
