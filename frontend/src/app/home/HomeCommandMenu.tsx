"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

/**
 * The nav's ⌘K palette — the page's exploration affordance.
 *
 * The pill is visible rather than hidden behind the shortcut (N13, not N4):
 * newcomers get an affordance they can click, power users get the chord. If you
 * ship the pill you ship the whole keyboard model, so this does: ⌘K / Ctrl K to
 * open, Esc and backdrop to close, ↑/↓ to move, Enter to go, type to filter,
 * focus moved in on open and restored to the pill on close, and body scroll
 * locked while it's up. A dialog that ignores Esc is worse than no dialog.
 *
 * Portalled to <body> because .dp-nav carries a backdrop-filter, and a filtered
 * ancestor becomes the containing block for position: fixed descendants — the
 * overlay would be trapped inside a 64px-tall bar.
 */

type Item = {
  group: string;
  label: string;
  hint: string;
  href: string;
};

const ITEMS: Item[] = [
  { group: "On this page", label: "How it works", hint: "Four steps", href: "#how-it-works" },
  { group: "On this page", label: "The self-correction loop", hint: "The engine", href: "#engine" },
  { group: "On this page", label: "Features", hint: "What it does", href: "#features" },
  { group: "On this page", label: "Security", hint: "Read-only, encrypted", href: "#security" },
  { group: "On this page", label: "The REST API", hint: "For developers", href: "#api" },
  { group: "Documentation", label: "Quickstart", hint: "/docs/quickstart", href: "/docs/quickstart" },
  { group: "Documentation", label: "API reference", hint: "Authentication", href: "/docs/api-reference/authentication" },
  { group: "Documentation", label: "All documentation", hint: "/docs", href: "/docs" },
  { group: "Account", label: "Sign in", hint: "/login", href: "/login" },
  { group: "Account", label: "Create an account", hint: "/signup", href: "/signup" },
];

export function HomeCommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const pillRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.hint.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q)
    );
  }, [query]);

  /* Group headings are decided here rather than tracked with a mutable cursor
     during render — a variable reassigned inside the map survives past the
     render that created it and desyncs on the next one. */
  const rows = useMemo(
    () =>
      results.map((item, i) => ({
        item,
        heading: i === 0 || results[i - 1].group !== item.group ? item.group : null,
      })),
    [results]
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    pillRef.current?.focus();
  }, []);

  const go = useCallback(
    (item: Item) => {
      setOpen(false);
      setQuery("");
      setActive(0);

      if (!item.href.startsWith("#")) {
        router.push(item.href);
        return;
      }

      const target = document.querySelector(item.href);
      if (!target) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      /* Deferred by a frame, and that's the whole fix. Closing the dialog
         releases the body scroll lock, but the lock is only lifted when React
         runs the open-effect's cleanup during commit — after this callback
         returns. Calling scrollIntoView here ran it against a still-locked
         body, so every on-this-page jump silently did nothing while the
         route links (unaffected by a scroll lock) worked fine. */
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      });
    },
    [router]
  );

  /* Global chord. Bound only while this page is mounted, so it can't collide
     with the search listener /docs installs for itself.
     Closing goes through close() rather than setOpen(false) — a bare toggle
     dismissed the dialog but stranded focus on <body>, so a keyboard user who
     opened and closed it lost their place in the page entirely. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Keep the highlighted row in view when arrowing past the fold of the list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>("[data-active='true']")
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (results.length ? (a + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[active];
      if (item) go(item);
    } else if (e.key === "Tab") {
      /* The input is the panel's only focusable — rows are tabIndex -1 and
         driven by the arrow keys. Swallowing Tab is therefore the focus trap:
         without it the ring walks straight out of an open modal and onto the
         page behind the scrim. */
      e.preventDefault();
    }
  };

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        className="dp-cmdk__pill"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Jump to a section or doc (Control K)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        {/* "Jump to", not "Search". This filters a fixed list of destinations —
            it does not search page or doc content. Labelling it as search
            promises full-text and returns "no matches" for any real query,
            which reads as broken because it is. */}
        <span className="dp-cmdk__pillText">Jump to…</span>
        <span className="dp-cmdk__kbd" aria-hidden="true">
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </span>
      </button>

      {/* No mounted flag needed: `open` only ever becomes true from a click or a
          keydown, both of which are client-only, so document is guaranteed. */}
      {open &&
        createPortal(
          <div className="dp-cmdk">
            <div className="dp-cmdk__scrim" onClick={close} />
            <div
              className="dp-cmdk__panel"
              role="dialog"
              aria-modal="true"
              aria-label="Jump to a section or doc"
              onKeyDown={onPanelKey}
            >
              <div className="dp-cmdk__field">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={inputRef}
                  className="dp-cmdk__input"
                  placeholder="Filter destinations…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  aria-label="Filter destinations"
                  autoComplete="off"
                />
                <kbd className="dp-cmdk__esc">esc</kbd>
              </div>

              <div className="dp-cmdk__results" ref={listRef}>
                {results.length === 0 && (
                  <p className="dp-cmdk__empty">
                    No destination called “{query.trim()}”. This filters the page&apos;s sections
                    and the docs index — it doesn&apos;t search their contents.
                  </p>
                )}
                {rows.map(({ item, heading }, i) => (
                  <div key={item.href + item.label}>
                    {heading && <p className="dp-cmdk__group">{heading}</p>}
                    <button
                      type="button"
                      className="dp-cmdk__item"
                      data-active={i === active}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(item)}
                      tabIndex={-1}
                    >
                      <span className="dp-cmdk__itemLabel">{item.label}</span>
                      <span className="dp-cmdk__itemHint">{item.hint}</span>
                    </button>
                  </div>
                ))}
              </div>

              <div className="dp-cmdk__foot">
                <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
                <span><kbd>↵</kbd> open</span>
                <span><kbd>esc</kbd> close</span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
