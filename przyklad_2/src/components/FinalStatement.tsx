import { useState } from "react";

export function FinalStatement() {
  const [registered, setRegistered] = useState(false);

  return (
    <section
      className={registered ? "final-statement is-registered" : "final-statement"}
      id="final"
      aria-labelledby="final-title"
    >
      <div className="final-grid" aria-hidden="true" />
      <img
        className="final-outsole"
        src="/images/trc-01-outsole-cutout.webp"
        alt=""
        width="1536"
        height="1024"
        loading="lazy"
        aria-hidden="true"
      />
      <div className="final-meta">
        <span>TRC-01 / FIELD SIGNAL</span>
        <span>DROP STUDY / 12.09.26</span>
      </div>
      <h2 id="final-title">
        <span className="final-line">
          <span>LEAVE</span>
        </span>
        <span className="final-line final-line--offset">
          <span>PROOF.</span>
        </span>
      </h2>
      <p className="final-serif" aria-hidden="true">
        Every surface answers.
      </p>
      <button
        className="register-signal"
        type="button"
        onClick={() => setRegistered((value) => !value)}
        aria-pressed={registered}
        data-cursor={registered ? "CLEAR" : "ENTER"}
      >
        <span>{registered ? "SIGNAL REGISTERED" : "REGISTER THIS TRACE"}</span>
        <i aria-hidden="true" />
      </button>
      <p className="registration-status" aria-live="polite">
        {registered
          ? "Track 01 stored as a concept campaign signal."
          : "Presentation interface / no checkout attached."}
      </p>
      <div className="final-wordmark" aria-hidden="true">
        SEN<span>TR</span>ACKER
      </div>
      <footer className="campaign-footer">
        <span>Experimental footwear concept</span>
        <span>Motion leaves evidence.</span>
        <button
          type="button"
          onClick={() =>
            document.getElementById("top")?.scrollIntoView({ behavior: "smooth" })
          }
          data-cursor="TOP"
        >
          Return / 00
        </button>
      </footer>
    </section>
  );
}
