import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  delayRender,
  continueRender,
  cancelRender,
} from "remotion";
import {
  createTikTokStyleCaptions,
  type Caption,
  type TikTokPage,
} from "@remotion/captions";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["800", "900"],
  subsets: ["latin"],
});

const HIGHLIGHT_KEYWORDS = new Set([
  "weight",
  "muscle",
  "mass",
  "strength",
  "sleep",
  "mood",
  "energy",
  "levels",
  "increase",
]);

const HIGHLIGHT_COLOR = "#FFE600";
const ACTIVE_COLOR = "#39E508";
const FILL_COLOR = "#FFFFFF";

const SWITCH_CAPTIONS_EVERY_MS = 1100;

const popEase = Easing.bezier(0.34, 1.56, 0.64, 1);

const cleanWord = (s: string) =>
  s.trim().toLowerCase().replace(/[.,?!'"‘’]/g, "");

const CaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;
  const absoluteTimeMs = page.startMs + currentTimeMs;

  const popIn = interpolate(frame, [0, 0.18 * fps], [0, 1], {
    easing: popEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 420,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 110,
          lineHeight: 1.05,
          textAlign: "center",
          maxWidth: 920,
          letterSpacing: -2,
          whiteSpace: "pre-wrap",
          color: FILL_COLOR,
          WebkitTextStroke: "10px #000",
          paintOrder: "stroke fill",
          textShadow: "0 14px 30px rgba(0,0,0,0.85)",
          transform: `scale(${0.82 + popIn * 0.18}) translateY(${(1 - popIn) * 24}px)`,
          transformOrigin: "50% 80%",
        }}
      >
        {page.tokens.map((token) => {
          const isKeyword = HIGHLIGHT_KEYWORDS.has(cleanWord(token.text));
          const isActive =
            token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;

          let color = FILL_COLOR;
          if (isKeyword) color = HIGHLIGHT_COLOR;
          if (isActive && isKeyword) color = ACTIVE_COLOR;

          const activeScale = isActive ? 1.05 : 1;

          return (
            <span
              key={token.fromMs}
              style={{
                color,
                whiteSpace: "pre",
                display: "inline-block",
                transform: `scale(${activeScale})`,
                transformOrigin: "50% 60%",
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const ShortsCaptions: React.FC = () => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [handle] = useState(() => delayRender("Loading captions"));
  const { fps } = useVideoConfig();

  const fetchCaptions = useCallback(async () => {
    try {
      const res = await fetch(staticFile("captions.json"));
      const data = (await res.json()) as Caption[];
      setCaptions(data);
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
      combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS,
    }).pages;
  }, [captions]);

  if (!captions) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {pages.map((page, index) => {
        const nextPage = pages[index + 1] ?? null;
        const startFrame = Math.round((page.startMs / 1000) * fps);
        const endFrame = nextPage
          ? Math.round((nextPage.startMs / 1000) * fps)
          : Infinity;
        const durationInFrames = endFrame - startFrame;
        if (durationInFrames <= 0) return null;
        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={durationInFrames}
            layout="none"
          >
            <CaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
