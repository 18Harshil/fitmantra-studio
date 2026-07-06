import {
  AbsoluteFill,
  Easing,
  Sequence,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const enterEase = Easing.bezier(0.16, 1, 0.3, 1);

type Broll = {
  fromMs: number;
  toMs: number;
  src: string;
  trimSeconds: number;
};

export const BROLLS: Broll[] = [
  { fromMs: 3700, toMs: 4900, src: "broll/muscle.mp4", trimSeconds: 3 },
  { fromMs: 5100, toMs: 5800, src: "broll/strength.mp4", trimSeconds: 0.5 },
  { fromMs: 6050, toMs: 7150, src: "broll/sleep.mp4", trimSeconds: 6 },
  { fromMs: 7400, toMs: 8500, src: "broll/mood.mp4", trimSeconds: 2 },
  { fromMs: 8800, toMs: 10800, src: "broll/energy.mp4", trimSeconds: 3 },
];

type ContentProps = {
  src: string;
  trimSeconds: number;
  durationMs: number;
};

const BrollContent: React.FC<ContentProps> = ({ src, trimSeconds, durationMs }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localMs = (frame / fps) * 1000;

  const fadeIn = interpolate(localMs, [0, 260], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(localMs, [durationMs - 260, durationMs], [1, 0], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#000" }} />

      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Video
          src={staticFile(src)}
          muted
          startFrom={Math.round(trimSeconds * fps)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "contrast(1.06) saturate(1.08) brightness(0.96)",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.4) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const BrollCard: React.FC<{ broll: Broll }> = ({ broll }) => {
  const { fps } = useVideoConfig();
  const compStartFrame = Math.round((broll.fromMs / 1000) * fps);
  const durationMs = broll.toMs - broll.fromMs;
  const compDuration = Math.round((durationMs / 1000) * fps);

  return (
    <Sequence
      from={compStartFrame}
      durationInFrames={compDuration}
      layout="none"
    >
      <BrollContent
        src={broll.src}
        trimSeconds={broll.trimSeconds}
        durationMs={durationMs}
      />
    </Sequence>
  );
};

export const FitMantraBroll: React.FC = () => (
  <>
    {BROLLS.map((b) => (
      <BrollCard key={b.fromMs} broll={b} />
    ))}
  </>
);
