import { assetUrl } from "../lib/assetUrl";

export function FinalStatement() {
  return (
    <section
      className="final-statement"
      id="final"
      aria-labelledby="final-title"
    >
      <div className="final-visual">
        <div className="final-photo" aria-hidden="true">
          <picture>
            <source
              media="(max-width: 760px)"
              srcSet={assetUrl("/images/trc-01-sunset-campaign-mobile.webp")}
            />
            <img
              src={assetUrl("/images/trc-01-sunset-campaign.webp")}
              alt=""
              width="1536"
              height="1024"
              loading="lazy"
              decoding="async"
            />
          </picture>
        </div>
        <div className="final-grid" aria-hidden="true" />
        <div className="final-meta">
          <span>TRC-01 / FIELD SIGNAL</span>
          <span>DROP STUDY / 12.09.26</span>
        </div>
        <h2 id="final-title">
          <span className="final-line">
            <span>THE TRAIL</span>
          </span>
          <span className="final-line final-line--offset">
            <span>WRITES BACK.</span>
          </span>
        </h2>
        <p className="final-serif">Every lug leaves a coordinate.</p>
      </div>
      <div className="final-lockup">
        <div className="final-wordmark" aria-hidden="true">
          <img
            src={assetUrl("/images/sentracker-logo.webp")}
            alt=""
            width="2640"
            height="522"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
      <footer className="campaign-footer">
        <span>TRC-01 trail traction prototype</span>
        <span>The trail writes back.</span>
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
