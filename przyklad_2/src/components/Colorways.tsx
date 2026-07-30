import { useState } from "react";

const signals = {
  field: {
    index: "01",
    name: "FIELD SIGNAL",
    palette: "AUBERGINE / ACID",
    note: "The original trace.",
  },
  dust: {
    index: "02",
    name: "DUST INDEX",
    palette: "MINERAL / OXIDE",
    note: "A dry surface record.",
  },
  night: {
    index: "03",
    name: "NIGHT RETURN",
    palette: "GRAPHITE / ICE",
    note: "A low-light response.",
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
        <span>05 / SIGNAL VARIANTS</span>
        <span>One object / three environments</span>
      </div>
      <h2 id="colorways-title" className="colorway-heading">
        SELECT
        <em>the signal</em>
      </h2>
      <figure className="colorway-stage" aria-live="polite">
        <span className="colorway-index" aria-hidden="true">
          {selected.index}
        </span>
        <div className="colorway-halo" aria-hidden="true" />
        <img
          className="colorway-product"
          src="/images/trc-01-cutout.webp"
          alt={`TRC-01 in the ${selected.name} color environment`}
          width="1536"
          height="1024"
          loading="lazy"
        />
        <figcaption>
          <strong>{selected.name}</strong>
          <span>{selected.palette}</span>
          <p>{selected.note}</p>
        </figcaption>
      </figure>
      <div className="signal-selector" role="group" aria-label="Select color signal">
        {(Object.keys(signals) as Signal[]).map((key) => (
          <button
            key={key}
            type="button"
            className={signal === key ? "is-active" : ""}
            aria-pressed={signal === key}
            onClick={() => setSignal(key)}
            data-cursor="SELECT"
          >
            <span>{signals[key].index}</span>
            {signals[key].name}
            <i aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="colorway-note">
        Color studies are campaign visualizations of one fictional concept object.
      </p>
    </section>
  );
}
