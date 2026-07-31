import { useState } from "react";
import { assetUrl } from "../lib/assetUrl";

const callouts = [
  {
    id: "01",
    name: "CONTACT",
    body: "Independent lugs bite at separate points, keeping contact on broken ground.",
    x: "27%",
    y: "39%",
  },
  {
    id: "02",
    name: "RETURN",
    body: "Split cushioning lets heel strike and toe-off compress on their own timing.",
    x: "52%",
    y: "58%",
  },
  {
    id: "03",
    name: "STABILIZE",
    body: "Smoked TPU braces the heel when the trail falls away sideways.",
    x: "75%",
    y: "51%",
  },
  {
    id: "04",
    name: "TRACE",
    body: "The acid sidewall line traces force from impact to release.",
    x: "40%",
    y: "47%",
  },
];

export function Construction() {
  const [activeCallout, setActiveCallout] = useState(0);

  return (
    <section
      className="construction paper-section"
      id="construction"
      aria-labelledby="construction-title"
    >
      <div className="paper-noise" aria-hidden="true" />
      <div className="chapter-heading">
        <span className="chapter-mark" />
        <p>02 / CONTACT SYSTEM</p>
        <p>Design prototype / field claims unverified</p>
      </div>
      <header className="construction-heading">
        <h2 id="construction-title">
          Built to read
          <em>the ground.</em>
        </h2>
        <p>
          Four working zones carry load from heel strike to toe-off.
        </p>
      </header>
      <div className="construction-board">
        <div className="construction-figure">
          <div className="registration registration--a" aria-hidden="true" />
          <div className="registration registration--b" aria-hidden="true" />
          <div className="construction-product-stage">
            <img
              className="construction-product"
              src={assetUrl("/images/trc-01-outsole-cutout.webp")}
              alt="Bottom view of the TRC-01 segmented traction system"
              width="1536"
              height="1024"
              loading="lazy"
            />
            {callouts.map((callout, index) => (
              <button
                key={callout.id}
                type="button"
                className={
                  activeCallout === index
                    ? "construction-hotspot is-active"
                    : "construction-hotspot"
                }
                style={{ left: callout.x, top: callout.y }}
                aria-label={`${callout.id}. ${callout.name}`}
                aria-pressed={activeCallout === index}
                onClick={() => setActiveCallout(index)}
                onFocus={() => setActiveCallout(index)}
                onPointerEnter={() => setActiveCallout(index)}
                data-label={callout.name}
                data-cursor="INSPECT"
              >
                <span>{callout.id}</span>
              </button>
            ))}
          </div>
          <span className="construction-stamp" aria-hidden="true">
            TRC–01
            <small>TRACTION STUDY</small>
          </span>
        </div>
        <ol className="construction-callouts">
          {callouts.map((callout, index) => (
            <li
              className={
                activeCallout === index
                  ? "construction-callout is-active"
                  : "construction-callout"
              }
              key={callout.id}
              onPointerEnter={() => setActiveCallout(index)}
            >
              <span>{callout.id}</span>
              <h3>{callout.name}</h3>
              <p>{callout.body}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className="construction-footer" aria-hidden="true">
        <span>UPPER / FRAME / MIDSOLE / CONTACT</span>
        <span>ST—TRC—01—A</span>
      </div>
    </section>
  );
}
