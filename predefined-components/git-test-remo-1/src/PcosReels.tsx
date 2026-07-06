import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  Video,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  createTikTokStyleCaptions,
  type Caption,
  type TikTokPage,
} from "@remotion/captions";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { FitMantraLogo } from "./FitMantraLogo";
import { BrandOutro, OUTRO_DURATION_SECONDS } from "./BrandOutro";
import { PinkPositiveGraph } from "./PinkPositiveGraph";

const { fontFamily: poppinsFamily } = loadPoppins("normal", {
  weights: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
});
const { fontFamily: poppinsItalic } = loadPoppins("italic", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

const WHITE = "#FFFFFF";
const PRIMARY_GREEN = "#27423D";
const SECONDARY_TEAL = "#166358";
const GOLD = "#B8A96A";

const KEYWORDS = new Set([
  "pcos",
  "vitamin",
  "d3",
  "research",
  "scientific",
  "researchers",
  "symptoms",
  "challenges",
  "link",
  "struggling",
  "low",
  "levels",
  "correlation",
  "management",
  "women",
  "optimize",
  "actively",
  "hormones",
  "hormonal",
  "thyroid",
  "estrogen",
  "cortisol",
  "healing",
  "metabolism",
  "insulin",
]);

const FPS = 30;

// Cut source 10-12s and 42-43s. Stitched body = 64s.
const SPEECH_SEGMENTS: { srcStart: number; srcEnd: number }[] = [
  { srcStart: 0, srcEnd: 10 },
  { srcStart: 12, srcEnd: 42 },
  { srcStart: 43, srcEnd: 67 },
];

type CompiledSegment = {
  from: number;
  dur: number;
  srcStart: number;
  srcEnd: number;
  outStartSec: number;
  outEndSec: number;
};

const COMPILED_SEGMENTS: CompiledSegment[] = (() => {
  let cum = 0;
  return SPEECH_SEGMENTS.map((s) => {
    const dur = Math.round((s.srcEnd - s.srcStart) * FPS);
    const result = {
      from: cum,
      dur,
      srcStart: Math.round(s.srcStart * FPS),
      srcEnd: Math.round(s.srcEnd * FPS),
      outStartSec: cum / FPS,
      outEndSec: (cum + dur) / FPS,
    };
    cum += dur;
    return result;
  });
})();

const SPEECH_END_FRAME = COMPILED_SEGMENTS[COMPILED_SEGMENTS.length - 1].from +
  COMPILED_SEGMENTS[COMPILED_SEGMENTS.length - 1].dur;
const BODY_END_SECONDS = SPEECH_END_FRAME / FPS;
const OUTRO_DURATION_FRAMES = Math.round(OUTRO_DURATION_SECONDS * FPS);
const TOTAL_FRAMES = SPEECH_END_FRAME + OUTRO_DURATION_FRAMES;

// Remap a source-time ms to output-time ms (returns null if in a cut gap)
const srcMsToOutMs = (srcMs: number): number | null => {
  const srcSec = srcMs / 1000;
  for (const seg of COMPILED_SEGMENTS) {
    const srcStartSec = seg.srcStart / FPS;
    const srcEndSec = seg.srcEnd / FPS;
    if (srcSec >= srcStartSec && srcSec <= srcEndSec) {
      return (seg.outStartSec + (srcSec - srcStartSec)) * 1000;
    }
  }
  return null;
};

const enterEase = Easing.bezier(0.32, 0.94, 0.4, 1);
const smoothEase = Easing.bezier(0.45, 0, 0.55, 1);
const popEase = Easing.bezier(0.34, 1.42, 0.64, 1);

const cleanWord = (s: string) =>
  s.trim().toLowerCase().replace(/[.,?!'"‘’]/g, "");

const InlineWord: React.FC<{
  token: TikTokPage["tokens"][number];
  absoluteMs: number;
}> = ({ token, absoluteMs }) => {
  const word = cleanWord(token.text);
  const isKeyword = KEYWORDS.has(word);

  const fadeIn = Math.max(
    0,
    Math.min(1, (absoluteMs - token.fromMs) / 180),
  );

  if (fadeIn <= 0) return null;

  return (
    <span
      style={{
        color: isKeyword ? SECONDARY_TEAL : WHITE,
        opacity: fadeIn,
        whiteSpace: "pre",
      }}
    >
      {token.text}
    </span>
  );
};

const CaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const absoluteMs = page.startMs + (frame / fps) * 1000;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 360,
        paddingLeft: 80,
        paddingRight: 80,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: poppinsFamily,
          fontSize: 72,
          fontWeight: 800,
          color: WHITE,
          textAlign: "center",
          maxWidth: 920,
          lineHeight: 1.18,
          letterSpacing: -0.3,
          whiteSpace: "pre-wrap",
          WebkitTextStroke: "4px rgba(0,0,0,0.75)",
          paintOrder: "stroke fill",
          textShadow:
            "0 4px 18px rgba(0,0,0,0.92), 0 0 8px rgba(0,0,0,0.65)",
        }}
      >
        {page.tokens.map((t) => (
          <InlineWord key={t.fromMs} token={t} absoluteMs={absoluteMs} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const TopCaptions: React.FC = () => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [handle] = useState(() => delayRender("Loading PCOS captions"));
  const { fps } = useVideoConfig();

  const fetchCaptions = useCallback(async () => {
    try {
      const res = await fetch(staticFile("new-captions.json"));
      const data = (await res.json()) as Caption[];
      // Remap each caption from source time to output time (drop tokens inside cut gaps)
      const remapped: Caption[] = [];
      for (const c of data) {
        const outStart = srcMsToOutMs(c.startMs);
        const outEnd = srcMsToOutMs(c.endMs);
        if (outStart == null || outEnd == null) continue;
        remapped.push({
          text: c.text,
          startMs: outStart,
          endMs: outEnd,
          timestampMs: c.timestampMs,
          confidence: c.confidence,
        });
      }
      // Merge continuation sub-tokens
      const merged: Caption[] = [];
      for (const t of remapped) {
        const isContinuation = !/^\s/.test(t.text) && merged.length > 0;
        if (isContinuation) {
          const prev = merged[merged.length - 1];
          prev.text += t.text;
          prev.endMs = t.endMs;
        } else {
          merged.push({ ...t });
        }
      }
      setCaptions(merged);
      continueRender(handle);
    } catch (err) {
      cancelRender(err as Error);
    }
  }, [handle]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  const pages = useMemo(() => {
    if (!captions) return [] as TikTokPage[];
    return createTikTokStyleCaptions({
      captions,
      combineTokensWithinMilliseconds: 1100,
    }).pages;
  }, [captions]);

  if (!captions) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {pages.map((page, index) => {
        const next = pages[index + 1] ?? null;
        const startFrame = Math.round((page.startMs / 1000) * fps);
        const endFrame = next
          ? Math.round((next.startMs / 1000) * fps)
          : SPEECH_END_FRAME;
        const dur = endFrame - startFrame;
        if (dur <= 0) return null;
        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={dur}
            layout="none"
          >
            <CaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

type Cutaway = {
  fromMs: number;
  toMs: number;
  src: string;
  trimSec: number;
  objectPosition?: string;
};

// Cutaways in OUTPUT time (after cuts at 10-12s and 42-43s of source).
// Body is now 64s. Strategic B-roll over the cut boundaries (output 10s & 40s) to mask the audio jumps.
const CUTAWAYS: Cutaway[] = [
  { fromMs: 700, toMs: 3000, src: "broll-pcos/yoga.mp4", trimSec: 0.5, objectPosition: "30% center" },
  { fromMs: 5000, toMs: 7500, src: "broll-v3/pills-closeup.mp4", trimSec: 0 },
  { fromMs: 9000, toMs: 11500, src: "broll-v4/research-1.mp4", trimSec: 0 },
  { fromMs: 13000, toMs: 16000, src: "broll-v3/medicine.mp4", trimSec: 1 },
  { fromMs: 18500, toMs: 21500, src: "broll-pcos/meditation.mp4", trimSec: 2 },
  { fromMs: 24000, toMs: 27000, src: "broll-v4/research-2.mp4", trimSec: 0 },
  { fromMs: 29000, toMs: 31500, src: "broll-v3/dna.mp4", trimSec: 2 },
  { fromMs: 33000, toMs: 35500, src: "broll-v5/diabetes.mp4", trimSec: 0 },
  { fromMs: 36000, toMs: 38500, src: "broll-v5/calendar-1.mp4", trimSec: 0 },
  { fromMs: 39000, toMs: 42500, src: "custom:pink-graph", trimSec: 0 },
  { fromMs: 47000, toMs: 49500, src: "broll-v3/supplements.mp4", trimSec: 1 },
  { fromMs: 51500, toMs: 53500, src: "broll-v3/medicine.mp4", trimSec: 4 },
  { fromMs: 55000, toMs: 57500, src: "broll-v3/supplements.mp4", trimSec: 5 },
  { fromMs: 60500, toMs: 63500, src: "broll-v5/phone-comment.mp4", trimSec: 0 },
];

const CutawayContent: React.FC<{ cut: Cutaway; durationMs: number }> = ({
  cut,
  durationMs,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localMs = (frame / fps) * 1000;

  const fadeIn = interpolate(localMs, [0, 380], [0, 1], {
    easing: smoothEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    localMs,
    [durationMs - 380, durationMs],
    [1, 0],
    {
      easing: smoothEase,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const opacity = Math.min(fadeIn, fadeOut);
  const zoom = interpolate(localMs, [0, durationMs], [1.025, 1.07], {
    easing: smoothEase,
  });

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#000" }} />
      {cut.src === "custom:pink-graph" ? (
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
          <PinkPositiveGraph />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Video
            src={staticFile(cut.src)}
            muted
            startFrom={Math.round(cut.trimSec * fps)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: cut.objectPosition ?? "center",
              filter: "contrast(1.07) saturate(0.95) brightness(0.96)",
              transform: `scale(${zoom})`,
            }}
          />
        </AbsoluteFill>
      )}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.42) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const Cutaways: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      {CUTAWAYS.map((c) => {
        const compStart = Math.round((c.fromMs / 1000) * fps);
        const durMs = c.toMs - c.fromMs;
        const compDur = Math.round((durMs / 1000) * fps);
        return (
          <Sequence
            key={`${c.fromMs}-${c.src}`}
            from={compStart}
            durationInFrames={compDur}
            layout="none"
          >
            <CutawayContent cut={c} durationMs={durMs} />
          </Sequence>
        );
      })}
    </>
  );
};

const SpeakerVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {COMPILED_SEGMENTS.map((seg, i) => (
        <Sequence key={i} from={seg.from} durationInFrames={seg.dur} layout="none">
          <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
            <Video
              src={staticFile("new-source-clean.mp4")}
              startFrom={seg.srcStart}
              endAt={seg.srcEnd}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "contrast(1.06) saturate(0.94) brightness(1.02)",
              }}
            />
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const SoftBlobs: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "soft-light" }}>
      <div
        style={{
          position: "absolute",
          top: `${-14 + Math.sin(t * 0.2) * 5}%`,
          left: `${-16 + Math.cos(t * 0.27) * 6}%`,
          width: 720,
          height: 720,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${GOLD}55 0%, transparent 65%)`,
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: `${-10 + Math.sin(t * 0.17) * 4}%`,
          right: `${-14 + Math.cos(t * 0.22) * 6}%`,
          width: 820,
          height: 820,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${SECONDARY_TEAL}55 0%, transparent 65%)`,
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: `${28 + Math.sin(t * 0.12) * 6}%`,
          right: `${-22 + Math.cos(t * 0.18) * 4}%`,
          width: 540,
          height: 540,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(244,180,168,0.35) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />
    </AbsoluteFill>
  );
};

const TopBackdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 24%, transparent 38%)",
      pointerEvents: "none",
    }}
  />
);

const BottomGradient: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.72) 85%, rgba(0,0,0,0.92) 100%)",
      pointerEvents: "none",
    }}
  />
);

const TopRightLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0, 0.8 * fps], [0, 1], {
    easing: smoothEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        right: 56,
        opacity: enter * 0.85,
        transform: `scale(${0.9 + enter * 0.1})`,
        filter: "drop-shadow(0 8px 22px rgba(0,0,0,0.45))",
      }}
    >
      <FitMantraLogo size={140} />
    </div>
  );
};

const HookPunch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const punch = interpolate(frame, [0, 0.6 * fps, 1.4 * fps], [1.05, 1.015, 1.0], {
    easing: smoothEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (frame > 1.6 * fps) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        transform: `scale(${punch})`,
      }}
    />
  );
};

const BackgroundMusic: React.FC = () => {
  const { fps } = useVideoConfig();
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
          [SPEECH_END_FRAME - 0.5 * fps, SPEECH_END_FRAME],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return Math.min(fadeIn, fadeOut) * 0.08;
      }}
    />
  );
};

export const PcosReels: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mainExitFade = interpolate(
    frame,
    [SPEECH_END_FRAME - 0.5 * fps, SPEECH_END_FRAME],
    [1, 0],
    {
      easing: smoothEase,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <BackgroundMusic />
      <Sequence durationInFrames={SPEECH_END_FRAME + 12} layout="none">
        <AbsoluteFill style={{ opacity: mainExitFade }}>
          <SpeakerVideo />
          <Cutaways />
          <SoftBlobs />
          <TopBackdrop />
          <BottomGradient />
          <TopCaptions />
        </AbsoluteFill>
      </Sequence>
      <Sequence
        from={SPEECH_END_FRAME}
        durationInFrames={OUTRO_DURATION_FRAMES}
        layout="none"
      >
        <BrandOutro />
      </Sequence>
      <Sequence durationInFrames={SPEECH_END_FRAME} layout="none">
        <TopRightLogo />
      </Sequence>
      <Sequence durationInFrames={Math.round(1.4 * FPS)} layout="none">
        <HookPunch />
      </Sequence>
    </AbsoluteFill>
  );
};

export const PCOS_REELS_TOTAL_FRAMES = TOTAL_FRAMES;
