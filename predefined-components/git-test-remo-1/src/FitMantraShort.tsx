import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { FitMantraLogo } from "./FitMantraLogo";
import { FitMantraBroll } from "./FitMantraBroll";
import { FitMantraReelsCaptions } from "./FitMantraReelsCaptions";
import { BrandOutro, OUTRO_DURATION_SECONDS } from "./BrandOutro";

const enterEase = Easing.bezier(0.16, 1, 0.3, 1);

const SPEECH_END_FRAME = 384;
const OUTRO_START_FRAME = 384;
const OUTRO_DURATION_FRAMES = Math.round(OUTRO_DURATION_SECONDS * 30);
const TOTAL_FRAMES = OUTRO_START_FRAME + OUTRO_DURATION_FRAMES;

const TopRightLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0, 0.6 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        right: 56,
        opacity: enter,
        transform: `scale(${0.85 + enter * 0.15})`,
        filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.5))",
      }}
    >
      <FitMantraLogo size={160} />
    </div>
  );
};

const MainContent: React.FC = () => {
  return (
    <>
      <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
        <Video
          src={staticFile("source-clean.mp4")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "contrast(1.08) saturate(1.08) brightness(1.04)",
          }}
        />
      </AbsoluteFill>

      <FitMantraBroll />
      <FitMantraReelsCaptions />
    </>
  );
};

export const FitMantraShort: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const mainExitFade = interpolate(
    frame,
    [OUTRO_START_FRAME - 0.4 * fps, OUTRO_START_FRAME],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <Sequence durationInFrames={SPEECH_END_FRAME + 12} layout="none">
        <AbsoluteFill style={{ opacity: mainExitFade }}>
          <MainContent />
        </AbsoluteFill>
      </Sequence>

      <Sequence
        from={OUTRO_START_FRAME}
        durationInFrames={OUTRO_DURATION_FRAMES}
        layout="none"
      >
        <BrandOutro />
      </Sequence>

      <Sequence durationInFrames={OUTRO_START_FRAME} layout="none">
        <TopRightLogo />
      </Sequence>
    </AbsoluteFill>
  );
};

export { TOTAL_FRAMES as FIT_MANTRA_TOTAL_FRAMES };
