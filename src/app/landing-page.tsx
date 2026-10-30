"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type LandingPageProps = {
  onBrowse: () => void;
  onSchools: () => void;
  onSignIn: () => void;
  onJoin: () => void;
  message: string;
};

type LandingSlide = {
  src: string;
  alt: string;
  caption: string;
};

const classroomSlides: LandingSlide[] = [
  {
    src: "/images/classroom-african-class.jpg",
    alt: "Black teachers and learners gathered in a classroom",
    caption: "A classroom full of possibility",
  },
  {
    src: "/images/teacher-african-guidance.jpg",
    alt: "A Black teacher leading students in a classroom lesson",
    caption: "Every learner ready to grow",
  },
  {
    src: "/images/teacher-african-participation.jpg",
    alt: "A Black teacher encouraging a student to participate in class",
    caption: "Support that opens new doors",
  },
];

function LandingCarousel({
  slides,
  label,
  className,
}: {
  slides: LandingSlide[];
  label: string;
  className: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(motionPreference.matches);
    updateMotionPreference();
    motionPreference.addEventListener("change", updateMotionPreference);
    return () => motionPreference.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || slides.length < 2) return;
    const intervalId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion, slides.length]);

  return (
    <div className={`landing-carousel ${className}`} role="region" aria-roledescription="carousel" aria-label={label}>
      {slides.map((slide, index) => (
        <div
          className={`landing-carousel-slide${index === activeIndex ? " is-active" : ""}`}
          key={slide.src}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${slides.length}: ${slide.caption}`}
          aria-hidden={index !== activeIndex}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            sizes="100vw"
            priority={className === "hero-carousel" && index === 0}
          />
        </div>
      ))}
    </div>
  );
}

function LandingPhoneShowcase() {
  const [activeScreen, setActiveScreen] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(motionPreference.matches);
    updateMotionPreference();
    motionPreference.addEventListener("change", updateMotionPreference);
    return () => motionPreference.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const intervalId = window.setInterval(() => {
      setActiveScreen((screen) => (screen + 1) % 7);
    }, 3200);
    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion]);

  const screenClass = (index: number) => `landing-phone-screen${activeScreen === index ? " is-active" : ""}`;

  return (
    <div className="landing-phone-showcase" role="img" aria-label="Animated preview of teacher sign-up, sign-in code verification, and the Discover, Applications, and Saved workspace tabs">
      <div className="landing-phone-glow" aria-hidden="true" />
      <div className="landing-phone">
        <div className="landing-phone-frame">
          <div className="landing-phone-status"><span>9:41</span><i /><i /><i /></div>
          <div className="landing-phone-brand">
            <span className="landing-brand-mark landing-phone-brand-mark"><span /></span>
            <span className="landing-phone-wordmark">mwalimu<span className="landing-brand-light">connect</span></span>
            <svg className="landing-connect-animation landing-phone-connect-animation" viewBox="0 0 48 24" aria-hidden="true">
              <circle className="landing-socket" cx="12" cy="12" r="8" />
              <circle className="landing-socket-slots" cx="10" cy="9" r="1" />
              <circle className="landing-socket-slots" cx="14" cy="15" r="1" />
              <g className="landing-plug">
                <path className="landing-plug-prongs" d="M25 9h-5m5 6h-5" />
                <rect className="landing-plug-body" x="25" y="6" width="10" height="12" rx="4" />
                <path className="landing-plug-cord" d="M35 12h2c2 0 3 1 3 3v2" />
              </g>
              <circle className="landing-connect-spark" cx="19" cy="12" r="1.5" />
            </svg>
          </div>
          <div className="landing-phone-screen-area" aria-hidden="true">
            <div className={`${screenClass(0)} landing-phone-signup-screen`}>
              <span className="landing-phone-kicker">YOUR NEXT CHAPTER</span>
              <h3>Create your account</h3>
              <p>Join Kenya&apos;s teacher community.</p>
              <div className="landing-phone-field">Full name</div>
              <div className="landing-phone-field">Email address</div>
              <div className="landing-phone-field">County <span>Select county</span></div>
              <div className="landing-phone-field">Create password <span>••••••••</span></div>
              <div className="landing-phone-button">Create account</div>
              <small>Already a member? <b>Sign in</b></small>
            </div>
            <div className={screenClass(1)}>
              <span className="landing-phone-kicker">WELCOME TO MWALIMUCONNECT</span>
              <h3>Your account is ready</h3>
              <p>Your teacher profile is set up. Sign in anytime to explore teaching opportunities.</p>
              <div className="landing-phone-button">Explore opportunities</div>
              <small>Start your next chapter with MwalimuConnect.</small>
            </div>
            <div className={screenClass(2)}>
              <span className="landing-phone-kicker">WELCOME BACK</span>
              <h3>Sign in securely</h3>
              <p>Pick up where your next chapter begins.</p>
              <div className="landing-phone-field">Email address</div>
              <div className="landing-phone-field">Password <span>••••••••</span></div>
              <div className="landing-phone-button">Sign in</div>
              <small>We&apos;ll email you a code to finish signing in.</small>
            </div>
            <div className={screenClass(3)}>
              <span className="landing-phone-kicker">SECURE SIGN-IN</span>
              <h3>Check your email</h3>
              <p>Enter the six-digit sign-in code we sent you.</p>
              <div className="landing-phone-code"><i>4</i><i>8</i><i>2</i><i>1</i><i>6</i><i>3</i></div>
              <div className="landing-phone-button">Verify and sign in</div>
              <small>This one-time code keeps your account secure.</small>
            </div>
            <div className={screenClass(4)}>
              <span className="landing-phone-kicker">MADE FOR EDUCATORS</span>
              <h3>Find your next opportunity</h3>
              <div className="landing-phone-search">⌕ &nbsp; Search by role or school</div>
              <div className="landing-phone-vacancy"><b>Primary Teacher</b><span>Green Valley School</span><small>Nairobi · Lower Primary</small></div>
              <div className="landing-phone-vacancy"><b>ECDE Educator</b><span>Bright Start Academy</span><small>Kiambu · Early Years</small></div>
              <div className="landing-phone-vacancy"><b>Teaching Intern</b><span>Horizon Learning Centre</span><small>Nakuru · JSS</small></div>
            </div>
            <div className={screenClass(5)}>
              <span className="landing-phone-kicker">YOUR JOB SEARCH</span>
              <h3>Applications</h3>
              <p>Keep track of your recent applications.</p>
              <div className="landing-phone-vacancy"><b>Primary Teacher</b><span>Green Valley School</span><small className="landing-phone-status-pill">Application sent · 2 days ago</small></div>
              <div className="landing-phone-vacancy"><b>ECDE Educator</b><span>Bright Start Academy</span><small className="landing-phone-status-pill is-reviewing">Under review · 1 week ago</small></div>
              <div className="landing-phone-vacancy"><b>Teaching Intern</b><span>Horizon Learning Centre</span><small className="landing-phone-status-pill">Application sent · 1 week ago</small></div>
            </div>
            <div className={screenClass(6)}>
              <span className="landing-phone-kicker">OPPORTUNITIES TO REVISIT</span>
              <h3>Saved jobs</h3>
              <p>Your shortlist, ready when you are.</p>
              <div className="landing-phone-vacancy"><b>Primary Teacher</b><span>Green Valley School</span><small>Nairobi · Saved today</small></div>
              <div className="landing-phone-vacancy"><b>Science Teacher</b><span>Lakeview Academy</span><small>Kisumu · Saved yesterday</small></div>
              <div className="landing-phone-vacancy"><b>ECDE Educator</b><span>Bright Start Academy</span><small>Kiambu · Saved 3 days ago</small></div>
            </div>
          </div>
          <div className="landing-phone-nav">
            <span className={activeScreen === 4 ? "is-active" : ""}>Discover</span>
            <span className={activeScreen === 5 ? "is-active" : ""}>Applications</span>
            <span className={activeScreen === 6 ? "is-active" : ""}>Saved</span>
          </div>
        </div>
      </div>
      <span className="landing-phone-caption">From sign-up to your next opportunity.</span>
    </div>
  );
}

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
          <svg className="landing-connect-animation" viewBox="0 0 48 24" aria-hidden="true">
            <circle className="landing-socket" cx="12" cy="12" r="8" />
            <circle className="landing-socket-slots" cx="10" cy="9" r="1" />
            <circle className="landing-socket-slots" cx="14" cy="15" r="1" />
            <g className="landing-plug">
              <path className="landing-plug-prongs" d="M25 9h-5m5 6h-5" />
              <rect className="landing-plug-body" x="25" y="6" width="10" height="12" rx="4" />
              <path className="landing-plug-cord" d="M35 12h2c2 0 3 1 3 3v2" />
            </g>
            <circle className="landing-connect-spark" cx="19" cy="12" r="1.5" />
          </svg>
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
          <p className="landing-intro">Find teaching opportunities and education internships in schools across Kenya.</p>
          <div className="landing-hero-actions">
            <button className="landing-primary" onClick={onBrowse}>Explore opportunities <span aria-hidden="true">↗</span></button>
            <button className="landing-secondary" onClick={onSchools}><span className="school-cta-icon" aria-hidden="true">⌂</span> I&apos;m a school</button>
          </div>
          <div className="landing-social-proof">
            <span>Made for educators.<br /><strong>Built around community.</strong></span>
          </div>
        </div>

        <div className="landing-visual">
          <LandingCarousel slides={classroomSlides} label="Teachers and learners in the classroom" className="hero-carousel" />
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
        <div className="landing-opportunities-showcase">
          <div className="landing-job-grid">
            <article className="landing-job-card landing-job-1">
              <div className="landing-job-top"><span className="landing-job-category">MEMBER ACCESS</span></div>
              <h3>Opportunities that fit your community.</h3>
              <p>Create an account to browse live listings in your county.</p>
              <div className="landing-job-footer"><span>Teacher accounts are free</span><button onClick={onBrowse}>Sign in <span aria-hidden="true">→</span></button></div>
            </article>
          </div>
          <LandingPhoneShowcase />
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
        <div className="school-cta-image" aria-hidden="true">
          <Image
            src="/images/classroom-african-class.jpg"
            alt=""
            fill
            sizes="100vw"
          />
        </div>
        <div className="school-cta-decoration" aria-hidden="true"><span>✳</span><span>↗</span><span>✳</span></div>
        <div className="school-cta-copy"><span className="landing-section-label">FOR SCHOOL LEADERS</span><h2>Find the teachers<br />who help learners thrive.</h2><button className="school-cta-button" onClick={onSchools}>Find talent for your school <span aria-hidden="true">↗</span></button></div>
      </section>

      <section className="landing-contact" id="contact" aria-labelledby="landing-contact-title">
        <div className="landing-contact-orbit" aria-hidden="true" />
        <div className="landing-contact-inner">
          <div className="landing-contact-copy">
            <span className="landing-contact-kicker">HERE WHEN YOU NEED US</span>
            <h2 id="landing-contact-title">Let&apos;s make a<br /><em>connection.</em></h2>
            <p>Questions, feedback, or need a hand? We&apos;d love to hear from you.</p>
          </div>
          <div className="landing-contact-options">
            <a className="landing-contact-card" href="tel:0769190048">
              <span className="landing-contact-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M7.2 3.8h2.5l1.2 4.1-1.8 1.7a15 15 0 0 0 5.3 5.3l1.7-1.8 4.1 1.2v2.5c0 1.1-.9 2-2 2C10 18.8 5.2 14 5.2 5.8c0-1.1.9-2 2-2Z" />
                </svg>
              </span>
              <span className="landing-contact-detail"><small>TEXT OR CALL</small><strong>0769 190 048</strong><span>We&apos;re happy to help <i aria-hidden="true">↗</i></span></span>
            </a>
            <a className="landing-contact-card" href="mailto:info@competencehub.co.ke">
              <span className="landing-contact-icon landing-contact-icon-email" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
                  <path d="m5 7 7 5.5L19 7" />
                </svg>
              </span>
              <span className="landing-contact-detail"><small>DROP US AN EMAIL</small><strong>info@competencehub.co.ke</strong><span>We&apos;ll get back to you <i aria-hidden="true">↗</i></span></span>
            </a>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="#home" aria-label="MwalimuConnect home">
          <span className="landing-brand-mark"><span /></span>
          <span>mwalimu<span className="landing-brand-light">connect</span></span>
        </a>
        <p>For the people who shape tomorrow.</p>
        <div><a href="#opportunities">Opportunities</a><a href="#how-it-works">How it works</a><button onClick={onSignIn}>Your account</button></div>
        <span className="landing-copyright">© {new Date().getFullYear()} MwalimuConnect</span>
      </footer>
      <a className="landing-whatsapp-link" href="https://wa.me/254717747895" target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 3.1A12.6 12.6 0 0 0 5.2 22.2L3.5 28.5l6.5-1.7A12.6 12.6 0 1 0 16 3.1Z" />
          <path d="M12.1 9.2c-.3-.7-.6-.7-.9-.7h-.8c-.3 0-.7.1-1 .5-.3.4-1.3 1.3-1.3 3.1s1.3 3.6 1.5 3.8c.2.3 2.5 4 6.2 5.4 3.1 1.2 3.7 1 4.4.9.7-.1 2.3-.9 2.6-1.8.3-.9.3-1.6.2-1.8-.1-.2-.3-.3-.7-.5l-2.5-1.2c-.3-.1-.6-.2-.8.2-.2.3-.9 1.2-1.1 1.5-.2.2-.4.3-.8.1-.4-.2-1.7-.6-3.2-2-.9-.8-1.5-1.8-1.7-2.2-.2-.4 0-.6.2-.8l.6-.7c.2-.2.3-.4.4-.6.1-.2 0-.5 0-.7l-1.3-2.6Z" />
        </svg>
      </a>
    </main>
  );
}
