import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

const { fontFamily: sansFamily } = loadMontserrat("normal", {
  weights: ["400", "600", "800", "900"],
  subsets: ["latin"],
});
const { fontFamily: serifFamily } = loadPlayfair("normal", {
  weights: ["700", "900"],
  subsets: ["latin"],
});

const CREAM = "#F5E6D3";
const GOLD = "#E6B45C";
const ESPRESSO_DEEP = "#0E0805";
const ESPRESSO_MID = "#2A1810";

const enterEase = Easing.bezier(0.16, 1, 0.3, 1);
const exitEase = Easing.bezier(0.55, 0, 0.7, 0);

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, 1]);
  const x = 50 + drift * 8;
  const y = 30 + drift * 10;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at ${x}% ${y}%, #4A2C1A 0%, ${ESPRESSO_MID} 38%, ${ESPRESSO_DEEP} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const FilmGrain: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        opacity: 0.06,
        mixBlendMode: "overlay",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
};

const SteamPuff: React.FC<{ offsetFrames: number; xPct: number }> = ({
  offsetFrames,
  xPct,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cycle = 2.4 * fps;
  const localFrame = (frame + offsetFrames) % cycle;
  const t = localFrame / cycle;
  const y = interpolate(t, [0, 1], [0, -260]);
  const opacity = interpolate(t, [0, 0.15, 0.7, 1], [0, 0.55, 0.25, 0]);
  const scale = interpolate(t, [0, 1], [0.6, 1.6]);
  const wobble = Math.sin(t * Math.PI * 3) * 14;
  return (
    <div
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: 0,
        width: 90,
        height: 90,
        marginLeft: -45,
        transform: `translate(${wobble}px, ${y}px) scale(${scale})`,
        opacity,
        background:
          "radial-gradient(circle at 50% 50%, rgba(255,240,220,0.85) 0%, rgba(255,240,220,0) 70%)",
        filter: "blur(8px)",
      }}
    />
  );
};

const CoffeeCup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0, 0.9 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breathe = 1 + Math.sin(frame / 22) * 0.012;
  const translateY = interpolate(enter, [0, 1], [80, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "44%",
        transform: `translate(-50%, -50%) translateY(${translateY}px) scale(${breathe})`,
        opacity: enter,
        width: 560,
        height: 560,
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <SteamPuff offsetFrames={0} xPct={42} />
        <SteamPuff offsetFrames={18} xPct={50} />
        <SteamPuff offsetFrames={36} xPct={58} />
        <SteamPuff offsetFrames={54} xPct={46} />
        <SteamPuff offsetFrames={9} xPct={54} />
      </div>
      <svg
        viewBox="0 0 400 400"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <radialGradient id="coffeeSurface" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#5A3A22" />
            <stop offset="60%" stopColor="#2E1A0E" />
            <stop offset="100%" stopColor="#1A0E08" />
          </radialGradient>
          <linearGradient id="cupBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F5E6D3" />
            <stop offset="100%" stopColor="#C9A57B" />
          </linearGradient>
          <linearGradient id="cupShade" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.25)" />
            <stop offset="50%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
          </linearGradient>
        </defs>
        <ellipse cx="200" cy="370" rx="160" ry="14" fill="rgba(0,0,0,0.45)" />
        <path
          d="M 90 180 L 110 350 Q 120 372 200 372 Q 280 372 290 350 L 310 180 Z"
          fill="url(#cupBody)"
          stroke={GOLD}
          strokeWidth="3"
        />
        <path
          d="M 90 180 L 110 350 Q 120 372 200 372 Q 280 372 290 350 L 310 180 Z"
          fill="url(#cupShade)"
        />
        <path
          d="M 305 210 Q 360 220 360 270 Q 360 320 305 325"
          fill="none"
          stroke={GOLD}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <ellipse cx="200" cy="180" rx="115" ry="22" fill="url(#coffeeSurface)" />
        <ellipse cx="200" cy="178" rx="105" ry="16" fill="#3A2415" opacity="0.7" />
        <ellipse cx="180" cy="172" rx="22" ry="4" fill="rgba(255,220,170,0.35)" />
      </svg>
    </div>
  );
};

const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0.4 * fps, 1.2 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [2.4 * fps, 3 * fps], [0, 1], {
    easing: exitEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter - exit;
  const translateY = interpolate(enter, [0, 1], [40, 0]) + interpolate(exit, [0, 1], [0, -30]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 220 }}>
      <div
        style={{
          fontFamily: serifFamily,
          fontSize: 110,
          fontStyle: "italic",
          fontWeight: 700,
          color: CREAM,
          letterSpacing: -2,
          textAlign: "center",
          opacity,
          transform: `translateY(${translateY}px)`,
          textShadow: "0 6px 30px rgba(0,0,0,0.6)",
        }}
      >
        Mornings
        <br />
        deserve better.
      </div>
    </AbsoluteFill>
  );
};

