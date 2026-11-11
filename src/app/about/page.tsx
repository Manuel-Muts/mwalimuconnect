import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About MwalimuConnect | Connecting teachers and schools",
  description:
    "Learn how MwalimuConnect helps teachers discover education opportunities and helps schools connect with educators across Kenya.",
};

export default function AboutPage() {
  return (
    <main className="landing-page landing-about-page">
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="MwalimuConnect home">
          <span className="landing-brand-mark"><span /></span>
          <span>mwalimu<span className="landing-brand-light">connect</span></span>
        </Link>
        <nav className="landing-links" aria-label="Main">
          <Link href="/#opportunities">Opportunities</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#schools">For schools</Link>
          <Link href="/about" aria-current="page">About</Link>
        </nav>
        <details className="landing-mobile-menu">
          <summary aria-label="Open site navigation"><span className="landing-menu-icon" aria-hidden="true"><i /><i /><i /></span><span>Menu</span></summary>
          <nav aria-label="Mobile site navigation">
            <Link href="/about" aria-current="page">About MwalimuConnect</Link>
            <Link href="/#opportunities">Opportunities</Link>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#schools">For schools</Link>
          </nav>
        </details>
        <div className="landing-header-actions">
          <Link className="landing-login" href="/">Home</Link>
          <Link className="landing-signup" href="/#home">Explore <span aria-hidden="true">↗</span></Link>
        </div>
      </header>

      <section className="landing-about-hero">
        <span className="landing-section-label">ABOUT MWALIMUCONNECT</span>
        <h1>Helping great teachers and schools find each other.</h1>
        <p>
          MwalimuConnect is a Kenya-focused platform for discovering teaching
          opportunities and helping schools connect with educators.
        </p>
      </section>

      <section className="landing-about-content" aria-labelledby="about-purpose-heading">
        <div className="landing-about-intro">
          <span className="landing-section-label">WHY WE&apos;RE HERE</span>
          <h2 id="about-purpose-heading">A clearer path to the right opportunity.</h2>
          <p>
            Finding a teaching role or the right educator can take time.
            MwalimuConnect brings opportunities and school hiring into one
            focused space, so teachers and institutions can take the next step
            with less friction.
          </p>
        </div>
        <div className="landing-about-cards">
          <article>
            <span className="landing-about-card-icon" aria-hidden="true">↗</span>
            <h3>For teachers</h3>
            <p>
              Explore teaching vacancies and education internships, build a
              professional profile, and apply to roles that fit your goals.
            </p>
            <p className="landing-about-note">
              Teacher accounts are free, with access based on your account and
              subscription settings.
            </p>
          </article>
          <article>
            <span className="landing-about-card-icon" aria-hidden="true">⌂</span>
            <h3>For schools</h3>
            <p>
              Share vacancies with educators and review applications in a
              dedicated school workspace.
            </p>
            <p className="landing-about-note">
              Institution features and vacancy publishing depend on an active
              school subscription.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-about-principles" aria-labelledby="about-principles-heading">
        <span className="landing-section-label">WHAT MATTERS TO US</span>
        <h2 id="about-principles-heading">Built around people and possibility.</h2>
        <div>
          <article><strong>Clarity</strong><p>Make opportunities and next steps easier to understand.</p></article>
          <article><strong>Connection</strong><p>Bring educators and schools closer together.</p></article>
          <article><strong>Community</strong><p>Support the people who help learners grow.</p></article>
        </div>
      </section>

      <section className="landing-about-cta">
        <span className="landing-section-label">TAKE THE NEXT STEP</span>
        <h2>Your next chapter starts with a connection.</h2>
        <p>Explore MwalimuConnect and see where it can take you.</p>
        <Link className="landing-primary" href="/#home">Explore the platform <span aria-hidden="true">↗</span></Link>
      </section>

      <footer className="landing-footer">
        <Link className="landing-brand" href="/" aria-label="MwalimuConnect home">
          <span className="landing-brand-mark"><span /></span>
          <span>mwalimu<span className="landing-brand-light">connect</span></span>
        </Link>
        <p>For the people who shape tomorrow.</p>
        <div>
          <Link href="/#opportunities">Opportunities</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/about" aria-current="page">About</Link>
        </div>
        <span className="landing-copyright">© {new Date().getFullYear()} MwalimuConnect</span>
      </footer>
    </main>
  );
}
