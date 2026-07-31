import { useEffect, useRef, useState } from "react";
import { CampaignHeader } from "./components/CampaignHeader";
import { Colorways } from "./components/Colorways";
import { Construction } from "./components/Construction";
import { FinalStatement } from "./components/FinalStatement";
import { Hero } from "./components/Hero";
import { Movement } from "./components/Movement";
import { Preloader } from "./components/Preloader";
import { ProductFocus } from "./components/ProductFocus";
import { TerrainShift } from "./components/TerrainShift";
import { TrackerCursor } from "./components/TrackerCursor";
import { previewMode } from "./lib/previewMode";
import { useCampaignMotion } from "./lib/useCampaignMotion";

export default function App() {
  const appRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useCampaignMotion(appRef, ready, previewMode);

  useEffect(() => {
    if (!ready || previewMode) return;

    const targetId = window.location.hash.slice(1);
    if (!targetId) return;

    const frame = requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    });

    return () => cancelAnimationFrame(frame);
  }, [ready]);

  return (
    <div
      ref={appRef}
      className={ready ? "campaign is-ready" : "campaign"}
    >
      <a className="skip-link" href="#campaign-main">
        Skip to campaign
      </a>
      <Preloader onReady={() => setReady(true)} />
      {previewMode ? null : <TrackerCursor />}
      <CampaignHeader />
      <main id="campaign-main">
        <Hero />
        <Movement />
        <Construction />
        <TerrainShift />
        <ProductFocus />
        <Colorways />
        <FinalStatement />
      </main>
    </div>
  );
}