const SceneBrand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0, 0.7 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [2.4 * fps, 3 * fps], [0, 1], {
    easing: exitEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter - exit;
  const wordEnter = (start: number) =>
    interpolate(frame, [start, start + 0.5 * fps], [0, 1], {
      easing: enterEase,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const w1 = wordEnter(0);
  const w2 = wordEnter(0.15 * fps);
  const w3 = wordEnter(0.3 * fps);

  const lineWidth = interpolate(frame, [0.5 * fps, 1.3 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subEnter = interpolate(frame, [0.9 * fps, 1.6 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const Word: React.FC<{ p: number; children: React.ReactNode; color?: string }> = ({
    p,
    children,
    color = CREAM,
  }) => (
    <span
      style={{
        display: "inline-block",
        opacity: p,
        transform: `translateY(${(1 - p) * 50}px)`,
        color,
      }}
    >
      {children}
    </span>
  );

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 220, opacity }}
    >
      <div
        style={{
          fontFamily: sansFamily,
          fontWeight: 900,
          fontSize: 160,
          letterSpacing: 6,
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        <Word p={w1}>BREW</Word>{" "}
        <Word p={w2} color={GOLD}>&amp;</Word>{" "}
        <Word p={w3}>CO.</Word>
      </div>
      <div
        style={{
          width: 320,
          height: 3,
          marginTop: 36,
          background: GOLD,
          transform: `scaleX(${lineWidth})`,
          transformOrigin: "left center",
        }}
      />
      <div
        style={{
          fontFamily: sansFamily,
          fontWeight: 600,
          fontSize: 36,
          letterSpacing: 8,
          color: CREAM,
          marginTop: 28,
          opacity: subEnter,
          transform: `translateY(${(1 - subEnter) * 20}px)`,
        }}
      >
        ARTISAN COFFEE · SINCE 2020
      </div>
    </AbsoluteFill>
  );
};

const SceneOffer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0, 0.7 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = 1 + Math.sin(frame / 8) * 0.02;
  const exit = interpolate(frame, [2.4 * fps, 3 * fps], [0, 1], {
    easing: exitEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter - exit;
  const translateY = interpolate(enter, [0, 1], [40, 0]);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 220,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          fontFamily: sansFamily,
          fontWeight: 600,
          fontSize: 40,
          letterSpacing: 10,
          color: GOLD,
          marginBottom: 20,
        }}
      >
        LIMITED OFFER
      </div>
      <div
        style={{
          fontFamily: sansFamily,
          fontWeight: 900,
          fontSize: 220,
          color: CREAM,
          letterSpacing: -6,
          lineHeight: 0.9,
          transform: `scale(${pulse})`,
          textShadow: "0 0 60px rgba(230,180,92,0.35)",
        }}
      >
        20% OFF
      </div>
      <div
        style={{
          fontFamily: serifFamily,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 60,
          color: CREAM,
          marginTop: 30,
        }}
      >
        your first cup.
      </div>
    </AbsoluteFill>
  );
};

const CtaPill: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sceneStart = 7 * fps;
  const local = frame - sceneStart;
  const enter = interpolate(local, [0, 0.6 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const finalEnter = interpolate(frame, [durationInFrames - 1.2 * fps, durationInFrames - 0.4 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (frame < sceneStart) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 220,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 40}px)`,
      }}
    >
      <div
        style={{
          fontFamily: sansFamily,
          fontWeight: 800,
          fontSize: 56,
          color: CREAM,
          letterSpacing: 1,
        }}
      >
        Visit us today
      </div>
      <div
        style={{
          padding: "26px 64px",
          borderRadius: 999,
          background: GOLD,
          color: ESPRESSO_DEEP,
          fontFamily: sansFamily,
          fontWeight: 800,
          fontSize: 42,
          letterSpacing: 4,
          boxShadow: "0 20px 60px rgba(230,180,92,0.35)",
          transform: `scale(${0.9 + finalEnter * 0.1})`,
        }}
      >
        ORDER NOW
      </div>
      <div
        style={{
          fontFamily: sansFamily,
          fontWeight: 600,
          fontSize: 30,
          color: CREAM,
          opacity: 0.85,
          letterSpacing: 4,
          marginTop: 8,
        }}
      >
        BREWANDCO.COM · 12 MAIN ST
      </div>
    </div>
  );
};

const TopBadge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0.3 * fps, 1.0 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: enter,
        transform: `translateY(${(1 - enter) * -20}px)`,
        fontFamily: sansFamily,
        fontWeight: 600,
        fontSize: 28,
        letterSpacing: 12,
        color: GOLD,
      }}
    >
      ◆ BREW &amp; CO ◆
    </div>
  );
};

export const CoffeeAd: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: ESPRESSO_DEEP, overflow: "hidden" }}>
      <Background />
      <CoffeeCup />
      <TopBadge />

      <Sequence from={0} durationInFrames={3 * fps} layout="none">
        <SceneHook />
      </Sequence>
      <Sequence from={3 * fps} durationInFrames={2 * fps} layout="none">
        <SceneBrand />
      </Sequence>
      <Sequence from={5 * fps} durationInFrames={2 * fps} layout="none">
        <SceneOffer />
      </Sequence>
      <CtaPill />

      <FilmGrain />
    </AbsoluteFill>
  );
};
