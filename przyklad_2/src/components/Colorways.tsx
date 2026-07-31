import { useState } from "react";
import { assetUrl } from "../lib/assetUrl";

const signals = {
  field: {
    index: "01",
    name: "FIELD SIGNAL",
    palette: "AUBERGINE / ACID",
    note: "The launch build: aubergine ripstop, acid contact rubber.",
    src: assetUrl("/images/trc-01-cutout.webp"),
    alt: "TRC-01 in aubergine ripstop with an acid-yellow trail outsole",
  },
  dust: {
    index: "02",
    name: "DUST INDEX",
    palette: "MINERAL / OXIDE",
    note: "Mineral upper, oxide tread. A palette pulled from dry ground.",
    src: assetUrl("/images/trc-01-dust-lateral-3q-cutout.webp"),
    alt: "TRC-01 in mineral sand with an oxide-orange trail outsole",
  },
  night: {
    index: "03",
    name: "NIGHT RETURN",
    palette: "GRAPHITE / ICE",
    note: "Graphite upper, ice tread. High contrast for the night study.",
    src: assetUrl("/images/trc-01-night-lateral-3q-cutout.webp"),
    alt: "TRC-01 in graphite black with an ice-blue trail outsole",
  },
} as const;

type Signal = keyof typeof signals;

export function Colorways() {
  const [signal, setSignal] = useState<Signal>("field");
  const selected = signals[signal];

  return (
    <section
      className={`colorways colorways--${signal}`}
      id="colorways"
      aria-labelledby="colorways-title"
    >
      <div className="colorway-grid" aria-hidden="true" />
      <div className="chapter-label">
        <span>05 / COLORWAY INDEX</span>
        <span>Three independent material renders</span>
      </div>
      <h2 id="colorways-title" className="colorway-heading">
        CHOOSE
        <em>the colorway</em>
      </h2>
      <figure className="colorway-stage">
        <span className="colorway-index" aria-hidden="true">
          {selected.index}
        </span>
        <div className="colorway-halo" aria-hidden="true" />
        <div className="colorway-product-stack">
          {(Object.keys(signals) as Signal[]).map((key) => (
            <img
              key={key}
              className={
                signal === key
                  ? "colorway-product is-active"
                  : "colorway-product"
              }
              src={signals[key].src}
              alt={signal === key ? signals[key].alt : ""}
              aria-hidden={signal !== key}
              width="1536"
              height="1024"
              loading="lazy"
            />
          ))}
        </div>
        <figcaption>
          <strong>{selected.name}</strong>
          <span>{selected.palette}</span>
          <p>{selected.note}</p>
        </figcaption>
      </figure>
      <div
        className="signal-selector"
        role="group"
        aria-labelledby="signal-selector-title"
      >
        <div className="signal-selector-heading">
          <p id="signal-selector-title">
            <i aria-hidden="true" />
            Choose a colorway
          </p>
          <span>Select to compare the full render</span>
        </div>
        {(Object.keys(signals) as Signal[]).map((key) => (
          <button
            key={key}
            type="button"
            className={signal === key ? "is-active" : ""}
            aria-pressed={signal === key}
            onClick={() => setSignal(key)}
            data-cursor="SELECT"
          >
            <span className="signal-option-index">{signals[key].index}</span>
            <span className="signal-option-name">
              {signals[key].name}
              <small>{signal === key ? "Now showing" : "Show colorway"}</small>
            </span>
            <span
              className={`signal-swatch signal-swatch--${key}`}
              aria-hidden="true"
            >
              <i />
              <i />
            </span>
          </button>
        ))}
      </div>
      <p className="colorway-note">
        Three separate material renders. No tint filters.
      </p>
      <p className="sr-only" aria-live="polite">
        {selected.name}, {selected.palette}, selected.
      </p>
    </section>
  );
}
