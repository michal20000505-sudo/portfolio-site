import shoeVideoSrc from "../../video/shoe-scroll.mp4";
import { previewMode } from "../lib/previewMode";
import { LiquidGlassText } from "./LiquidGlassText";

export function TerrainShift() {
  return (
    <section className="terrain" id="terrain" aria-labelledby="terrain-title">
      <div className="terrain-stage">
        <video
          className="terrain-image terrain-scroll-video"
          src={shoeVideoSrc}
          aria-label="SENTRACKER TRC-01 trail shoe moving across an alpine ridge"
          role="img"
          width="1920"
          height="1080"
          preload={previewMode ? "none" : "auto"}
          muted
          playsInline
          disablePictureInPicture
        />
        <div className="terrain-shade" aria-hidden="true" />
        <div className="terrain-scan" aria-hidden="true" />
        <h2 id="terrain-title" className="sr-only">
          Surface transition: wet asphalt to loose gravel
        </h2>
        <LiquidGlassText className="terrain-word terrain-word--city">
          CITY
        </LiquidGlassText>
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
