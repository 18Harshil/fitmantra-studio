import {
  useCurrentFrame,
  AbsoluteFill,
  Img,
  Video,
  staticFile,
  interpolate,
  Easing,
  Sequence,
} from "remotion";
import type { BrollOverlay } from "../types";

interface Props {
  fps: number;
  overlay: BrollOverlay;
}

const enterEase = Easing.bezier(0.16, 1, 0.3, 1);

const BrollContent: React.FC<{
  overlay: BrollOverlay;
  durationMs: number;
  fps: number;
}> = ({ overlay, durationMs, fps }) => {
  const frame = useCurrentFrame();
  const localMs = (frame / fps) * 1000;

  const fadeIn = interpolate(localMs, [0, 180], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(localMs, [durationMs - 180, durationMs], [1, 0], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Full opacity — no dimming multiplier
  const opacity = Math.min(fadeIn, fadeOut);

  const scale = interpolate(localMs, [0, durationMs], [1.0, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#000" }} />

      <AbsoluteFill style={{ overflow: "hidden" }}>
        <AbsoluteFill
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {overlay.src.endsWith(".mp4") ? (
            <Video
              src={staticFile(overlay.src)}
              muted
              // Pexels clips are pre-trimmed to 4s; always play from the
              // very start of the downloaded file. trim_seconds is kept for
              // legacy compatibility with older ai-generated clips.
              startFrom={Math.round((overlay.trim_seconds ?? 0) * fps)}
              // Never let buffering stall the video — keep playing regardless
              pauseWhenBuffering={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: overlay.object_position ?? "center center",
                filter: "contrast(1.06) saturate(1.08) brightness(0.97)",
              }}
            />
          ) : (
            <Img
              src={staticFile(overlay.src)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: overlay.object_position,
                filter: "contrast(1.06) saturate(1.08) brightness(0.96)",
              }}
            />
          )}
        </AbsoluteFill>
      </AbsoluteFill>

      {/* Vignette — softens edges, keeps center clear */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, " +
            "transparent 50%, rgba(0,0,0,0.4) 100%)",
        }}
      />

    </AbsoluteFill>
  );
};

export const BRoll: React.FC<Props> = ({ overlay, fps }) => {
  const fromFrame = Math.round((overlay.from_ms / 1000) * fps);
  const durationMs = Math.max(0, overlay.to_ms - overlay.from_ms);
  const durationInFrames = Math.max(0, Math.round((durationMs / 1000) * fps));

  if (!overlay.src || durationInFrames <= 0) {
    return null;
  }

  return (
    <Sequence from={fromFrame} durationInFrames={durationInFrames} layout={"none"}>
      <BrollContent overlay={overlay} durationMs={durationMs} fps={fps} />
    </Sequence>
  );
};
