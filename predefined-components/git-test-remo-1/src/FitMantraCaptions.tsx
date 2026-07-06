import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
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
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont("normal", {
  weights: ["800", "900"],
  subsets: ["latin"],
});

const LIME = "#00FF00";
const WHITE = "#FFFFFF";
const DIM_WHITE = "rgba(255,255,255,0.78)";

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
const ARROW_WORDS = new Set(["increase", "energy", "strength", "mass"]);

const SWITCH_CAPTIONS_EVERY_MS = 800;

const cleanWord = (s: string) =>
  s.trim().toLowerCase().replace(/[.,?!'"‘’]/g, "");

const Token: React.FC<{
  token: TikTokPage["tokens"][number];
  absoluteMs: number;
}> = ({ token, absoluteMs }) => {
  const word = cleanWord(token.text);
  const isKeyword = KEYWORDS.has(word);
  const hasArrow = ARROW_WORDS.has(word);

  const fadeIn = Math.max(
    0,
    Math.min(1, (absoluteMs - token.fromMs) / 220),
  );

  const popT = Math.max(
    0,
    Math.min(1, (absoluteMs - token.fromMs) / 360),
  );
  const pop = isKeyword
    ? interpolate(popT, [0, 0.4, 1], [0.7, 1.18, 1.0])
    : 1.0;

  if (fadeIn <= 0) return null;

  const color = isKeyword ? LIME : word.length <= 2 ? DIM_WHITE : WHITE;

  return (
    <span
      style={{
        display: "inline-block",
        opacity: fadeIn,
        transform: `scale(${pop})`,
        color,
        whiteSpace: "pre",
        transformOrigin: "50% 60%",
      }}
    >
      {token.text}
      {hasArrow ? (
        <span
          style={{
            display: "inline-block",
            color: WHITE,
            marginLeft: 8,
            transform: "translateY(-6px)",
            fontWeight: 900,
          }}
        >
          ↑
        </span>
      ) : null}
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
        paddingBottom: 260,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 900,
          fontSize: 104,
          textAlign: "center",
          maxWidth: 920,
          lineHeight: 1.05,
          letterSpacing: -1.5,
          textShadow:
            "0 6px 22px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.65)",
          WebkitTextStroke: "6px #000",
          paintOrder: "stroke fill",
          whiteSpace: "pre-wrap",
        }}
      >
        {page.tokens.map((t) => (
          <Token key={t.fromMs} token={t} absoluteMs={absoluteMs} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const FitMantraCaptions: React.FC = () => {
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
