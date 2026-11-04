import Link from 'next/link';

export default function ExtensionPrivacyPage() {
  return (
    <div className="bb-page">
      <article className="bb-panel mx-auto max-w-3xl p-6 md:p-10">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-accent">Bench Boss ESPN Sync</p>
        <h1 className="text-3xl font-semibold text-ink">Extension privacy policy</h1>
        <p className="mt-3 text-sm text-muted">Effective November 3, 2026</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-ink-2">
          <section>
            <h2 className="text-lg font-semibold text-ink">Single purpose</h2>
            <p className="mt-2">The extension connects a league selected by the user on ESPN Fantasy Hockey to their Bench Boss account so Bench Boss can import and refresh league settings, teams, and rosters.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Data the extension handles</h2>
            <p className="mt-2">Only after the user gives consent and clicks the connection button, the extension reads the ESPN league identifier from the current page and the ESPN authentication cookies named <code>espn_s2</code> and <code>SWID</code>. It does not read passwords, browsing history, unrelated cookies, or page content outside the ESPN hockey connection flow.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">How the data is used and protected</h2>
            <p className="mt-2">The credentials are transmitted only to <strong>benchboss.pro</strong> over HTTPS, used only to request the user’s fantasy league data from ESPN, and encrypted at rest with AES-256-GCM. Credentials are never sold, used for advertising, or shared with unrelated third parties. Bench Boss personnel do not read authentication data except when strictly necessary for security or legal compliance.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Retention and deletion</h2>
            <p className="mt-2">Credentials remain encrypted while the connected team exists. Removing the team from Bench Boss deletes the stored league record and its credentials. A user may also request account deletion through the support page.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Chrome Web Store Limited Use</h2>
            <p className="mt-2">The use of information received from browser APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink">Contact</h2>
            <p className="mt-2">Questions or deletion requests can be submitted through the <Link href="/support" className="text-accent underline">Bench Boss support page</Link>.</p>
          </section>
        </div>
      </article>
    </div>
  );
}
