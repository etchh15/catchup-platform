import React from 'react';

const sections = [
  {
    title: 'Controlled Beta Scope',
    items: [
      'CatchUp is operating a controlled Cairo/Alexandria beta.',
      'Supported categories are Cleaning, Tutoring, Beauty, Moving help, and Simple repairs.',
      'Services outside this scope may be rejected or deferred.',
    ],
  },
  {
    title: 'Payments During Beta',
    items: [
      'CatchUp records agreed amount, delivery state, and completion records.',
      'CatchUp does not hold funds, provide escrow, guarantee payment, or process refunds during beta.',
      'Clients and specialists arrange payment directly and should keep proof of payment.',
    ],
  },
  {
    title: 'Verification',
    items: [
      'Specialists must be manually reviewed before sending proposals.',
      'Verification means CatchUp reviewed profile evidence; it is not a guarantee of outcome.',
      'CatchUp may reject, pause, or remove accounts that create trust or safety concerns.',
    ],
  },
  {
    title: 'Specialist ID Documents',
    items: [
      'First-time specialists must upload a clear government ID document before specialist review.',
      'ID documents are stored privately and are visible only to the platform admin for verification review.',
      'CatchUp uses the ID document to reduce anonymous marketplace risk; it does not publish, sell, or share ID photos with clients or specialists.',
      'During beta, rejected specialist ID documents may be removed after review or within 30 days; approved specialist ID records are retained only while needed for marketplace trust and account safety.',
    ],
  },
  {
    title: 'Disputes And Safety',
    items: [
      'Workspace messages, agreement details, scheduling, delivery, and evidence may be reviewed for disputes.',
      'CatchUp can pause workspaces, restrict accounts, or record abuse events when safety or fraud risk appears.',
      'Emergency, medical, legal, and high-risk services are not part of the beta.',
    ],
  },
];

export default function BetaPolicyPage({ onBackHome, onOpenAuth }) {
  return (
    <main className="policy-page">
      <nav className="public-nav" aria-label="Policy navigation">
        <button type="button" className="public-brand" onClick={onBackHome}>
          <span className="public-brand-mark">C</span>
          <span>CatchUp</span>
        </button>
        <button type="button" className="btn btn-secondary" onClick={onOpenAuth}>
          Sign in
        </button>
      </nav>

      <header className="policy-hero">
        <span className="public-kicker">Beta trust policy</span>
        <h1>Clear rules for a controlled local-services marketplace.</h1>
        <p>
          These rules keep CatchUp closer to Airbnb/Uber marketplace discipline:
          limited launch scope, reviewed supply, documented transactions, and operational stop conditions.
        </p>
      </header>

      <section className="policy-section-grid">
        {sections.map((section) => (
          <article key={section.title} className="policy-card">
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </section>

      <section className="policy-footer-panel">
        <strong>Beta promise</strong>
        <p>
          CatchUp is designed to reduce marketplace chaos. If trust signals become unclear,
          the platform may slow or pause onboarding before scaling demand.
        </p>
      </section>
    </main>
  );
}
