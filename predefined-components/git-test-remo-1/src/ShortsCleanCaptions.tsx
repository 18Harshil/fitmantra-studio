import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Sequence,
  staticFile,
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
import { loadFont } from "@remotion/google-fonts/Lora";

const { fontFamily: loraFamily } = loadFont("normal", {
  weights: ["500", "600"],
  subsets: ["latin"],
});

const SUBTITLE_COLOR = "#0EA572";
const SUBTITLE_FONT_FAMILY = `"Bell MT", ${loraFamily}, Georgia, serif`;
const SWITCH_CAPTIONS_EVERY_MS = 1300;

const CleanCaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 140,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: SUBTITLE_FONT_FAMILY,
          fontSize: 56,
          fontWeight: 600,
          color: SUBTITLE_COLOR,
          textAlign: "center",
          maxWidth: 940,
          lineHeight: 1.32,
          textShadow: "0 2px 8px rgba(0,0,0,0.55)",
          whiteSpace: "pre-wrap",
          letterSpacing: 0.3,
        }}
      >
        {page.tokens.map((t) => t.text).join("")}
      </div>
    </AbsoluteFill>
  );
};

export const ShortsCleanCaptions: React.FC = () => {
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
            <CleanCaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
