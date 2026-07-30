export function Movement() {
  return (
    <section
      className="movement"
      id="movement"
      aria-labelledby="movement-title"
    >
      <div className="movement-stage">
        <div className="movement-grid" aria-hidden="true" />
        <div className="chapter-label chapter-label--light">
          <span>01 / TRAJECTORY</span>
          <span>Input: body / Output: trace</span>
        </div>
        <h2 id="movement-title" className="movement-title">
          <span>FROM</span>
          <span>ZERO</span>
          <em>to signal</em>
        </h2>
        <svg
          className="movement-trajectory"
          viewBox="0 0 1600 900"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="trajectory-path"
            pathLength="1"
            d="M-100 715C160 690 330 226 604 342c258 109 276 447 540 318 168-82 240-305 556-387"
          />
          <path
            className="trajectory-guide"
            d="M-100 715C160 690 330 226 604 342c258 109 276 447 540 318 168-82 240-305 556-387"
          />
        </svg>
        <div className="movement-product-wrap">
          <img
            className="movement-ghost movement-ghost--two"
            src="/images/trc-01-cutout.webp"
            alt=""
            width="1536"
            height="1024"
            loading="lazy"
            aria-hidden="true"
          />
          <img
            className="movement-ghost movement-ghost--one"
            src="/images/trc-01-cutout.webp"
            alt=""
            width="1536"
            height="1024"
            loading="lazy"
            aria-hidden="true"
          />
          <img
            className="movement-product"
            src="/images/trc-01-cutout.webp"
            alt="TRC-01 following a recorded yellow trajectory"
            width="1536"
            height="1024"
            loading="lazy"
          />
        </div>
        <div className="telemetry-rail telemetry-rail--left" aria-hidden="true">
          <span>REST / 00</span>
          <span>LOAD / 17</span>
          <span>SHIFT / 41</span>
          <span>TRACE / 78</span>
          <span>FIELD / 99</span>
        </div>
        <div className="telemetry-rail telemetry-rail--right" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <p className="movement-copy">
          Contact is brief.
          <br />
          The record remains.
        </p>
        <span className="movement-axis" aria-hidden="true">
          X / 0.00 → 1.00
        </span>
      </div>
    </section>
  );
}
