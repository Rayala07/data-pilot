"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The hero's animated product demonstration.
 *
 * This is the one thing on the page a competitor can't screenshot: the
 * self-correction loop actually running. Question types in, tables get
 * retrieved, two SQL attempts fail with real errors, the third lands, the chart
 * draws. It then holds on the finished answer for a beat and runs again.
 *
 * Four deliberate constraints:
 *
 * 1. It loops, but it is pausable. Motion that starts on its own, runs past five
 *    seconds and repeats needs a stop mechanism (WCAG 2.2.2) — so the control in
 *    the rail is a Pause/Play toggle, not decoration. Pausing settles on the
 *    completed answer rather than freezing mid-sequence, which is both the most
 *    useful frame and the least broken-looking one.
 * 2. It only runs while it's on screen. An IntersectionObserver stops the timers
 *    once the card scrolls away, so the page isn't animating into an empty room.
 * 3. It renders COMPLETE on the server. No JS, no motion preference, a crawler,
 *    a failed hydration — all of them get the finished answer, not an empty
 *    shell. The animation is an enhancement layered onto a page that already
 *    works, which is also why the initial client render matches the server's.
 * 4. `prefers-reduced-motion` never autoplays and never schedules a timer. The
 *    toggle still works, so that reader can opt into a single run by hand.
 */

const QUESTION = "monthly revenue for the last 6 months";

const TABLES = ["orders", "order_lines", "products"];

const ATTEMPTS = [
  {
    n: 1,
    ok: false,
    sql: "SELECT month, revenue FROM revenue_summary",
    note: "relation “revenue_summary” does not exist",
  },
  {
    n: 2,
    ok: false,
    sql: "SELECT month, revenue FROM orders GROUP BY month",
    note: "column “revenue” does not exist on orders",
  },
  {
    n: 3,
    ok: true,
    sql: "SELECT DATE_TRUNC('month', created_at) AS month,\n       SUM(total) AS revenue\n  FROM orders\n GROUP BY 1 ORDER BY 1",
    note: "6 rows · 240 ms",
  },
];

const REVENUE = [
  { label: "Jan", h: 53, val: "98" },
  { label: "Feb", h: 66, val: "122" },
  { label: "Mar", h: 76, val: "140" },
  { label: "Apr", h: 86, val: "158" },
  { label: "May", h: 100, val: "184", peak: true },
  { label: "Jun", h: 88, val: "162" },
];

/* Stage gates. Each element checks `stage >= its number` to decide whether it
   has arrived, so the whole sequence is one integer. */
const S = { ASK: 1, RETRIEVE: 2, A1: 3, A2: 4, A3: 5, ANSWER: 6 } as const;
const DONE = S.ANSWER;

const SCHEDULE: [number, number][] = [
  [S.RETRIEVE, 1650],
  [S.A1, 2500],
  [S.A2, 3350],
  [S.A3, 4200],
  [S.ANSWER, 4950],
];

const TYPE_MS = 34;

/* The answer stage lands at 4950ms, but the chart bars are still growing after
   it — 420ms of transition plus a 70ms stagger across six columns. SETTLED_MS is
   when the card is genuinely finished moving; HOLD_MS is the beat it rests on
   the completed answer before running again. */
const SETTLED_MS = 5800;
const HOLD_MS = 1500;

