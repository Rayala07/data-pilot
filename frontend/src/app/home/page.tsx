import Link from "next/link";
import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { HomeNavActions, HomeHeroCta, HomeCtaActions } from "./HomeActions";
import { HomeDemo } from "./HomeDemo";
import { HomeSchemaMap } from "./HomeSchemaMap";
import { HomeCommandMenu } from "./HomeCommandMenu";
import "./home.css";

const display = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DataPilot — Ask Your Database Anything",
  description:
    "Connect your PostgreSQL database and ask questions in plain English. DataPilot translates your question into verified SQL, executes it safely, and renders the result as a chart — all in seconds.",
};

/* ── Icons ────────────────────────────────────────────────────────────────────
   One stroke voice throughout: 24px box, 1.6 stroke, round caps and joins.
--------------------------------------------------------------------------- */
function Icon({ size = 18, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const IconMark = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M12 2.5l8.23 4.75v9.5L12 21.5 3.77 16.75v-9.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M12 8.2l4.1 2.37v4.74L12 17.68l-4.1-2.37v-4.74z" fill="currentColor" />
  </svg>
);

const IconDatabase = () => (
  <Icon>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </Icon>
);

const IconSparkle = () => (
  <Icon>
    <path d="M12 3l1.88 5.63L19.5 10l-5.62 1.37L12 17l-1.88-5.63L4.5 10l5.62-1.37z" />
    <path d="M5 3l.94 2.81L8.75 7l-2.81.69L5 10l-.94-2.81L1.25 7l2.81-.69z" />
  </Icon>
);

const IconShield = () => (
  <Icon>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </Icon>
);

const IconChart = () => (
  <Icon>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </Icon>
);

const IconRefresh = () => (
  <Icon>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </Icon>
);

const IconLock = () => (
  <Icon>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </Icon>
);

const IconCheck = () => (
  <Icon size={14}>
    <polyline points="20 6 9 17 4 12" />
  </Icon>
);

/* ── What the API hands back ──────────────────────────────────────────────────
   Deliberately not a curl snippet. A request/response listing shows the
   *mechanism*, and the mechanism is not what this section is selling — every
   REST API on earth takes a POST. What it sells is the **transfer**: one plain
   sentence leaves your product, and four things you would otherwise have to
   build yourself come back. So the visual is the exchange, not the syntax.

   Every field shown is real: rows, chart, sql are the actual response keys, and
   the engine stages are the actual pipeline. The curl is one click away in the
   API reference for readers who want it.
--------------------------------------------------------------------------- */
const ENGINE = [
  "Retrieve the right tables",
  "Generate SQL",
  "Validate against your schema",
  "Self-correct on failure",
  "Execute read-only",
];

const RETURNS = [
  { label: "Rows", sample: "Aurora Lamp — 48,210.00", note: "Typed JSON, ready to render" },
  { label: "Chart spec", sample: "bar · x product · y revenue", note: "Chosen from the result's shape" },
  { label: "Explanation", sample: "“Aurora Lamp is the top product by revenue.”", note: "Written per answer, not templated" },
  { label: "SQL", sample: "SELECT p.prod_title AS product …", note: "The exact query that ran" },
];

/* ── Footer index ─────────────────────────────────────────────────────────────
   Runs as inline text, not stacked columns. Four columns of link lists is the
   most-recognised footer fingerprint on the web and reads as filler however real
   the destinations are; set as running lines against a mono term, the same links
   read as a colophon — denser, deliberate, and specific to a technical product.
   Every href resolves to a route or an MDX page that exists.
--------------------------------------------------------------------------- */
const FOOT_INDEX = [
  {
    term: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "The engine", href: "#engine" },
      { label: "Features", href: "#features" },
      { label: "Security", href: "#security" },
      { label: "The API", href: "#api" },
    ],
  },
  {
    term: "Docs",
    links: [
      { label: "Quickstart", href: "/docs/quickstart" },
      { label: "Concepts", href: "/docs/concepts/how-it-works" },
      { label: "Security model", href: "/docs/concepts/security" },
      { label: "All docs", href: "/docs" },
    ],
  },
  {
    term: "Reference",
    links: [
      { label: "Authentication", href: "/docs/api-reference/authentication" },
      { label: "Query", href: "/docs/api-reference/query" },
      { label: "Connections", href: "/docs/api-reference/connections" },
      { label: "Errors", href: "/docs/api-reference/errors" },
      { label: "Rate limits", href: "/docs/api-reference/rate-limits" },
    ],
  },
  {
    term: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Sign up", href: "/signup" },
    ],
  },
];

