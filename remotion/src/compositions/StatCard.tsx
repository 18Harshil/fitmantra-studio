import {
  useCurrentFrame,
  AbsoluteFill,
  interpolate,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import type { StatOverlay } from "../types";

const { fontFamily } = loadFont("normal", {
  weights: ["700", "800"],
  subsets: ["latin"],
});

interface Props {
  stat: StatOverlay;
  fps: number;
}

export const StatCard: React.FC<Props> = ({ stat, fps }) => {
  const frame = useCurrentFrame();
  const currentTime = frame / fps;

  const end = stat.timestamp + stat.duration;

  if (currentTime < stat.timestamp || currentTime > end) {
    return null;
  }

  const statFrame = frame - stat.timestamp * fps;
  const totalStatFrames = stat.duration * fps;
  const FADE_FRAMES = 8;
  const SLIDE_FRAMES = 12;

  // Slide in from above
  const translateY = interpolate(
    statFrame,
    [0, SLIDE_FRAMES],
    [-40, 0],
    {
      easing: Easing.out(Easing.back(1.2)),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Fade in and out
  const opacity = interpolate(
    statFrame,
    [0, FADE_FRAMES, totalStatFrames - FADE_FRAMES, totalStatFrames],
    [0, 1, 1, 0],
    {
      easing: Easing.ease,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: "35%",
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(6,46,21,0.88) 0%, rgba(15,74,34,0.85) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: 16,
          borderLeft: "4px solid #00FF00",
          paddingTop: 20,
          paddingBottom: 20,
          paddingLeft: 36,
          paddingRight: 36,
          maxWidth: "78%",
          textAlign: "center",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <span
          style={{
            fontSize: stat.large ? 60 : 44,
            fontFamily,
            fontWeight: 800,
            color: "#FFFFFF",
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            lineHeight: 1.3,
          }}
        >
          {stat.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
