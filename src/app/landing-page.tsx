"use client";

type LandingPageProps = {
  onBrowse: () => void;
  onSchools: () => void;
  onSignIn: () => void;
  onJoin: () => void;
  message: string;
};

export default function LandingPage({
  onBrowse,
  onSchools,
  onSignIn,
  onJoin,
  message,
}: LandingPageProps) {
  return (
    <main className="landing-page">
      {message && <div className="landing-notice" role="status">{message}</div>}
      <header className="landing-header">
        <a className="landing-brand" href="#home" aria-label="MwalimuConnect home">
          <span className="landing-brand-mark"><span /></span>
          <span>mwalimu<span className="landing-brand-light">connect</span></span>
        </a>
        <nav className="landing-links" aria-label="Main">
          <a href="#opportunities">Opportunities</a>
          <a href="#how-it-works">How it works</a>
          <button onClick={onSchools}>For schools</button>
        </nav>
        <div className="landing-header-actions">
          <button className="landing-login" onClick={onSignIn}>Log in</button>
          <button className="landing-signup" onClick={onJoin}>Join the community <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <section className="landing-hero" id="home">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><span /> KENYA&apos;S EDUCATION COMMUNITY</div>
          <h1>Good schools.<br />Great teachers.<br /><span>Brighter futures.</span></h1>
          <p className="landing-intro">The right opportunity can change everything. Find teaching vacancies—including positions where teachers are employed by a Board of Management (BOM)—and education internships in schools across Kenya.</p>
          <div className="landing-hero-actions">
            <button className="landing-primary" onClick={onBrowse}>Explore opportunities <span aria-hidden="true">↗</span></button>
            <button className="landing-secondary" onClick={onSchools}><span className="school-cta-icon" aria-hidden="true">⌂</span> I&apos;m a school</button>
          </div>
          <div className="landing-social-proof">
            <span>Made for educators.<br /><strong>Built around community.</strong></span>
          </div>
        </div>

        <div className="landing-visual" aria-label="Illustration of teachers and learners in a classroom">
          <div className="visual-orbit orbit-outer" />
          <div className="visual-orbit orbit-inner" />
          <svg className="classroom-art" viewBox="0 0 520 470" role="img" aria-labelledby="classroom-title">
            <title id="classroom-title">A teacher and students learning together</title>
            <path d="M92 443V179c0-79 62-143 139-143h151c58 0 105 48 105 106v301H92Z" fill="#F0EAD8" />
            <path d="M129 442V181c0-57 46-103 103-103h93v364H129Z" fill="#E4EAD9" />
            <path d="M326 79h56c48 0 88 39 88 88v275H326V79Z" fill="#E8DFCB" />
            <path d="M147 164h161v125H147z" rx="8" fill="#21513C" />
            <path d="M165 184h53M165 201h83M165 218h64" stroke="#E8E8CE" strokeWidth="5" strokeLinecap="round" />
            <path d="m270 183 15 15-15 15" fill="none" stroke="#E6B77D" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M162 289h131" stroke="#AE9878" strokeWidth="8" strokeLinecap="round" />
            <path d="M177 300v20m100-20v20" stroke="#AE9878" strokeWidth="7" strokeLinecap="round" />
            <path d="M355 149v119m67-119v119" stroke="#B9B19D" strokeWidth="5" strokeLinecap="round" />
            <path d="M345 268h86" stroke="#B9B19D" strokeWidth="7" strokeLinecap="round" />
            <path d="m353 151 35-29 34 29" fill="#D6A36B" />
            <rect x="359" y="152" width="56" height="48" rx="3" fill="#F7F1DE" />
            <path d="M369 164h35m-35 11h29m-29 11h22" stroke="#9D8166" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="273" cy="414" rx="186" ry="25" fill="#D8D6C4" />
            <path d="M199 406c2-48 18-73 44-73s42 25 44 73" fill="#D38A62" />
            <path d="M221 357c2-20 11-31 23-31s21 11 23 31" fill="#292F2B" />
            <path d="M213 376c5 16 15 24 31 24s27-8 31-24l-4-25h-54l-4 25Z" fill="#805C43" />
            <path d="M205 406c4-26 16-39 36-39s32 13 36 39v9h-72v-9Z" fill="#477A5C" />
            <path d="M207 395 183 411m93-16 20 15" stroke="#805C43" strokeWidth="10" strokeLinecap="round" />
            <path d="M233 359h4m19 0h4" stroke="#32291F" strokeWidth="4" strokeLinecap="round" />
            <path d="M230 371c5 5 13 5 18 0" fill="none" stroke="#A95845" strokeWidth="3" strokeLinecap="round" />
            <path d="M130 404c2-36 13-54 32-54s30 18 32 54" fill="#DBB45F" />
            <path d="M145 358c1-16 7-24 17-24s16 8 17 24" fill="#332F29" />
            <path d="M139 377c4 11 11 16 23 16s20-5 23-16l-3-19h-41l-2 19Z" fill="#A77551" />
            <path d="M136 403c3-20 12-29 27-29s24 9 27 29v8h-54v-8Z" fill="#D08B68" />
            <path d="M141 396 125 410m48-14 17 14" stroke="#A77551" strokeWidth="8" strokeLinecap="round" />
            <path d="M347 405c2-36 13-54 32-54s30 18 32 54" fill="#7286A0" />
            <path d="M362 359c1-16 7-24 17-24s16 8 17 24" fill="#302C28" />
            <path d="M356 378c4 11 11 16 23 16s20-5 23-16l-3-19h-41l-2 19Z" fill="#9A684A" />
            <path d="M353 404c3-20 12-29 27-29s24 9 27 29v8h-54v-8Z" fill="#7286A0" />
            <path d="M358 396 342 410m48-14 17 14" stroke="#9A684A" strokeWidth="8" strokeLinecap="round" />
            <path d="m286 329 10-19 10 19m-10-19v37" fill="none" stroke="#D8A26E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="406" cy="313" r="13" fill="#D6A16B" />
            <path d="M406 292v-10m0 62v-10m21-21h10m-62 0h10m36-15 7-7m-44 44 7-7m30 0 7 7m-44-44 7 7" stroke="#D6A16B" strokeWidth="4" strokeLinecap="round" />
            <path d="m118 320 8-15 8 15m-8-15v26" fill="none" stroke="#6D9471" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="visual-tag tag-opportunity"><span className="tag-icon">↗</span><span><strong>Find your next step</strong><small>Opportunities, all in one place</small></span></div>
          <div className="visual-tag tag-school"><span className="tag-school-mark">✓</span><span><strong>Schools that care</strong><small>Education starts with people</small></span></div>
          <span className="visual-spark spark-one">✳</span>
          <span className="visual-spark spark-two">✳</span>
        </div>
      </section>

      <section className="landing-pathways" aria-label="Opportunities for every stage">
        <div className="pathways-intro"><span>ONE COMMUNITY, EVERY CLASSROOM</span><strong>From the first little learners<br />to the next generation of leaders.</strong></div>
        <div className="pathway-chips"><span>ECDE / Early Years</span><span>Lower Primary</span><span>Upper Primary</span><span>JSS</span><span>Senior School</span></div>
      </section>

      <section className="landing-opportunities" id="opportunities">
        <div className="landing-section-heading">
          <div><span className="landing-section-label">A GOOD PLACE TO BEGIN</span><h2>Opportunities with<br /><em>meaning.</em></h2></div>
          <div className="landing-heading-aside"><p>Sign in to see verified teaching vacancies—including BOM-employed teaching positions—and education internships in your county.</p><button className="landing-text-link" onClick={onBrowse}>Sign in to browse <span aria-hidden="true">↗</span></button></div>
        </div>
        <div className="landing-job-grid">
          <article className="landing-job-card landing-job-1">
            <div className="landing-job-top"><span className="landing-job-category">MEMBER ACCESS</span></div>
            <h3>Opportunities that fit your community.</h3>
            <p>Create an account to browse live listings in your county.</p>
            <div className="landing-job-footer"><span>Teacher accounts are free</span><button onClick={onBrowse}>Sign in <span aria-hidden="true">→</span></button></div>
          </article>
        </div>
      </section>

      <section className="landing-how" id="how-it-works">
        <div className="landing-how-heading">
          <span className="landing-section-label">A LITTLE LESS SEARCHING. A LOT MORE POSSIBILITY.</span>
          <h2>Good things happen<br />when we <em>connect.</em></h2>
        </div>
        <div className="landing-steps">
          <article><span className="step-number">01</span><span className="step-icon">⌕</span><h3>Find your fit</h3><p>Sign in to browse live school opportunities in your county.</p></article>
          <article><span className="step-number">02</span><span className="step-icon">↗</span><h3>Put yourself forward</h3><p>Create your profile and apply directly to schools that feel right.</p></article>
          <article><span className="step-number">03</span><span className="step-icon">✳</span><h3>Make a difference</h3><p>Meet the people and learners who will grow with you.</p></article>
        </div>
      </section>

      <section className="landing-school-cta" id="schools">
        <div className="school-cta-decoration" aria-hidden="true"><span>✳</span><span>↗</span><span>✳</span></div>
        <div className="school-cta-copy"><span className="landing-section-label">FOR SCHOOL LEADERS</span><h2>Great educators are<br />out there. <em>Let&apos;s find them.</em></h2><p>Bring your school to a community of teachers ready to make a difference.</p></div>
        <button className="school-cta-button" onClick={onSchools}>Find talent for your school <span aria-hidden="true">↗</span></button>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="#home" aria-label="MwalimuConnect home">
          <span className="landing-brand-mark"><span /></span>
          <span>mwalimu<span className="landing-brand-light">connect</span></span>
        </a>
        <p>For the people who shape tomorrow.</p>
        <div><a href="#opportunities">Opportunities</a><a href="#how-it-works">How it works</a><button onClick={onSignIn}>Your account</button></div>
        <span className="landing-copyright">© 2026 MwalimuConnect</span>
      </footer>
    </main>
  );
}
