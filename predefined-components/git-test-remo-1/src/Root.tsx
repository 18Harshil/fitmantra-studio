import "./index.css";
import { Composition } from "remotion";
import { CoffeeAd } from "./CoffeeAd";
import { ShortsEdit } from "./ShortsEdit";
import { ShortsClean } from "./ShortsClean";
import { FitMantraShort, FIT_MANTRA_TOTAL_FRAMES } from "./FitMantraShort";
import { PcosReels, PCOS_REELS_TOTAL_FRAMES } from "./PcosReels";
import { PcosVitaminD, PCOS_VITAMIND_TOTAL_FRAMES } from "./PcosVitaminD";
import { TripleTrimReel, TRIPLE_TRIM_TOTAL_FRAMES } from "./TripleTrimReel";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PcosVitaminD"
        component={PcosVitaminD}
        durationInFrames={PCOS_VITAMIND_TOTAL_FRAMES}
        fps={30}
        width={392}
        height={848}
      />
    </>
  );
};
