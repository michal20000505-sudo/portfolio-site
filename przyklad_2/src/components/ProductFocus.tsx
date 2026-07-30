export function ProductFocus() {
  return (
    <section
      className="focus paper-section"
      id="focus"
      aria-labelledby="focus-title"
    >
      <div className="chapter-heading chapter-heading--focus">
        <span className="chapter-mark" />
        <p>04 / MATERIAL EVIDENCE</p>
        <p>Close reading / 1:1</p>
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
          <span>MATTER</span>
          <span>KEEPS</span>
          <span className="focus-serif">score.</span>
        </div>
        <div className="focus-copy">
          <span className="focus-index">04—07 / FRAME JOINT</span>
          <h2 id="focus-title">
            Nothing smooth.
            <br />
            Nothing accidental.
          </h2>
          <p>
            Woven fields meet hard geometry. The frame stays visible because the
            transition is the product.
          </p>
        </div>
        <div className="focus-crop">
          <img
            src="/images/trc-01-cutout.webp"
            alt="Side profile detail of the TRC-01 forefoot"
            width="1536"
            height="1024"
            loading="lazy"
          />
          <span aria-hidden="true">PLATE 04.B / CONTACT EDGE</span>
        </div>
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
            <dd>Acid contact rubber</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
