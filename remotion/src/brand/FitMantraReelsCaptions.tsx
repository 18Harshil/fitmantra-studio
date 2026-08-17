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
import { loadFont } from "@remotion/google-fonts/Lora";

const { fontFamily: loraFamily } = loadFont("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"],
});

const FONT_FAMILY = `"Bell MT", ${loraFamily}, Georgia, serif`;
const HIGHLIGHT_COLOR = "#00C853";
const TEXT_COLOR = "#FFFFFF";

const SWITCH_CAPTIONS_EVERY_MS = 950;

const cleanWord = (s: string) =>
  s.trim().toLowerCase().replace(/[.,?!'"'']/g, "");

const cleanWord2 = (s: string) =>
  s.trim().toLowerCase().replace(/[.,?!'"'']/g, "");

const Token: React.FC<{
  token: TikTokPage["tokens"][number];
  absoluteMs: number;
  keywordSet: ReadonlySet<string>;
  capitalizeSet: ReadonlySet<string>;
}> = ({ token, absoluteMs, keywordSet, capitalizeSet }) => {
  const word = cleanWord2(token.text);
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
            color: HIGHLIGHT_COLOR,
            fontFamily: FONT_FAMILY,
            fontWeight: 700,
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
        fontFamily: FONT_FAMILY,
        fontWeight: 700,
        whiteSpace: "pre",
        color: "#FFFFFF",
      }}
    >
      {textContent}
    </span>
  );
};

const CaptionPage: React.FC<{
  page: TikTokPage;
  keywordSet: ReadonlySet<string>;
  capitalizeSet: ReadonlySet<string>;
  shiftUp?: boolean;
  pipActive?: boolean;
  verticalOffset?: number;
}> = ({ page, keywordSet, capitalizeSet, shiftUp = false, pipActive = false, verticalOffset = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const absoluteMs = page.startMs + (frame / fps) * 1000;

  const pad = Math.round(height * 0.27);
  const padShifted = Math.round(height * 0.39);
  const offsetPx = Math.round(-height * verticalOffset);
  const normalFont = Math.round(height * 0.035);
  const containerMaxW = Math.round(height * 0.55);
  const pipMaxW = Math.round(height * 0.30);

  return (
    <AbsoluteFill
      style={{
        alignItems: pipActive ? "flex-start" : "center",
        justifyContent: "flex-end",
        paddingBottom: (shiftUp ? padShifted : pad) + offsetPx,
        paddingLeft: pipActive ? 40 : 0,
        paddingRight: pipActive ? Math.round(height * 0.35) : 0,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          textAlign: pipActive ? "left" : "center",
          maxWidth: pipActive ? pipMaxW : containerMaxW,
          fontWeight: 700,
          fontSize: normalFont,
          lineHeight: 1.2,
          padding: "0px 8px",
          letterSpacing: 0.4,
          whiteSpace: "pre-wrap",
          borderRadius: 16,
          textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)",
        }}
      >
        {page.tokens.map((token) => (
          <Token
            key={token.fromMs}
            token={token}
            absoluteMs={absoluteMs}
            keywordSet={keywordSet}
            capitalizeSet={capitalizeSet}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const FitMantraReelsCaptions: React.FC<{
  captionsSrc?: string;
  highlightKeywords?: string[];
  capitalizeWords?: string[];
  shiftUp?: boolean;
  pipActive?: boolean;
  verticalOffset?: number;
}> = ({ captionsSrc = "captions.json", highlightKeywords = [], capitalizeWords = [], shiftUp = false, pipActive = false, verticalOffset = 0 }) => {
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
            <CaptionPage page={page} keywordSet={keywordSet} capitalizeSet={capitalizeSet} shiftUp={shiftUp} pipActive={pipActive} verticalOffset={verticalOffset} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

