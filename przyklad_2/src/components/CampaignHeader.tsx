const chapters = [
  ["01", "TRACE", "movement"],
  ["02", "SYSTEM", "construction"],
  ["03", "FIELD", "terrain"],
  ["04", "MATTER", "focus"],
] as const;

export function CampaignHeader() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="campaign-header">
      <button
        className="wordmark"
        type="button"
        onClick={() => scrollTo("top")}
        data-cursor="TOP"
        aria-label="SENTRACKER — back to top"
      >
        SEN<span>TR</span>ACKER
      </button>
      <nav className="chapter-nav" aria-label="Campaign chapters">
        {chapters.map(([number, label, id]) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            data-cursor={number}
          >
            <sup>{number}</sup>
            {label}
          </button>
        ))}
      </nav>
      <div className="header-coordinates" aria-hidden="true">
        50°03′N / 19°56′E
      </div>
    </header>
  );
}
