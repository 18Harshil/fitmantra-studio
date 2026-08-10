import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
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

const SWITCH_CAPTIONS_EVERY_MS = 800;

const cleanWord = (s: string) =>
  s.trim().toLowerCase().replace(/[.,?!'"‘’]/g, "");

const Token: React.FC<{
  token: TikTokPage["tokens"][number];
  absoluteMs: number;
  keywordSet: ReadonlySet<string>;
  capitalizeSet: ReadonlySet<string>;
}> = ({ token, absoluteMs, keywordSet, capitalizeSet }) => {
  const word = cleanWord(token.text);
  const isKeyword = keywordSet.has(word);
  const cap = capitalizeSet.has(word);

  const fadeIn = Math.max(0, Math.min(1, (absoluteMs - token.fromMs) / 200));

  const popT = Math.max(0, Math.min(1, (absoluteMs - token.fromMs) / 80));
  const pop = 0.4 + popT * 0.6;

  if (fadeIn <= 0) return null;

  const textContent = (isKeyword || cap) ? token.text.replace(/^(\s*)(.)(.*)$/, (_, s, c, r) => s + c.toUpperCase() + (r === r.toUpperCase() ? r : r.toLowerCase())) : token.text;

  if (isKeyword) {
    return (
      <span
        style={{
          display: "inline",
          whiteSpace: "pre",
        }}
      >
        <span
          style={{
            display: "inline-block",
            transform: `scale(${pop})`,
            color: LIME,
            fontSize: "1.1em",
          }}
        >
          {textContent}
        </span>
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline",
        opacity: fadeIn,
        color: "#FFFFFF",
        whiteSpace: "pre",
      }}
    >
      {textContent}
    </span>
  );
};

const CaptionPage: React.FC<{ page: TikTokPage; keywordSet: ReadonlySet<string>; capitalizeSet: ReadonlySet<string>; shiftUp?: boolean; pipActive?: boolean }> = ({
  page,
  keywordSet,
  capitalizeSet,
  shiftUp = false,
  pipActive = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const absoluteMs = page.startMs + (frame / fps) * 1000;

  const pad = Math.round(height * 0.21);
  const pipPad = Math.round(height * 0.08);
  const padShifted = Math.round(height * 0.42);
  const baseFont = Math.round(height * 0.06);
  const containerMaxW = Math.round(height * 0.54);
  const pipMaxW = Math.round(height * 0.24);
  const pipPadLeft = Math.round(height * 0.03);
  const strokeWidth = Math.round(height * 0.003);

  return (
    <AbsoluteFill
      style={{
        alignItems: pipActive ? "flex-start" : "center",
        justifyContent: "flex-end",
        paddingBottom: pipActive ? pipPad : (shiftUp ? padShifted : pad),
        paddingLeft: pipActive ? pipPadLeft : 0,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily,
          textAlign: "center",
          maxWidth: pipActive ? pipMaxW : containerMaxW,
          fontWeight: 900,
          fontSize: baseFont,
          lineHeight: 1.1,
          padding: "0px 8px",
          letterSpacing: -1.5,
          borderRadius: 16,
          textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)",
          whiteSpace: "pre-wrap",

        }}
      >
        {page.tokens.map((t) => (
          <Token
            key={t.fromMs}
            token={t}
            absoluteMs={absoluteMs}
            keywordSet={keywordSet}
            capitalizeSet={capitalizeSet}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const FitMantraCaptions: React.FC<{
  captionsSrc?: string;
  highlightKeywords?: string[];
  capitalizeWords?: string[];
  shiftUp?: boolean;
  pipActive?: boolean;
}> = ({ captionsSrc = "captions.json", highlightKeywords = [], capitalizeWords = [], shiftUp = false, pipActive = false }) => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [handle] = useState(() => delayRender("Loading captions"));
  const { fps } = useVideoConfig();

  const keywordSet = useMemo(
    () => new Set(["fitmantra", "fit", "mantra", ...highlightKeywords.map(cleanWord)]),
    [highlightKeywords],
  );

  const capitalizeSet = useMemo(
    () => new Set(["fitmantra", "fit", "mantra", ...capitalizeWords.map(cleanWord)]),
    [capitalizeWords],
  );

  const fetchCaptions = useCallback(async () => {
    try {
      const res = await fetch(staticFile(captionsSrc));
      const data = (await res.json()) as Caption[];
      setCaptions(data);
      continueRender(handle);
    } catch (err) {
      cancelRender(err as Error);
    }
  }, [captionsSrc, handle]);

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
        const endFrame = next ? Math.round((next.startMs / 1000) * fps) : Infinity;
        const dur = endFrame - startFrame;
        if (dur <= 0) return null;
        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={dur}
            layout="none"
          >
            <CaptionPage page={page} keywordSet={keywordSet} capitalizeSet={capitalizeSet} shiftUp={shiftUp} pipActive={pipActive} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

