import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { FitMantraCaptions } from "../brand/FitMantraCaptions";
import type { RemotionData } from "../types";
import { FitMantraReelsCaptions } from "../brand/FitMantraReelsCaptions";
import { BrandOutro, OUTRO_DURATION_SECONDS } from "../brand/BrandOutro";

const PIP_TRANSITION = 24;
const PIP_SCALE = 0.28;
const PIP_MARGIN = 40;

interface Props {
  data: RemotionData;
}

export const MainVideo: React.FC<Props> = ({ data }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const bodyFrames = Math.ceil(data.video.duration_seconds * fps);
  const outroSeconds = data.outro?.duration_seconds ?? OUTRO_DURATION_SECONDS;


  const outroFrames = Math.max(0, Math.round(outroSeconds * fps));
  const isReel = height > width;

  const pipEvents = data.pip_events ?? [];
  const activePip = pipEvents.find((p) => {
    const startFrame = p.timestamp * fps;
    const endFrame = (p.timestamp + p.duration) * fps;
    return frame >= startFrame - PIP_TRANSITION && frame < endFrame + PIP_TRANSITION;
  });

  const format = activePip?.pip_format ?? "pip";
  const isFull = activePip && format === "full";

  let pipProgress = 0;
  if (activePip) {
    const pipStartFrame = activePip.timestamp * fps;
    const pipEndFrame = (activePip.timestamp + activePip.duration) * fps;

    if (frame < pipStartFrame) {
      pipProgress = interpolate(
        frame,
        [pipStartFrame - PIP_TRANSITION, pipStartFrame],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.ease),
        },
      );
    } else if (frame > pipEndFrame) {
      pipProgress = interpolate(
        frame,
        [pipEndFrame, pipEndFrame + PIP_TRANSITION],
        [1, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.ease),
        },
      );
    } else {
      pipProgress = 1;
    }
  }

  const scale = interpolate(pipProgress, [0, 1], [1.0, PIP_SCALE]);
  const pipWidth = width * PIP_SCALE;
  const pipHeight = height * PIP_SCALE;
  const tX = interpolate(pipProgress, [0, 1], [0, width - pipWidth - PIP_MARGIN]);
  const tY = interpolate(pipProgress, [0, 1], [0, height - pipHeight - PIP_MARGIN]);
  const bgOpacity = interpolate(
    pipProgress,
    [0, 0.4, 1],
    [0, 0.3, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>

      {/* Layer 1 — Full-screen secondary content during PiP (broll or black) */}
      {activePip && activePip.pip_source === "black" && (
        <AbsoluteFill
          style={{
            backgroundColor: "#000",
            opacity: bgOpacity,
          }}
        />
      )}
      {activePip && activePip.pip_source !== "black" && (
        <Sequence
          from={Math.round(activePip.timestamp * fps) - PIP_TRANSITION}
          durationInFrames={Math.round(activePip.duration * fps) + PIP_TRANSITION * 2}
          layout="none"
        >
          <AbsoluteFill>
            {/\.(png|jpe?g|webp)$/i.test(activePip.pip_source) ? (
              <Img
                key={activePip.pip_source}
                src={staticFile(activePip.pip_source)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <OffthreadVideo
                key={activePip.pip_source}
                src={staticFile(activePip.pip_source)}
                volume={0}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}
          </AbsoluteFill>
        </Sequence>
      )}

      {/* Layer 2 — Speaker video (hidden during full format, audio still plays) */}
      <AbsoluteFill
        style={{
          transformOrigin: "0 0",
          transform: `translate(${tX}px, ${tY}px) scale(${scale})`,
          borderRadius: pipProgress > 0 ? 12 : 0,
          overflow: "hidden",
          boxShadow:
            pipProgress > 0
              ? "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)"
              : "none",
          opacity: isFull ? 0 : 1,
        }}
      >
        <OffthreadVideo
          src={staticFile(data.video.src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter:
              data.video.video_filter === "none"
                ? "none"
                : data.video.video_filter || "brightness(1.15) contrast(1.2)",
          }}
        />
      </AbsoluteFill>



      {/* Layer 2c — Logo top-right (hidden during outro) */}
      {frame < bodyFrames && (
        <Img
          src={staticFile("logo.png")}
          style={{
            position: "absolute",
            top: Math.round(height * 0.0315),
            right: Math.round(height * 0.0315),
            width: Math.round(height * 0.11),
            height: Math.round(height * 0.11),
            objectFit: "contain",
            zIndex: 10,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Layer 3 — Visual polish gradients */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.0) 35%)",
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "linear-gradient(0deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.0) 40%)",
        }}
      />

      {/* Layer 5 — Captions */}
      {isReel ? (
        <FitMantraReelsCaptions
          captionsSrc={data.captions_src}
          highlightKeywords={data.highlight_keywords}
          capitalizeWords={data.capitalize_words}
          pipActive={!!activePip}
          verticalOffset={data.captions_offset ?? 0}
        />
      ) : (
        <FitMantraCaptions
          captionsSrc={data.captions_src}
          highlightKeywords={data.highlight_keywords}
          capitalizeWords={data.capitalize_words}
          pipActive={!!activePip}
          verticalOffset={data.captions_offset ?? 0}
        />
      )}


      {/* Layer 7 — Outro appended */}
      {outroFrames > 0 ? (
        <Sequence from={bodyFrames} durationInFrames={outroFrames} layout="none">
          <BrandOutro src="visuals/trimmed_with_fade.mp4" />
        </Sequence>
      ) : null}

    </AbsoluteFill>
  );
};
