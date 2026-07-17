import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

// Shared nav/branding for every Fumadocs layout. "Open app" links back to the
// main app at the same origin — the mirror of the "Docs" link in the app nav.
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
    links: [
      {
        text: "Open app",
        url: "/",
        active: "none",
      },
    ],
    githubUrl: "https://github.com/Rayala07/data-pilot",
  };
}
