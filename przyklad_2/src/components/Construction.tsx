const callouts = [
  {
    id: "01",
    name: "CONTACT",
    body: "Independent lugs break the surface into readable points of pressure.",
  },
  {
    id: "02",
    name: "RETURN",
    body: "A divided midsole lets heel and forefoot respond as separate zones.",
  },
  {
    id: "03",
    name: "STABILIZE",
    body: "The smoky heel frame holds lateral movement without hiding the textile.",
  },
  {
    id: "04",
    name: "RECORD",
    body: "The acid line makes the route through the object visible.",
  },
];

export function Construction() {
  return (
    <section
      className="construction paper-section"
      id="construction"
      aria-labelledby="construction-title"
    >
      <div className="paper-noise" aria-hidden="true" />
      <div className="chapter-heading">
        <span className="chapter-mark" />
        <p>02 / CONSTRUCTION FIELD</p>
        <p>Concept object / not laboratory data</p>
      </div>
      <header className="construction-heading">
        <h2 id="construction-title">
          Built as a
          <em>recording surface.</em>
        </h2>
        <p>
          Four material events. One uninterrupted path through the object.
        </p>
      </header>
      <div className="construction-board">
        <div className="construction-figure">
          <div className="registration registration--a" aria-hidden="true" />
          <div className="registration registration--b" aria-hidden="true" />
          <img
            className="construction-product"
            src="/images/trc-01-outsole-cutout.webp"
            alt="Bottom view of the TRC-01 segmented traction system"
            width="1536"
            height="1024"
            loading="lazy"
          />
          <svg
            className="pressure-map"
            viewBox="0 0 1000 650"
            aria-hidden="true"
          >
            <path
              className="pressure-line"
              pathLength="1"
              d="M72 420C196 322 278 499 398 389s178-212 281-112 102 185 253 85"
            />
            <circle cx="72" cy="420" r="9" />
            <circle cx="398" cy="389" r="9" />
            <circle cx="679" cy="277" r="9" />
            <circle cx="932" cy="362" r="9" />
          </svg>
          <span className="construction-stamp" aria-hidden="true">
            TRC–01
            <small>OBJECT STUDY</small>
          </span>
        </div>
        <ol className="construction-callouts">
          {callouts.map((callout) => (
            <li className="construction-callout" key={callout.id}>
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