function ApiExchange() {
  return (
    <figure
      className="dp-api"
      role="img"
      aria-label="One question leaves your product, DataPilot retrieves tables, generates and validates SQL, self-corrects and executes it read-only, and returns four things: rows, a chart spec, a plain-English explanation, and the exact SQL."
    >
      <div className="dp-api__block">
        <span className="dp-label">Your product sends</span>
        <p className="dp-api__ask">“top 5 products by revenue”</p>
        <p className="dp-api__aside">One sentence and a connection id. That&apos;s the whole request.</p>
      </div>

      <div className="dp-api__flow" aria-hidden="true">
        <span className="dp-api__wire" />
        <span className="dp-api__verb">POST /v1/query</span>
        <span className="dp-api__wire" />
      </div>

      <div className="dp-api__block dp-api__block--engine">
        <span className="dp-label dp-api__engineLabel">
          DataPilot does the part you&apos;d otherwise build
        </span>
        <ul className="dp-api__steps">
          {ENGINE.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="dp-api__flow" aria-hidden="true">
        <span className="dp-api__wire" />
        <span className="dp-api__verb dp-api__verb--ok">200 OK</span>
        <span className="dp-api__wire" />
      </div>

      <div className="dp-api__block">
        <span className="dp-label">Your product gets back</span>
        <ul className="dp-api__returns">
          {RETURNS.map((r) => (
            <li key={r.label} className="dp-api__return">
              <span className="dp-api__returnLabel">{r.label}</span>
              <code className="dp-api__returnSample">{r.sample}</code>
              <span className="dp-api__returnNote">{r.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className={`dp-page ${display.variable}`}>
      {/* Two fixed blooms behind everything. Not animated, not mesh, not aurora —
          they exist so the canvas has depth instead of being flat charcoal. */}
      <div className="dp-canvas" aria-hidden="true" />

      <header className="dp-nav">
        <div className="dp-nav__inner">
          {/* /home, not "/": "/" bounces a signed-out visitor straight back here. */}
          <Link href="/home" className="dp-brand" aria-label="DataPilot home">
            <span className="dp-brand__mark"><IconMark /></span>
            <span className="dp-brand__text">DataPilot</span>
          </Link>

          <div className="dp-nav__mid">
            <HomeCommandMenu />
          </div>

          <div className="dp-nav__end">
            <Link href="/docs" className="dp-nav__link">Docs</Link>
            <HomeNavActions />
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* ── Hero · the product in motion is the sale ──────────────────── */}
        <section className="dp-hero" aria-labelledby="hero-heading">
          <div className="dp-shell dp-hero__head">
            <p className="dp-hero__meta dp-enter" style={{ "--i": 0 } as React.CSSProperties}>
              <span className="dp-label">PostgreSQL</span>
              <span className="dp-dot" aria-hidden="true" />
              <span className="dp-label">Read-only</span>
              <span className="dp-dot" aria-hidden="true" />
              <span className="dp-label">Self-correcting</span>
            </p>

            <h1
              id="hero-heading"
              className="dp-hero__title dp-enter"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              Ask your database <span className="dp-hero__accent">anything.</span>
            </h1>

            <p className="dp-hero__lede dp-enter" style={{ "--i": 2 } as React.CSSProperties}>
              Type a question in plain English. DataPilot finds the right tables, writes the SQL,
              fixes its own mistakes, and charts the answer — read-only, every time.
            </p>

            <HomeHeroCta />
          </div>

          {/* The demonstration. Not a screenshot — it runs. */}
          <div className="dp-shell dp-hero__stage dp-enter" style={{ "--i": 4 } as React.CSSProperties}>
            <HomeDemo />
          </div>
        </section>

        {/* ── The problem ──────────────────────────────────────────────── */}
        <section className="dp-section" aria-labelledby="problem-heading">
          <div className="dp-shell">
            <div className="dp-head">
              <h2 id="problem-heading" className="dp-head__title">
                Your data is locked behind SQL.
              </h2>
              <p className="dp-head__lede">
                Every time a non-technical stakeholder needs a number, they open a Slack thread.
                Every time a developer needs a quick answer, they context-switch to a SQL editor.
                The bottleneck isn’t the database — it’s the language barrier.
              </p>
            </div>

            <div className="dp-ledger">
              <div className="dp-ledger__col">
                <span className="dp-label dp-ledger__label">Without DataPilot</span>
                <ul className="dp-ledger__list">
                  <li>Write SQL manually or ask a developer</li>
                  <li>Wait hours for a simple metric</li>
                  <li>Copy-paste data into Excel to chart it</li>
                  <li>Wrong table join? Start over</li>
                  <li>Credentials shared in Slack threads</li>
                </ul>
              </div>
              <div className="dp-ledger__col dp-ledger__col--after">
                <span className="dp-label dp-ledger__label">With DataPilot</span>
                <ul className="dp-ledger__list">
                  <li>Type a question, get an answer</li>
                  <li>Results in under 2 seconds</li>
                  <li>Charts rendered automatically</li>
                  <li>Self-corrects if the first SQL is wrong</li>
                  <li>Credentials encrypted end-to-end</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section className="dp-section" id="how-it-works" aria-labelledby="flow-heading">
          <div className="dp-shell">
            <div className="dp-head">
              <h2 id="flow-heading" className="dp-head__title">
                From question to insight in four steps.
              </h2>
            </div>

            <ol className="dp-steps">
              {[
                { n: "01", title: "Connect your database", desc: "Paste your PostgreSQL string. We scan your schema and build a semantic map of every table.", icon: <IconDatabase /> },
                { n: "02", title: "Ask in plain English", desc: "Type any question about your data. No SQL, no filters, no query builder.", icon: <IconSparkle /> },
                { n: "03", title: "The engine writes and checks the SQL", desc: "It generates a query, validates it against your schema, and auto-corrects up to three times if it fails.", icon: <IconRefresh /> },
                { n: "04", title: "Results arrive as charts", desc: "The chart type follows the shape of the result. The raw table is always one click away.", icon: <IconChart /> },
              ].map((s) => (
                <li key={s.n} className="dp-step">
                  <span className="dp-step__ico">{s.icon}</span>
                  <span className="dp-step__n" aria-hidden="true">{s.n}</span>
                  <h3 className="dp-step__title">{s.title}</h3>
                  <p className="dp-step__desc">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── The engine · retrieval ───────────────────────────────────── */}
        <section className="dp-section" id="engine" aria-labelledby="engine-heading">
          <div className="dp-shell dp-split">
            <div className="dp-split__text">
              <h2 id="engine-heading" className="dp-head__title">
                It finds the three tables that matter out of forty-seven.
              </h2>
              <p className="dp-head__lede">
                Most AI SQL tools paste your whole schema into a prompt and hope. DataPilot embeds
                every table and retrieves only the ones your question is actually about — which is
                why it works on databases where the tables are called{" "}
                <code className="dp-inline">ord_hdr</code> and{" "}
                <code className="dp-inline">prod_attr</code>, not just on tidy demos.
              </p>
              <ul className="dp-checks">
                <li><IconCheck /><span>Detects hallucinated table and column names</span></li>
                <li><IconCheck /><span>Validates SQL against the real schema before execution</span></li>
                <li><IconCheck /><span>Blocks every non-SELECT query at the security layer</span></li>
                <li><IconCheck /><span>Keeps the full attempt trail — you see every retry</span></li>
              </ul>
            </div>
            <div className="dp-split__visual">
              <HomeSchemaMap />
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section className="dp-section" id="features" aria-labelledby="features-heading">
          <div className="dp-shell">
            <div className="dp-head">
              <h2 id="features-heading" className="dp-head__title">
                Built for the way data teams actually work.
              </h2>
            </div>

            <div className="dp-cards">
              <article className="dp-card dp-card--lead">
                <span className="dp-card__ico"><IconSparkle /></span>
                <h3 className="dp-card__title">Semantic table retrieval</h3>
                <p className="dp-card__desc">
                  Embeddings find the exact tables your question is about — even in a database with
                  dozens of tables and cryptic names nobody has documented since 2019.
                </p>
              </article>

              {[
                { icon: <IconChart />, title: "Deterministic chart choice", desc: "Chart type follows result shape, not a guess. Bar for categories, line for time. The same result always draws the same chart." },
                { icon: <IconRefresh />, title: "Self-correcting loop", desc: "Three attempts with structured feedback. Each retry gets the actual error, the real schema, and a sharper prompt." },
                { icon: <IconDatabase />, title: "Schema summary in business language", desc: "Connect a database and DataPilot tells you what it is about — entities, row counts, date ranges, and questions worth asking." },
                { icon: <IconShield />, title: "Read-only enforcement", desc: "Every query passes a security layer that rejects anything that is not a SELECT. A hallucinated DROP TABLE never executes." },
                { icon: <IconLock />, title: "Encrypted credentials", desc: "Connection strings are AES-256 encrypted at rest. The plaintext is never stored or logged — decrypted in memory, only when needed." },
              ].map((f) => (
                <article key={f.title} className="dp-card">
                  <span className="dp-card__ico">{f.icon}</span>
                  <h3 className="dp-card__title">{f.title}</h3>
                  <p className="dp-card__desc">{f.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Security ─────────────────────────────────────────────────── */}
        <section className="dp-section" id="security" aria-labelledby="security-heading">
          <div className="dp-shell">
            <div className="dp-vault">
              <div className="dp-vault__head">
                <span className="dp-vault__ico"><IconShield /></span>
                <h2 id="security-heading" className="dp-head__title">
                  A question can never write.
                </h2>
                <p className="dp-head__lede">
                  DataPilot was designed from day one on the assumption that your database holds
                  sensitive production data. Four guarantees, enforced in code rather than promised
                  in a prompt.
                </p>
              </div>

              <dl className="dp-spec">
                {[
                  { t: "AES-256 encryption", d: "Connection strings are encrypted at rest and decrypted in memory only for the duration of a query." },
                  { t: "Read-only sessions", d: "Queries run on a read-only session. No INSERT, UPDATE, DELETE or DROP — ever." },
                  { t: "SELECT enforcement", d: "A security layer validates every generated query before it reaches your database." },
                  { t: "Credential verification", d: "DataPilot checks whether your credential has write access, warns you if it does, and walks you through downgrading it." },
                ].map((s) => (
                  <div key={s.t} className="dp-spec__row">
                    <dt className="dp-spec__term">{s.t}</dt>
                    <dd className="dp-spec__def">{s.d}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ── API ──────────────────────────────────────────────────────── */}
        <section className="dp-section" id="api" aria-labelledby="api-heading">
          <div className="dp-shell dp-split dp-split--flip">
            <div className="dp-split__text">
              <h2 id="api-heading" className="dp-head__title">
                The same engine, from your own backend.
              </h2>
              <p className="dp-head__lede">
                Everything the app does is a REST API. Register a database once, then POST a
                question and get the rows, a chart spec, a plain-English explanation and the exact
                SQL back as JSON — retrieval, validation and the self-correction loop included.
              </p>
              <ul className="dp-checks">
                <li><IconCheck /><span>API keys, not passwords — your servers never touch a session</span></li>
                <li><IconCheck /><span>Keys hashed at rest, scoped to their owner, revocable in one click</span></li>
                <li><IconCheck /><span>One predictable error shape, per-key rate limits, the full attempt trail</span></li>
                <li><IconCheck /><span>The same read-only guarantee the app runs on</span></li>
              </ul>
              <div className="dp-actions">
                <Link href="/docs/api-reference/authentication" className="dp-btn dp-btn--ghost">
                  Read the API reference
                </Link>
                <Link href="/docs/quickstart" className="dp-btn dp-btn--quiet">
                  Quickstart
                </Link>
              </div>
            </div>
            <div className="dp-split__visual">
              <ApiExchange />
            </div>
          </div>
        </section>

      </main>

      {/* ── The close ───────────────────────────────────────────────────────
          Layout follows the supplied reference: centred CTA over a soft wash,
          then a footer with the wordmark and a block of copy on the left, link
          columns on the right, and a hairline into a centred copyright. Both
          bands are full-bleed — the rounded card the reference sits in is the
          mockup's presentation frame, not part of the design.

          The closing CTA lives inside <footer> rather than <main> because a
          repeated site-wide call to action alongside the nav and the copyright
          is footer content, and it keeps <main> to the argument itself. */}
      <footer className="dp-end">
        <section className="dp-end__cta" aria-labelledby="cta-heading">
          <div className="dp-cta__card">
            <div className="dp-cta__inner">
              <h2 id="cta-heading" className="dp-cta__title">
                Your database is already full of answers.
              </h2>
              <p className="dp-cta__lede">DataPilot helps you effortlessly explore them.</p>

              <HomeCtaActions />
              <p className="dp-cta__note">No SQL knowledge required. No credit card needed.</p>

              {/* Getting started, folded in from its own section — it was the
                  how-it-works story told a second time. */}
              <ol className="dp-cta__steps">
                <li className="dp-cta__step"><b>01</b><span>Create an account</span></li>
                <li className="dp-cta__step"><b>02</b><span>Paste a connection string</span></li>
                <li className="dp-cta__step"><b>03</b><span>Ask your first question</span></li>
              </ol>
            </div>
          </div>
        </section>

        <div className="dp-end__panel">
          <div className="dp-end__panelInner">
            <div className="dp-foot">
              <div className="dp-foot__crown">
                <Link href="/home" className="dp-foot__mark" aria-label="DataPilot home">
                  <span className="dp-foot__markGlyph"><IconMark /></span>
                  <span className="dp-foot__markText">DataPilot</span>
                </Link>
                <p className="dp-foot__statement">
                  Every question is read-only. That isn’t a setting you remember to turn on —
                  it’s the only thing the engine is able to do.
                </p>
              </div>

              <dl className="dp-foot__index">
                {FOOT_INDEX.map((group) => (
                  <div key={group.term} className="dp-foot__row">
                    <dt className="dp-foot__term">{group.term}</dt>
                    <dd className="dp-foot__links">
                      {group.links.map((l, i) => (
                        <span key={l.href} className="dp-foot__item">
                          {i > 0 && <span className="dp-foot__sep" aria-hidden="true">·</span>}
                          {/* Same-page jumps stay plain anchors — there's no route
                              change to hand the router. */}
                          {l.href.startsWith("#") ? (
                            <a href={l.href} className="dp-footer__link">{l.label}</a>
                          ) : (
                            <Link href={l.href} className="dp-footer__link">{l.label}</Link>
                          )}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <p className="dp-foot__baseline">
              <span>© {new Date().getFullYear()} DataPilot</span>
              <span>Built for PostgreSQL</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
