import Link from "next/link";
import type { Metadata } from "next";
import "./home.css";

export const metadata: Metadata = {
  title: "DataPilot — Ask Your Database Anything",
  description:
    "Connect your PostgreSQL database and ask questions in plain English. DataPilot translates your question into verified SQL, executes it safely, and renders the result as a chart — all in seconds.",
};

/* ── Inline SVG icons ─────────────────────────────────────────────────────── */
function IconDatabase() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.88 5.63L19.5 10l-5.62 1.37L12 17l-1.88-5.63L4.5 10l5.62-1.37z" />
      <path d="M5 3l.94 2.81L8.75 7l-2.81.69L5 10l-.94-2.81L1.25 7l2.81-.69z" />
      <path d="M19 17l.94 2.81 2.81.69-2.81.69L19 24l-.94-2.81-2.81-.69 2.81-.69z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ── Product preview mock ─────────────────────────────────────────────────── */
function ProductMockup() {
  return (
    <div className="dp-mockup" role="img" aria-label="DataPilot product preview">
      {/* Sidebar */}
      <div className="dp-mockup__body">
        <aside className="dp-sidebar">
          <div className="dp-sidebar__label">Connections</div>
          <div className="dp-sidebar__item dp-sidebar__item--active">
            <IconDatabase />
            <span>prod-ecommerce</span>
          </div>
          <div className="dp-sidebar__item">
            <IconDatabase />
            <span>analytics-db</span>
          </div>
        </aside>

        {/* Main panel */}
        <main className="dp-main">
          {/* Query bar */}
          <div className="dp-query-bar">
            <div className="dp-query-input">
              <span className="dp-query-label">Ask</span>
              <span className="dp-query-text">monthly revenue for the last 6 months</span>
            </div>
            <button className="dp-run-btn" tabIndex={-1} aria-hidden="true">Run</button>
          </div>

          {/* Answer explanation */}
          <p className="dp-explanation">
            Revenue grew steadily from Jan to May, peaking at <strong>$184k</strong> in May before a slight dip in June.
          </p>

          {/* Bar chart */}
          <div className="dp-chart">
            <div className="dp-chart__bars">
              {[
                { label: "Jan", h: 55, val: "$98k" },
                { label: "Feb", h: 68, val: "$122k" },
                { label: "Mar", h: 78, val: "$140k" },
                { label: "Apr", h: 88, val: "$158k" },
                { label: "May", h: 100, val: "$184k" },
                { label: "Jun", h: 90, val: "$162k" },
              ].map((bar) => (
                <div key={bar.label} className="dp-chart__col">
                  <span className="dp-chart__val">{bar.val}</span>
                  <div className="dp-chart__bar" style={{ height: `${bar.h}%` }} />
                  <span className="dp-chart__label">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SQL disclosure */}
          <div className="dp-sql-pill">
            <span className="dp-sql-pill__icon">{"<>"}</span>
            <span>SELECT month, SUM(amount) FROM orders GROUP BY month ORDER BY month</span>
          </div>

          {/* Attempt trail badge */}
          <div className="dp-badge dp-badge--success">
            ✓ Answered in 1.2 s &nbsp;·&nbsp; 6 rows &nbsp;·&nbsp; retrieved: orders, products
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Self-correction trail mockup ─────────────────────────────────────────── */
function LoopMockup() {
  const steps = [
    {
      attempt: 1,
      status: "fail",
      label: "hallucination",
      sql: "SELECT * FROM revenue_summary ...",
      note: "Table 'revenue_summary' does not exist",
    },
    {
      attempt: 2,
      status: "fail",
      label: "validation",
      sql: "SELECT month, revenue FROM ord_hdr ...",
      note: "Column 'revenue' not in schema",
    },
    {
      attempt: 3,
      status: "ok",
      label: "succeeded",
      sql: "SELECT DATE_TRUNC('month', created_at) AS month, SUM(total) FROM orders GROUP BY 1",
      note: "6 rows returned",
    },
  ];

  return (
    <div className="dp-loop">
      {steps.map((s, i) => (
        <div key={s.attempt} className="dp-loop__step">
          <div className="dp-loop__connector">
            <div className={`dp-loop__dot dp-loop__dot--${s.status}`} />
            {i < steps.length - 1 && <div className="dp-loop__line" />}
          </div>
          <div className="dp-loop__content">
            <div className="dp-loop__header">
              <span className="dp-loop__attempt">Attempt {s.attempt}</span>
              <span className={`dp-loop__badge dp-loop__badge--${s.status}`}>{s.label}</span>
            </div>
            <code className="dp-loop__sql">{s.sql}</code>
            <p className="dp-loop__note">{s.note}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="dp-page">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="dp-nav">
        <div className="dp-nav__inner">
          <Link href="/" className="dp-logo" aria-label="DataPilot home">
            <span className="dp-logo__icon" aria-hidden="true">⬡</span>
            <span className="dp-logo__text">DataPilot</span>
          </Link>
          <nav className="dp-nav__links" aria-label="Primary navigation">
            <a href="#how-it-works" className="dp-nav__link">How it works</a>
            <a href="#features" className="dp-nav__link">Features</a>
            <a href="#security" className="dp-nav__link">Security</a>
          </nav>
          <div className="dp-nav__actions">
            <Link href="/login" className="dp-btn dp-btn--ghost">Sign in</Link>
            <Link href="/signup" className="dp-btn dp-btn--primary">Get started</Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="dp-hero" aria-labelledby="hero-heading">
          <div className="dp-hero__inner">
            <div className="dp-hero__badge">
              <IconSparkle />
              <span>AI-powered · Self-correcting · Read-only safe</span>
            </div>

            <h1 id="hero-heading" className="dp-hero__headline">
              Ask your database
              <br />
              <span className="dp-hero__gradient">anything.</span>
            </h1>

            <p className="dp-hero__sub">
              Connect a PostgreSQL database. Type a question in plain English.
              DataPilot translates it into verified SQL, executes it safely,
              and renders the result as a chart — in seconds.
            </p>

            <div className="dp-hero__cta">
              <Link href="/signup" className="dp-btn dp-btn--primary dp-btn--lg">
                Connect your database
                <IconArrow />
              </Link>
              <Link href="/login" className="dp-btn dp-btn--ghost dp-btn--lg">
                Sign in
              </Link>
            </div>

            <div className="dp-hero__trust">
              <span className="dp-trust-item"><IconCheck /><span>No SQL knowledge needed</span></span>
              <span className="dp-trust-item"><IconCheck /><span>Read-only by design</span></span>
              <span className="dp-trust-item"><IconCheck /><span>Credentials encrypted at rest</span></span>
            </div>
          </div>

          {/* Product mockup */}
          <div className="dp-hero__preview">
            <ProductMockup />
          </div>
        </section>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="dp-divider" aria-hidden="true" />

        {/* ── Problem → Solution ────────────────────────────────────────── */}
        <section className="dp-section dp-section--alt" id="how-it-works" aria-labelledby="problem-heading">
          <div className="dp-container">
            <div className="dp-section__header">
              <span className="dp-eyebrow">The problem</span>
              <h2 id="problem-heading" className="dp-section__title">
                Your data is locked behind SQL.
              </h2>
              <p className="dp-section__sub">
                Every time a non-technical stakeholder needs a number, they open a Slack thread. Every time a developer needs a quick answer, they context-switch to a SQL editor. The bottleneck isn't the database — it's the language barrier.
              </p>
            </div>

            <div className="dp-compare">
              <div className="dp-compare__side">
                <div className="dp-compare__label dp-compare__label--before">Without DataPilot</div>
                <ul className="dp-compare__list dp-compare__list--before">
                  <li>Write SQL manually or ask a developer</li>
                  <li>Wait hours for a simple metric</li>
                  <li>Copy-paste data into Excel to chart it</li>
                  <li>Wrong table join? Start over</li>
                  <li>Credentials shared in Slack threads</li>
                </ul>
              </div>
              <div className="dp-compare__side">
                <div className="dp-compare__label dp-compare__label--after">With DataPilot</div>
                <ul className="dp-compare__list dp-compare__list--after">
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

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section className="dp-section" aria-labelledby="flow-heading">
          <div className="dp-container">
            <div className="dp-section__header">
              <span className="dp-eyebrow">How it works</span>
              <h2 id="flow-heading" className="dp-section__title">From question to insight in four steps.</h2>
            </div>

            <ol className="dp-flow" aria-label="Product workflow">
              {[
                {
                  n: "01",
                  title: "Connect your database",
                  desc: "Paste your PostgreSQL string. We automatically scan your schema and build a semantic map of every table.",
                  icon: <IconDatabase />,
                },
                {
                  n: "02",
                  title: "Ask in plain English",
                  desc: "Type any question about your data in plain English. No SQL or complicated filters required.",
                  icon: <IconSparkle />,
                },
                {
                  n: "03",
                  title: "AI generates and self-corrects",
                  desc: "The engine generates and validates SQL against your schema. If it fails, it auto-corrects up to 3 times.",
                  icon: <IconRefresh />,
                },
                {
                  n: "04",
                  title: "Results as charts, instantly",
                  desc: "Answers are instantly rendered as the optimal chart based on data shape. Raw tables are always available.",
                  icon: <IconChart />,
                },
              ].map((step) => (
                <li key={step.n} className="dp-flow__step">
                  <div className="dp-flow__num" aria-hidden="true">{step.n}</div>
                  <div className="dp-flow__icon">{step.icon}</div>
                  <h3 className="dp-flow__title">{step.title}</h3>
                  <p className="dp-flow__desc">{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Self-correction deep dive ──────────────────────────────────── */}
        <section className="dp-section dp-section--alt" aria-labelledby="loop-heading">
          <div className="dp-container dp-container--split">
            <div className="dp-split__text">
              <span className="dp-eyebrow">The engine</span>
              <h2 id="loop-heading" className="dp-section__title dp-section__title--left">
                It doesn't give up on the first try.
              </h2>
              <p className="dp-section__sub dp-section__sub--left">
                Most AI SQL tools hallucinate a query and silently fail. DataPilot runs a structured self-correction loop — each failed attempt feeds back into the next with the exact error, the real column list, and the schema context. The result: answers, not apologies.
              </p>
              <ul className="dp-feature-list">
                <li><IconCheck /><span>Detects hallucinated table and column names</span></li>
                <li><IconCheck /><span>Validates SQL against the real schema before execution</span></li>
                <li><IconCheck /><span>Blocks all non-SELECT queries at the security layer</span></li>
                <li><IconCheck /><span>Full attempt audit trail — you see every retry</span></li>
              </ul>
            </div>
            <div className="dp-split__visual">
              <LoopMockup />
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────── */}
        <section className="dp-section" id="features" aria-labelledby="features-heading">
          <div className="dp-container">
            <div className="dp-section__header">
              <span className="dp-eyebrow">Features</span>
              <h2 id="features-heading" className="dp-section__title">Built for the way data teams actually work.</h2>
            </div>

            <div className="dp-features-grid">
              {[
                {
                  icon: <IconSparkle />,
                  title: "Semantic table retrieval",
                  desc: "Uses embeddings to find the exact tables relevant to your question — even across databases with dozens of tables and cryptic names.",
                },
                {
                  icon: <IconChart />,
                  title: "Auto-chart selection",
                  desc: "Chart type is determined by result shape — deterministically. A bar chart when comparing categories. A line when trending over time. Never a random guess.",
                },
                {
                  icon: <IconRefresh />,
                  title: "Self-correcting loop",
                  desc: "Three-attempt correction loop with structured feedback. Each retry gets the actual error, the real schema, and a smarter prompt.",
                },
                {
                  icon: <IconDatabase />,
                  title: "Business-language schema summary",
                  desc: "Connect a database and DataPilot tells you what it's about in plain English — entities, row counts, date ranges, and suggested questions.",
                },
                {
                  icon: <IconShield />,
                  title: "Read-only enforcement",
                  desc: "Every query goes through a security layer that rejects anything that isn't a SELECT. Even if the model hallucinates a DROP TABLE, it never executes.",
                },
                {
                  icon: <IconLock />,
                  title: "Encrypted credentials",
                  desc: "Connection strings are AES-256 encrypted at rest. The plaintext is never stored or logged — decrypted only in memory, only when needed.",
                },
              ].map((f) => (
                <article key={f.title} className="dp-feature-card">
                  <div className="dp-feature-card__icon">{f.icon}</div>
                  <h3 className="dp-feature-card__title">{f.title}</h3>
                  <p className="dp-feature-card__desc">{f.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Security ──────────────────────────────────────────────────── */}
        <section className="dp-section dp-section--alt" id="security" aria-labelledby="security-heading">
          <div className="dp-container">
            <div className="dp-section__header">
              <span className="dp-eyebrow">Security</span>
              <h2 id="security-heading" className="dp-section__title">We take your data seriously.</h2>
              <p className="dp-section__sub">
                DataPilot was designed from day one with the assumption that your database contains sensitive production data.
              </p>
            </div>

            <div className="dp-security-grid">
              {[
                { title: "AES-256 encryption", desc: "Connection strings encrypted at rest. Decrypted in memory only during query execution." },
                { title: "Read-only sessions", desc: "Queries run on a read-only session. No INSERT, UPDATE, DELETE, DROP — ever." },
                { title: "SELECT enforcement", desc: "A security layer validates every generated query before it touches your database." },
                { title: "Credential verification", desc: "DataPilot checks whether your credential has write access and warns you if it does — and guides you to downgrade it." },
              ].map((s) => (
                <div key={s.title} className="dp-security-card">
                  <div className="dp-security-card__icon"><IconShield /></div>
                  <h3 className="dp-security-card__title">{s.title}</h3>
                  <p className="dp-security-card__desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ── User journey ──────────────────────────────────────────────── */}
        <section className="dp-section dp-section--alt" aria-labelledby="journey-heading">
          <div className="dp-container">
            <div className="dp-section__header">
              <span className="dp-eyebrow">Getting started</span>
              <h2 id="journey-heading" className="dp-section__title">You're three steps from your first insight.</h2>
            </div>

            <ol className="dp-journey" aria-label="Getting started steps">
              <li className="dp-journey__step">
                <div className="dp-journey__num">1</div>
                <h3 className="dp-journey__title">Create an account</h3>
                <p className="dp-journey__desc">Sign up in 30 seconds. No credit card required.</p>
              </li>
              <div className="dp-journey__arrow" aria-hidden="true">→</div>
              <li className="dp-journey__step">
                <div className="dp-journey__num">2</div>
                <h3 className="dp-journey__title">Connect your database</h3>
                <p className="dp-journey__desc">Paste a PostgreSQL connection string. DataPilot scans and summarises your schema.</p>
              </li>
              <div className="dp-journey__arrow" aria-hidden="true">→</div>
              <li className="dp-journey__step">
                <div className="dp-journey__num">3</div>
                <h3 className="dp-journey__title">Ask your first question</h3>
                <p className="dp-journey__desc">Try one of the AI-suggested questions or type your own. Get a chart in seconds.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────── */}
        <section className="dp-cta" aria-labelledby="cta-heading">
          <div className="dp-cta__inner">
            <h2 id="cta-heading" className="dp-cta__title">
              Your database is already full of answers.
            </h2>
            <p className="dp-cta__sub">
              DataPilot just helps you ask the questions.
            </p>
            <div className="dp-cta__actions">
              <Link href="/signup" className="dp-btn dp-btn--primary dp-btn--lg dp-btn--light">
                Get started — it&apos;s free
                <IconArrow />
              </Link>
              <Link href="/login" className="dp-btn dp-btn--ghost-light dp-btn--lg">
                Sign in
              </Link>
            </div>
            <p className="dp-cta__footnote">No SQL knowledge required. No credit card needed.</p>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="dp-footer">
        <div className="dp-footer__inner">
          <Link href="/" className="dp-logo dp-logo--footer" aria-label="DataPilot home">
            <span className="dp-logo__icon" aria-hidden="true">⬡</span>
            <span className="dp-logo__text">DataPilot</span>
          </Link>
          <p className="dp-footer__copy">© {new Date().getFullYear()} DataPilot. Talk to your data.</p>
          <nav className="dp-footer__links" aria-label="Footer navigation">
            <Link href="/login" className="dp-footer__link">Sign in</Link>
            <Link href="/signup" className="dp-footer__link">Sign up</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
