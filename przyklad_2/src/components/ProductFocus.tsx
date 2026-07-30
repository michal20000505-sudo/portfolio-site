export function ProductFocus() {
  return (
    <section
      className="focus paper-section"
      id="focus"
      aria-labelledby="focus-title"
    >
      <div className="chapter-heading chapter-heading--focus">
        <span className="chapter-mark" />
        <p>04 / MATERIAL UNDER LOAD</p>
        <p>Macro inspection / 1:1</p>
      </div>
      <div className="focus-layout">
        <figure className="macro-figure">
          <img
            className="macro-image"
            src="/images/trc-01-macro.webp"
            alt="Macro detail of TRC-01 ripstop, lacing, heel frame and yellow pressure line"
            width="1536"
            height="1024"
            loading="lazy"
          />
          <figcaption>
            <span>Plate 04.A</span>
            Ripstop / TPU / segmented rubber
          </figcaption>
        </figure>
        <div className="focus-display" aria-hidden="true">
          <span>TEXTILE</span>
          <span>UNDER</span>
          <span className="focus-serif">tension.</span>
        </div>
        <div className="focus-copy">
          <span className="focus-index">04.07 / HEEL FRAME</span>
          <h2 id="focus-title">
            Ripstop flexes.
            <br />
            TPU holds.
          </h2>
          <p>
            Ripstop yields over the forefoot; the TPU frame checks lateral roll
            at the heel.
          </p>
        </div>
        <figure className="focus-exploded">
          <span className="focus-exploded-axis" aria-hidden="true" />
          <img
            className="focus-exploded-image"
            src="/images/trc-01-exploded-view.webp"
            alt="Exploded view of the TRC-01 upper, heel frame, midsole and lug outsole"
            width="1536"
            height="1024"
            loading="lazy"
            decoding="async"
          />
          <figcaption>
            <span>Plate 04.B</span>
            <span>Upper / brace / cushion / tread</span>
          </figcaption>
        </figure>
        <dl className="material-list">
          <div>
            <dt>01</dt>
            <dd>Aubergine ripstop</dd>
          </div>
          <div>
            <dt>02</dt>
            <dd>Smoked heel frame</dd>
          </div>
          <div>
            <dt>03</dt>
            <dd>Split EVA midsole</dd>
          </div>
          <div>
            <dt>04</dt>
            <dd>Acid contact rubber</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
