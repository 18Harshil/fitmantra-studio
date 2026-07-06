import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { whoosh } from "@remotion/sfx";
import { loadFont } from "@remotion/google-fonts/Inter";
import { ShortsCaptions } from "./ShortsCaptions";

const { fontFamily } = loadFont("normal", {
  weights: ["800", "900"],
  subsets: ["latin"],
});

const enterEase = Easing.bezier(0.16, 1, 0.3, 1);

const PHRASE_STARTS_MS = [0, 2710, 3440, 5040, 5920, 7280, 8630, 10980];

const findPhraseStart = (timeMs: number) => {
  let phraseStart = 0;
  for (const s of PHRASE_STARTS_MS) {
    if (timeMs >= s) phraseStart = s;
    else break;
  }
  return phraseStart;
};

const PunchZoom: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tMs = (frame / fps) * 1000;
  const phraseStart = findPhraseStart(tMs);
  const localMs = tMs - phraseStart;

  const punch = interpolate(localMs, [0, 220, 600], [1.0, 1.055, 1.0], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${punch})`,
        transformOrigin: "50% 50%",
      }}
    >
      {children}
    </div>
  );
};

const HookBadge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [2.4 * fps, 2.9 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter - exit;
  if (opacity <= 0) return null;
  const pulse = 1 + Math.sin(frame / 9) * 0.025;
  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${(1 - enter) * -24}px)`,
      }}
    >
      <div
        style={{
          padding: "16px 36px",
          background: "linear-gradient(180deg, #FFE600 0%, #F5B500 100%)",
          borderRadius: 999,
          fontFamily,
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: 4,
          color: "#1a1308",
          boxShadow: "0 14px 40px rgba(0,0,0,0.55), inset 0 -3px 0 rgba(0,0,0,0.15)",
          transform: `scale(${pulse})`,
        }}
      >
        ⚡ MUST WATCH
      </div>
    </div>
  );
};

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: 90,
        height: 8,
        borderRadius: 999,
        background: "rgba(255,255,255,0.18)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: "linear-gradient(90deg, #FFE600 0%, #39E508 100%)",
          boxShadow: "0 0 20px rgba(255,230,0,0.7)",
        }}
      />
    </div>
  );
};

export const ShortsEdit: React.FC = () => {
  const { fps } = useVideoConfig();
  const FG_W = 1080;
  const FG_H = Math.round((1080 * 656) / 464);

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Video
          src={staticFile("source.mp4")}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scale(1.6)",
            filter: "blur(48px) brightness(0.42) saturate(1.25)",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <PunchZoom>
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                width: FG_W,
                height: FG_H,
                borderRadius: 36,
                overflow: "hidden",
                boxShadow:
                  "0 32px 80px rgba(0,0,0,0.65), 0 0 0 2px rgba(255,255,255,0.06)",
              }}
            >
              <Video
                src={staticFile("source.mp4")}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter:
                    "contrast(1.12) saturate(1.18) brightness(1.06)",
                }}
              />
            </div>
          </AbsoluteFill>
        </PunchZoom>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,200,120,0.08) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(20,10,30,0.18) 100%)",
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />

      <HookBadge />

      {PHRASE_STARTS_MS.slice(1).map((startMs, i) => (
        <Sequence
          key={i}
          from={Math.round((startMs / 1000) * fps)}
          durationInFrames={Math.round(0.5 * fps)}
          layout="none"
        >
          <Audio src={whoosh} volume={0.18} />
        </Sequence>
      ))}

      <ShortsCaptions />

      <ProgressBar />
    </AbsoluteFill>
  );
};
