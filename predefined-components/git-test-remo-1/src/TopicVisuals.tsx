import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Lora";

const { fontFamily } = loadFont("normal", {
  weights: ["500"],
  subsets: ["latin"],
});

const ICON_COLOR = "rgba(255,255,255,0.95)";
const LABEL_COLOR = "rgba(255,255,255,0.88)";

const Muscle: React.FC = () => (
  <svg viewBox="0 0 100 100" fill={ICON_COLOR}>
    <path d="M 12 66 Q 12 44 30 44 Q 46 44 52 56 Q 58 66 72 64 Q 88 62 88 50 Q 88 38 78 38 Q 68 38 64 46 Q 50 50 35 45 Q 12 46 12 66 Z" />
  </svg>
);

const Barbell: React.FC = () => (
  <svg viewBox="0 0 100 50" stroke={ICON_COLOR} strokeWidth="4.5" fill="none" strokeLinecap="round">
    <line x1="22" y1="25" x2="78" y2="25" />
    <line x1="14" y1="14" x2="14" y2="36" />
    <line x1="22" y1="9" x2="22" y2="41" />
    <line x1="78" y1="9" x2="78" y2="41" />
    <line x1="86" y1="14" x2="86" y2="36" />
  </svg>
);

const Moon: React.FC = () => (
  <svg viewBox="0 0 100 100" fill={ICON_COLOR}>
    <path d="M 72 12 A 40 40 0 1 0 88 78 A 30 30 0 1 1 72 12 Z" />
  </svg>
);

const Smile: React.FC = () => (
  <svg viewBox="0 0 100 100" stroke={ICON_COLOR} strokeWidth="4.5" fill="none" strokeLinecap="round">
    <circle cx="50" cy="50" r="40" />
    <circle cx="38" cy="42" r="3.5" fill={ICON_COLOR} stroke="none" />
    <circle cx="62" cy="42" r="3.5" fill={ICON_COLOR} stroke="none" />
    <path d="M 32 60 Q 50 76 68 60" />
  </svg>
);

const Lightning: React.FC = () => (
  <svg viewBox="0 0 100 100" fill={ICON_COLOR}>
    <path d="M 58 8 L 28 54 L 48 54 L 38 92 L 74 42 L 52 42 L 60 8 Z" />
  </svg>
);

type Topic = {
  fromMs: number;
  toMs: number;
  icon: React.ReactNode;
  label: string;
};

const TOPICS: Topic[] = [
  { fromMs: 3440, toMs: 5040, icon: <Muscle />, label: "MUSCLE MASS" },
  { fromMs: 5040, toMs: 5920, icon: <Barbell />, label: "STRENGTH" },
  { fromMs: 5920, toMs: 7280, icon: <Moon />, label: "BETTER SLEEP" },
  { fromMs: 7280, toMs: 8630, icon: <Smile />, label: "GOOD MOOD" },
  { fromMs: 8630, toMs: 10980, icon: <Lightning />, label: "ENERGY" },
];

const TopicCard: React.FC<{ topic: Topic }> = ({ topic }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tMs = (frame / fps) * 1000;
  const fadeIn = interpolate(tMs, [topic.fromMs, topic.fromMs + 220], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(tMs, [topic.toMs - 220, topic.toMs], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);
  if (opacity <= 0) return null;

  const isWide = topic.label === "STRENGTH";

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        opacity,
      }}
    >
      <div
        style={{
          width: isWide ? 96 : 72,
          height: isWide ? 48 : 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {topic.icon}
      </div>
      <div
        style={{
          fontFamily,
          fontSize: 26,
          letterSpacing: 6,
          color: LABEL_COLOR,
          fontWeight: 500,
        }}
      >
        {topic.label}
      </div>
    </div>
  );
};

export const TopicVisuals: React.FC = () => {
  return (
    <>
      {TOPICS.map((topic) => (
        <TopicCard key={topic.fromMs} topic={topic} />
      ))}
    </>
  );
};
