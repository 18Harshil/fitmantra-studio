import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";

const { fontFamily: poppinsFamily } = loadPoppins("normal", {
  weights: ["600", "700", "800", "900"],
  subsets: ["latin"],
});

const PINK = "#FF4F7B";
const PINK_DEEP = "#E6256A";
const PINK_LIGHT = "#FFA5BB";
const CREAM = "#FFF0F4";
const DARK_BG = "#1B1014";

const enterEase = Easing.bezier(0.22, 1, 0.36, 1);

const POINTS = [
  { x: 0, y: 0.78 },
  { x: 0.12, y: 0.7 },
  { x: 0.24, y: 0.74 },
  { x: 0.38, y: 0.58 },
  { x: 0.52, y: 0.5 },
  { x: 0.64, y: 0.42 },
  { x: 0.78, y: 0.28 },
  { x: 0.88, y: 0.22 },
  { x: 1.0, y: 0.12 },
];

export const PinkPositiveGraph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const draw = interpolate(frame, [0, Math.min(durationInFrames * 0.7, 1.5 * fps)], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cardW = 880;
  const cardH = 720;
  const padX = 80;
  const padTop = 200;
  const padBot = 120;
  const graphW = cardW - padX * 2;
  const graphH = cardH - padTop - padBot;

  const lastIdx = Math.min(
    POINTS.length - 1,
    Math.max(0, Math.floor(draw * (POINTS.length - 1))),
  );
  const segFrac = draw * (POINTS.length - 1) - lastIdx;
  const drawn: { x: number; y: number }[] = [];
  for (let i = 0; i <= lastIdx; i++) drawn.push(POINTS[i]);
  if (lastIdx < POINTS.length - 1 && segFrac > 0) {
    const a = POINTS[lastIdx];
    const b = POINTS[lastIdx + 1];
    drawn.push({ x: a.x + (b.x - a.x) * segFrac, y: a.y + (b.y - a.y) * segFrac });
  }

  const toScreen = (p: { x: number; y: number }) => ({
    sx: padX + p.x * graphW,
    sy: padTop + p.y * graphH,
  });

  const linePath =
    drawn.length > 1
      ? `M ${toScreen(drawn[0]).sx} ${toScreen(drawn[0]).sy} ` +
        drawn.slice(1).map((p) => {
          const s = toScreen(p);
          return `L ${s.sx} ${s.sy}`;
        }).join(" ")
      : "";

  const areaPath =
    drawn.length > 1
      ? `M ${toScreen(drawn[0]).sx} ${cardH - padBot} ` +
        drawn.map((p) => {
          const s = toScreen(p);
          return `L ${s.sx} ${s.sy}`;
        }).join(" ") +
        ` L ${toScreen(drawn[drawn.length - 1]).sx} ${cardH - padBot} Z`
      : "";

  const tip = toScreen(drawn[drawn.length - 1] ?? POINTS[0]);

  const titleIn = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardIn = interpolate(frame, [0, 0.4 * fps], [0.94, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const percent = Math.round(draw * 47);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, #2a1820 0%, ${DARK_BG} 70%, #0c0508 100%)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: cardW,
          height: cardH,
          background: "linear-gradient(160deg, #2d1922 0%, #1f1218 100%)",
          borderRadius: 36,
          boxShadow: "0 30px 70px rgba(255,79,123,0.18), 0 0 0 1px rgba(255,165,187,0.18)",
          position: "relative",
          overflow: "hidden",
          transform: `scale(${cardIn})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 56,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: poppinsFamily,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 6,
            color: PINK_LIGHT,
            opacity: titleIn,
          }}
        >
          POSITIVE TREND
        </div>
        <div
          style={{
            position: "absolute",
            top: 100,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: poppinsFamily,
            fontWeight: 900,
            fontSize: 86,
            letterSpacing: -2,
            color: CREAM,
            opacity: titleIn,
          }}
        >
          ↑ +{percent}%
        </div>
        <svg
          width={cardW}
          height={cardH}
          viewBox={`0 0 ${cardW} ${cardH}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="pinkLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={PINK_DEEP} />
              <stop offset="100%" stopColor={PINK_LIGHT} />
            </linearGradient>
            <linearGradient id="pinkFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={PINK} stopOpacity="0.45" />
              <stop offset="100%" stopColor={PINK} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.2, 0.4, 0.6, 0.8].map((g) => (
            <line
              key={g}
              x1={padX}
              x2={cardW - padX}
              y1={padTop + g * graphH}
              y2={padTop + g * graphH}
              stroke="rgba(255,165,187,0.08)"
              strokeWidth="1"
            />
          ))}
          {areaPath ? <path d={areaPath} fill="url(#pinkFill)" /> : null}
          {linePath ? (
            <path
              d={linePath}
              stroke="url(#pinkLine)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="drop-shadow(0 0 14px rgba(255,79,123,0.55))"
            />
          ) : null}
          {drawn.slice(0, -1).map((p, i) => {
            const s = toScreen(p);
            return (
              <circle
                key={i}
                cx={s.sx}
                cy={s.sy}
                r="6"
                fill={PINK_DEEP}
                stroke={CREAM}
                strokeWidth="2"
              />
            );
          })}
          <circle cx={tip.sx} cy={tip.sy} r="16" fill={PINK} opacity="0.45" />
          <circle
            cx={tip.sx}
            cy={tip.sy}
            r="10"
            fill={PINK_LIGHT}
            stroke={CREAM}
            strokeWidth="3"
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
