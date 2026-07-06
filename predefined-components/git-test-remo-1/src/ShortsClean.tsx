import { AbsoluteFill, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { ShortsCleanCaptions } from "./ShortsCleanCaptions";
import { TopicVisuals } from "./TopicVisuals";

export const ShortsClean: React.FC = () => {
  const FG_W = 1080;
  const FG_H = Math.round((1080 * 656) / 464);

  return (
    <AbsoluteFill style={{ background: "#0a0a0a", overflow: "hidden" }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Video
          src={staticFile("source.mp4")}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scale(1.5)",
            filter: "blur(56px) brightness(0.4) saturate(1.1)",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: FG_W,
            height: FG_H,
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
          }}
        >
          <Video
            src={staticFile("source.mp4")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "contrast(1.07) saturate(1.05) brightness(1.04)",
            }}
          />
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.45) 100%)",
          pointerEvents: "none",
        }}
      />

      <TopicVisuals />

      <ShortsCleanCaptions />
    </AbsoluteFill>
  );
};
