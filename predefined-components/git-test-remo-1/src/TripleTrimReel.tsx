import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { FitMantraLogo } from "./FitMantraLogo";
import { BrandOutro, OUTRO_DURATION_SECONDS } from "./BrandOutro";

const { fontFamily: poppinsFamily } = loadPoppins("normal", {
  weights: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const CORAL = "#F08A82";
const CORAL_DEEP = "#D96B62";
const CREAM = "#FFF6F2";
const BRAND_GREEN = "#1F5C3D";
const TEAL = "#27423D";
const WHITE = "#FFFFFF";

const PRODUCT_FRAMES = 12 * 30;
const BRAND_OUTRO_FRAMES = Math.round(OUTRO_DURATION_SECONDS * 30);
const TOTAL_FRAMES = PRODUCT_FRAMES + BRAND_OUTRO_FRAMES;

const enterEase = Easing.bezier(0.22, 1, 0.36, 1);
const popEase = Easing.bezier(0.34, 1.56, 0.64, 1);

const PremiumBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, TOTAL_FRAMES], [0, 1]);
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at ${50 + drift * 8}% ${40 + drift * 6}%, ${CREAM} 0%, #FCEDE6 45%, #F4D6CC 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.16) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const FilmGrain: React.FC = () => (
  <AbsoluteFill
    style={{
      opacity: 0.05,
      mixBlendMode: "overlay",
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      pointerEvents: "none",
    }}
  />
);

const LightSweep: React.FC<{ start: number; duration: number }> = ({ start, duration }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - start;
  if (localFrame < 0 || localFrame > duration) return null;
  const x = interpolate(localFrame, [0, duration], [-30, 130]);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `linear-gradient(110deg, transparent ${x - 20}%, rgba(255,255,255,0.32) ${x}%, transparent ${x + 20}%)`,
        mixBlendMode: "screen",
      }}
    />
  );
};

const FloorShadow: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: "12%",
      right: "12%",
      bottom: "12%",
      height: 50,
      borderRadius: "50%",
      background:
        "radial-gradient(ellipse at center, rgba(0,0,0,0.32) 0%, transparent 70%)",
      filter: "blur(8px)",
    }}
  />
);

const HeroBottle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 1.1]);
  const exit = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const titleIn = interpolate(frame, [0.8 * fps, 1.4 * fps], [0, 1], {
    easing: popEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagIn = interpolate(frame, [1.3 * fps, 1.9 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: enter * exit }}>
      <FloorShadow />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `scale(${zoom}) translateY(${-30 + (1 - enter) * 40}px)`,
            filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.28))",
          }}
        >
          <Img
            src={staticFile("product/01-bottle.png")}
            style={{ width: 920, height: "auto", display: "block" }}
          />
        </div>
      </AbsoluteFill>
      <LightSweep start={Math.round(0.4 * fps)} duration={Math.round(1.4 * fps)} />
      <div
        style={{
          position: "absolute",
          top: 220,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: poppinsFamily,
          fontWeight: 900,
          fontSize: 72,
          letterSpacing: -1,
          color: CORAL_DEEP,
          opacity: titleIn,
          transform: `scale(${0.92 + titleIn * 0.08})`,
        }}
      >
        TRIPPLE TRIM
      </div>
      <div
        style={{
          position: "absolute",
          top: 320,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: poppinsFamily,
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: 9,
          color: TEAL,
          opacity: tagIn,
          transform: `translateY(${(1 - tagIn) * 10}px)`,
        }}
      >
        PCOS · METABOLISM · BALANCE
      </div>
    </AbsoluteFill>
  );
};

const IngredientsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const zoom = interpolate(frame, [0, durationInFrames], [1.06, 1.0]);
  const titleIn = interpolate(frame, [0.2 * fps, 0.8 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: enter * exit }}>
      <FloorShadow />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
        <div
          style={{
            transform: `scale(${zoom})`,
            filter: "drop-shadow(0 24px 44px rgba(0,0,0,0.22))",
          }}
        >
          <Img
            src={staticFile("product/02-ingredients.png")}
            style={{ width: 980, height: "auto", display: "block" }}
          />
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: poppinsFamily,
          fontWeight: 800,
          fontSize: 64,
          letterSpacing: -1,
          color: CORAL_DEEP,
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 14}px)`,
        }}
      >
        4 POWERFUL INGREDIENTS
      </div>
    </AbsoluteFill>
  );
};

const FactsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const panY = interpolate(frame, [0, durationInFrames], [40, -40]);
  const zoom = interpolate(frame, [0, durationInFrames], [1.04, 1.12]);
  const titleIn = interpolate(frame, [0.1 * fps, 0.7 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: enter * exit }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `scale(${zoom}) translateY(${panY}px)`,
            filter: "drop-shadow(0 22px 38px rgba(0,0,0,0.2))",
          }}
        >
          <Img
            src={staticFile("product/03-facts.png")}
            style={{ width: 980, height: "auto", display: "block" }}
          />
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 140,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: poppinsFamily,
          fontWeight: 800,
          fontSize: 54,
          letterSpacing: 0,
          color: CORAL_DEEP,
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 14}px)`,
        }}
      >
        SCIENTIFICALLY FORMULATED
      </div>
    </AbsoluteFill>
  );
};

const BenefitsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const zoom = interpolate(frame, [0, durationInFrames], [1.05, 1.0]);
  const titleIn = interpolate(frame, [0.1 * fps, 0.7 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: enter * exit }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 100 }}>
        <div
          style={{
            transform: `scale(${zoom})`,
            filter: "drop-shadow(0 22px 38px rgba(0,0,0,0.22))",
          }}
        >
          <Img
            src={staticFile("product/04-benefits.png")}
            style={{ width: 1000, height: "auto", display: "block" }}
          />
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 140,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: poppinsFamily,
          fontWeight: 800,
          fontSize: 56,
          letterSpacing: 0,
          color: CORAL_DEEP,
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 14}px)`,
        }}
      >
        REAL RESULTS
      </div>
    </AbsoluteFill>
  );
};

const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bottleZoom = interpolate(frame, [0, durationInFrames], [0.95, 1.05]);
  const logoIn = interpolate(frame, [0.2 * fps, 0.9 * fps], [0, 1], {
    easing: popEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaIn = interpolate(frame, [0.7 * fps, 1.3 * fps], [0, 1], {
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
    <AbsoluteFill style={{ opacity: enter * finalFade }}>
      <FloorShadow />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 180 }}>
        <div
          style={{
            transform: `scale(${bottleZoom})`,
            filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.28))",
            opacity: 0.97,
          }}
        >
          <Img
            src={staticFile("product/01-bottle.png")}
            style={{ width: 760, height: "auto", display: "block" }}
          />
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          top: 130,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: logoIn,
          transform: `scale(${0.85 + logoIn * 0.15})`,
          filter: "drop-shadow(0 14px 28px rgba(0,0,0,0.35))",
        }}
      >
        <FitMantraLogo size={170} />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: ctaIn,
          transform: `translateY(${(1 - ctaIn) * 18}px)`,
        }}
      >
        <div
          style={{
            fontFamily: poppinsFamily,
            fontWeight: 900,
            fontSize: 64,
            letterSpacing: -1,
            color: CORAL_DEEP,
            lineHeight: 1.05,
          }}
        >
          ORDER NOW
        </div>
        <div
          style={{
            fontFamily: poppinsFamily,
            fontWeight: 600,
            fontSize: 28,
            letterSpacing: 6,
            color: TEAL,
            marginTop: 14,
          }}
        >
          FOLLOW @FITMANTRA FOR MORE
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TopRightLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        right: 56,
        opacity: enter * 0.88,
        transform: `scale(${0.9 + enter * 0.1})`,
        filter: "drop-shadow(0 8px 22px rgba(0,0,0,0.35))",
      }}
    >
      <FitMantraLogo size={140} />
    </div>
  );
};

const BackgroundMusic: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <Audio
      src={staticFile("music/bgm.mp3")}
      volume={(f) => {
        const fadeIn = interpolate(f, [0, 0.5 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const fadeOut = interpolate(
          f,
          [PRODUCT_FRAMES - 0.5 * fps, PRODUCT_FRAMES],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return Math.min(fadeIn, fadeOut) * 0.32;
      }}
    />
  );
};

const HERO_END = Math.round(2.4 * 30);
const ING_END = Math.round(5.0 * 30);
const FACTS_END = Math.round(8.0 * 30);
const BEN_END = Math.round(10.5 * 30);
const PRODUCT_END = PRODUCT_FRAMES;

export const TripleTrimReel: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: CREAM, overflow: "hidden" }}>
      <BackgroundMusic />
      <PremiumBackdrop />

      <Sequence from={0} durationInFrames={HERO_END + 12} layout="none">
        <HeroBottle />
      </Sequence>
      <Sequence from={HERO_END - 8} durationInFrames={ING_END - HERO_END + 16} layout="none">
        <IngredientsScene />
      </Sequence>
      <Sequence from={ING_END - 8} durationInFrames={FACTS_END - ING_END + 16} layout="none">
        <FactsScene />
      </Sequence>
      <Sequence from={FACTS_END - 8} durationInFrames={BEN_END - FACTS_END + 16} layout="none">
        <BenefitsScene />
      </Sequence>
      <Sequence from={BEN_END - 8} durationInFrames={PRODUCT_END - BEN_END + 8} layout="none">
        <OutroScene />
      </Sequence>

      <FilmGrain />
      <Sequence from={0} durationInFrames={PRODUCT_END - 4} layout="none">
        <TopRightLogo />
      </Sequence>

      <Sequence from={PRODUCT_END} durationInFrames={BRAND_OUTRO_FRAMES} layout="none">
        <BrandOutro />
      </Sequence>
    </AbsoluteFill>
  );
};

export const TRIPLE_TRIM_TOTAL_FRAMES = TOTAL_FRAMES;
