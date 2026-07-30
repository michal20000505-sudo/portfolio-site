export function TerrainShift() {
  return (
    <section className="terrain" id="terrain" aria-labelledby="terrain-title">
      <div className="terrain-stage">
        <img
          className="terrain-image"
          src="/images/trc-01-terrain.webp"
          alt="TRC-01 crossing from wet asphalt onto loose pale gravel"
          width="1536"
          height="1024"
          loading="lazy"
        />
        <div className="terrain-shade" aria-hidden="true" />
        <div className="terrain-scan" aria-hidden="true" />
        <h2 id="terrain-title" className="sr-only">
          Surface transition: wet asphalt to loose gravel
        </h2>
        <p
          className="terrain-word terrain-word--city"
          aria-hidden="true"
        >
          CITY
        </p>
        <p className="terrain-word terrain-word--field" aria-hidden="true">
          FIELD
        </p>
        <div className="terrain-copy">
          <span>03 / SURFACE CHANGE</span>
          <p>
            Asphalt breaks into gravel.
            <br />
            The tread keeps reading.
          </p>
        </div>
        <div className="terrain-index" aria-hidden="true">
          <span>ASPHALT</span>
          <i />
          <span>GRAVEL</span>
        </div>
        <span className="terrain-coordinate" aria-hidden="true">
          TR / 50.0614 / 19.9383
        </span>
      </div>
    </section>
  );
}
