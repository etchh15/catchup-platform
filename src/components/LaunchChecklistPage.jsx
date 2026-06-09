import React from 'react';

const checklist = [
  ['Scope frozen', 'Cairo/Giza and five low-risk categories only.'],
  ['Payments safe', 'No escrow or platform-held funds during beta.'],
  ['Verification queue clear', 'No specialist should wait more than 48 hours for review.'],
  ['Emergency operator ready', 'One trusted person knows admin access, pause switch, and playbook.'],
  ['Disputes monitored', 'No more than 3 unresolved disputes before pausing onboarding.'],
  ['Public policy visible', 'Users can read payment, dispute, and verification rules before joining.'],
  ['Monitoring configured', 'Sentry environment and release details are configured for production.'],
  ['Quality gate passed', '`npm run verify` passes before deploy.'],
];

export default function LaunchChecklistPage({ onBackHome, onOpenAuth }) {
  return (
    <main className="policy-page launch-checklist-page">
      <nav className="public-nav" aria-label="Checklist navigation">
        <button type="button" className="public-brand" onClick={onBackHome}>
          <span className="public-brand-mark">C</span>
          <span>CatchUp</span>
        </button>
        <button type="button" className="btn btn-secondary" onClick={onOpenAuth}>
          Sign in
        </button>
      </nav>

      <header className="policy-hero">
        <span className="public-kicker">Founder-away checklist</span>
        <h1>Before you go offline, every box should be boringly true.</h1>
        <p>
          This is the one-page operational check for keeping CatchUp controlled,
          trust-led, and recoverable while you are away.
        </p>
      </header>

      <section className="launch-checklist">
        {checklist.map(([title, detail], index) => (
          <article key={title} className="launch-checklist-row">
            <span>{index + 1}</span>
            <div>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
