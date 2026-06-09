import React from 'react';

const checklist = [
  ['DONE', 'Scope frozen', 'Cairo/Giza and five low-risk categories only.'],
  ['DONE', 'Payments safe', 'No escrow or platform-held funds during beta.'],
  ['OPERATOR', 'Verification queue', 'Review every specialist request within 48 hours.'],
  ['OPERATOR', 'Emergency operator', 'One trusted person knows the pause switch, queue, disputes, waitlist, and playbook.'],
  ['OPERATOR', 'Stop conditions', 'Pause onboarding after 3 unresolved disputes, any safety incident, or fast-rising abuse.'],
  ['DONE', 'Public policy visible', 'Users can read payment, dispute, and verification rules before joining.'],
  ['DONE', 'Admin alerts', 'Disputes, verification requests, onboarding pauses, abuse events, and failed critical workflows create admin alerts.'],
  ['OPERATOR', 'Monitoring proof', 'Trigger one harmless Sentry test event after production deploy and confirm environment/release tags.'],
  ['DELAYED', 'Real payments', 'Keep payments off-platform until the founder returns.'],
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
        {checklist.map(([status, title, detail], index) => (
          <article key={title} className="launch-checklist-row">
            <span>{index + 1}</span>
            <div>
              <strong>{title}</strong>
              <em>{status}</em>
              <p>{detail}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
