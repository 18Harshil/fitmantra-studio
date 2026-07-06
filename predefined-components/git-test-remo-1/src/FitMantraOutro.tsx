import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FitMantraLogo } from "./FitMantraLogo";

const enterEase = Easing.bezier(0.16, 1, 0.3, 1);

export const FitMantraOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const bgIn = interpolate(frame, [0, 0.3 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoIn = interpolate(frame, [0.1 * fps, 0.7 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoScale = interpolate(frame, [0.1 * fps, 0.7 * fps], [0.75, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const finalFade = interpolate(
    frame,
    [durationInFrames - 0.4 * fps, durationInFrames - 1],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity: finalFade, pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(160deg, #062E15 0%, #0F4A22 55%, #134F22 100%)",
          opacity: bgIn,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,255,0,0.14) 0%, transparent 60%)",
          opacity: bgIn,
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            opacity: logoIn,
            transform: `scale(${logoScale})`,
            filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.55))",
          }}
        >
          <FitMantraLogo size={620} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