export function HomeDemo() {
  const [stage, setStage] = useState<number>(DONE);
  const [typed, setTyped] = useState<string>(QUESTION);
  const [playing, setPlaying] = useState(false);
  const [inView, setInView] = useState(true);
  /* Incremented when a pass finishes. It's a dependency of the effect below, so
     bumping it re-runs the sequence — which is how the loop repeats without the
     cycle function having to call itself. */
  const [pass, setPass] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const typer = useRef<ReturnType<typeof setInterval> | null>(null);
  const figure = useRef<HTMLElement>(null);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (typer.current) clearInterval(typer.current);
    typer.current = null;
  }, []);

  const runSequence = useCallback(
    (onSettled: () => void) => {
      clear();
      setStage(S.ASK);
      setTyped("");

      let i = 0;
      typer.current = setInterval(() => {
        i += 1;
        setTyped(QUESTION.slice(0, i));
        if (i >= QUESTION.length && typer.current) {
          clearInterval(typer.current);
          typer.current = null;
        }
      }, TYPE_MS);

      SCHEDULE.forEach(([to, at]) => {
        timers.current.push(setTimeout(() => setStage(to), at));
      });

      timers.current.push(setTimeout(onSettled, SETTLED_MS + HOLD_MS));
    },
    [clear]
  );

  // Autoplay, unless the reader asked for less motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frame = requestAnimationFrame(() => setPlaying(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Don't animate to an empty room.
  useEffect(() => {
    const el = figure.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !inView) return;

    /* Deliberately a frame late. The server-rendered markup is the *finished*
       answer; rewinding to stage 0 during commit would race that first paint and
       could flash the empty state. One rAF guarantees the reader sees a complete
       card, which then rewinds and plays. */
    const frame = requestAnimationFrame(() =>
      runSequence(() => setPass((n) => n + 1))
    );
    return () => {
      cancelAnimationFrame(frame);
      clear();
    };
  }, [playing, inView, pass, runSequence, clear]);

  const toggle = useCallback(() => {
    if (playing) {
      // Stop on the completed answer rather than wherever the timers happened
      // to be — a half-drawn chart is not a state worth leaving on screen.
      clear();
      setStage(DONE);
      setTyped(QUESTION);
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  }, [playing, clear]);

  const at = (n: number) => (stage >= n ? " is-in" : "");
  const running = stage < DONE;

  return (
    <figure className="dp-demo" ref={figure}>
      <figcaption className="dp-demo__rail">
        {/* Separators are drawn, not typed. A low-contrast "·" is decoration
            wearing a text node's clothes and it fails the contrast pass. */}
        <span className="dp-label">
          prod-ecommerce
          <span className="dp-dot" aria-hidden="true" />
          47 tables
          <span className="dp-dot" aria-hidden="true" />
          read-only
        </span>
        {/* The loop's stop mechanism, not a flourish — see the note at the top
            of this file. Labelled by the action it performs. */}
        <button type="button" className="dp-demo__toggle" onClick={toggle}>
          {playing ? "Pause" : "Play"}
        </button>
      </figcaption>

      <div className="dp-demo__body">
        <div className="dp-demo__ask">
          <span className="dp-demo__askLabel">Ask</span>
          <span className="dp-demo__askText">
            {typed}
            {/* Only while the field is genuinely filling. A cursor that keeps
                blinking through the SQL attempts is decoration, and decoration
                is the whole reason blinking cursors are usually a tell. */}
            {running && typed.length < QUESTION.length && (
              <span className="dp-demo__caret" aria-hidden="true" />
            )}
          </span>
        </div>

        {/* The trail and the answer sit side by side on a wide viewport, so the
            struggle and the payoff are legible in one glance instead of the
            chart being pushed a screen and a half below the fold. */}
        <div className="dp-demo__trail">
          <div className={`dp-demo__step${at(S.RETRIEVE)}`}>
            <span className="dp-demo__stepLabel">Retrieved</span>
            <span className="dp-demo__tables">
              {TABLES.map((t) => (
                <code key={t} className="dp-demo__table">
                  {t}
                </code>
              ))}
            </span>
          </div>

          <ol className="dp-demo__attempts">
            {ATTEMPTS.map((a, i) => (
              <li key={a.n} className={`dp-demo__attempt${at(S.A1 + i)}`}>
                <span
                  className={`dp-demo__mark dp-demo__mark--${a.ok ? "ok" : "fail"}`}
                  aria-hidden="true"
                />
                <div className="dp-demo__attemptBody">
                  <pre className="dp-demo__sql">
                    <code>{a.sql}</code>
                  </pre>
                  <p className={`dp-demo__note dp-demo__note--${a.ok ? "ok" : "fail"}`}>
                    {a.note}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className={`dp-demo__answer${at(S.ANSWER)}`}>
          <p className="dp-demo__say">
            Revenue climbed every month to a <strong>$184k</strong> peak in May, then
            eased 12% in June.
          </p>

          <div className="dp-demo__chart">
            {REVENUE.map((b, i) => (
              <div key={b.label} className="dp-demo__col">
                <span className="dp-demo__val">${b.val}k</span>
                <div className="dp-demo__barTrack">
                  <div
                    className={`dp-demo__bar${b.peak ? " dp-demo__bar--peak" : ""}`}
                    style={
                      { "--h": `${b.h}%`, "--i": i } as React.CSSProperties
                    }
                  />
                </div>
                <span className="dp-demo__month">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
