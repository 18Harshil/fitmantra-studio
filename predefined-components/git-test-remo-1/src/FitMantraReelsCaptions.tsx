import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
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
import { loadFont } from "@remotion/google-fonts/Lora";

const { fontFamily: loraFamily } = loadFont("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"],
});

const FONT_FAMILY = `"Bell MT", ${loraFamily}, Georgia, serif`;
const HIGHLIGHT_COLOR = "#00C853";
const TEXT_COLOR = "#FFFFFF";

const KEYWORDS = new Set([
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

const SWITCH_CAPTIONS_EVERY_MS = 950;

const cleanWord = (s: string) =>
  s.trim().toLowerCase().replace(/[.,?!'"‘’]/g, "");

const enterEase = Easing.bezier(0.22, 1, 0.36, 1);

const CaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 0.16 * fps], [0, 1], {
    easing: enterEase,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 200,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontWeight: 700,
          fontSize: 56,
          textAlign: "center",
          maxWidth: 940,
          lineHeight: 1.28,
          letterSpacing: 0.4,
          whiteSpace: "pre-wrap",
          textShadow:
            "0 2px 10px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7)",
          opacity: fadeIn,
          transform: `translateY(${(1 - fadeIn) * 8}px)`,
        }}
      >
        {page.tokens.map((token) => {
          const isKeyword = KEYWORDS.has(cleanWord(token.text));
          return (
            <span
              key={token.fromMs}
              style={{
                color: isKeyword ? HIGHLIGHT_COLOR : TEXT_COLOR,
                whiteSpace: "pre",
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

export const FitMantraReelsCaptions: React.FC = () => {
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
        const next = pages[index + 1] ?? null;
        const startFrame = Math.round((page.startMs / 1000) * fps);
        const endFrame = next
          ? Math.round((next.startMs / 1000) * fps)
          : Infinity;
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
