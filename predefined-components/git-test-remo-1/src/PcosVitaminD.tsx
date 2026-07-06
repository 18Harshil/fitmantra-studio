import { useCallback, useEffect, useMemo, useState } from "react";
import {
	AbsoluteFill,
	cancelRender,
	continueRender,
	delayRender,
	Easing,
	Sequence,
	Video,
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

const { fontFamily: poppinsFamily } = loadPoppins("normal", {
	weights: ["600", "700", "800"],
	subsets: ["latin"],
});

const FPS = 30;
const CROSSFADE_FRAMES = 10;

const WHITE = "#FFFFFF";
const ACCENT = "#166358";

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
	"insulin",
	"sensitivity",
	"menstrual",
	"androgen",
	"inflammation",
	"game",
	"changer",
	"magic",
]);

// --- Speech-only timeline (no B-roll gaps) ---
type SpeechSeg = { srcStartSec: number; srcEndSec: number };

const SPEECH_SEGMENTS: SpeechSeg[] = [
	{ srcStartSec: 0.07, srcEndSec: 2.54 },
	{ srcStartSec: 3.34, srcEndSec: 10.63 },
	{ srcStartSec: 10.63, srcEndSec: 20.38 },
	{ srcStartSec: 20.38, srcEndSec: 27.50 },
	{ srcStartSec: 27.50, srcEndSec: 29.13 },
	{ srcStartSec: 29.55, srcEndSec: 40.91 },
	{ srcStartSec: 44.42, srcEndSec: 47.18 },
	{ srcStartSec: 47.18, srcEndSec: 58.42 },
	{ srcStartSec: 58.42, srcEndSec: 64.90 },
];

type CompiledSpeech = SpeechSeg & {
	from: number;
	dur: number;
	outStartSec: number;
	outEndSec: number;
};

const COMPILED: CompiledSpeech[] = (() => {
	let cursor = 0;
	return SPEECH_SEGMENTS.map((seg) => {
		const dur = Math.round((seg.srcEndSec - seg.srcStartSec) * FPS);
		const from = cursor;
		cursor += dur;
		return {
			...seg,
			from,
			dur,
			outStartSec: from / FPS,
			outEndSec: (from + dur) / FPS,
		};
	});
})();

const BODY_FRAMES = COMPILED[COMPILED.length - 1].from + COMPILED[COMPILED.length - 1].dur;
const OUTRO_FRAMES = Math.round(OUTRO_DURATION_SECONDS * FPS);
export const PCOS_VITAMIND_TOTAL_FRAMES = BODY_FRAMES + OUTRO_FRAMES;

// --- B-roll overlays (visual only, voice continues) ---
type BRollOverlay = { src: string; outStartSec: number; durationSec: number; isTextCard?: boolean };

const BROLL_OVERLAYS: BRollOverlay[] = [
	{ src: "broll_pcod.mp4", outStartSec: 0, durationSec: 2.8, isTextCard: true },
	{ src: "broll_research.mp4", outStartSec: COMPILED[2].outStartSec + 0.5, durationSec: 3.0 },
	{ src: "broll_vitamind.mp4", outStartSec: COMPILED[3].outStartSec + 1.0, durationSec: 3.0 },
	{ src: "broll_food.mp4", outStartSec: COMPILED[5].outStartSec + 3.0, durationSec: 3.0 },
	{ src: "broll_sunlight.mp4", outStartSec: COMPILED[7].outStartSec + 2.0, durationSec: 3.0 },
];

// --- Caption time remapping ---
const srcMsToOutMs = (srcMs: number): number | null => {
	const srcSec = srcMs / 1000;
	for (const seg of COMPILED) {
		if (srcSec >= seg.srcStartSec && srcSec <= seg.srcEndSec) {
			return (seg.outStartSec + (srcSec - seg.srcStartSec)) * 1000;
		}
	}
	return null;
};

const smoothEase = Easing.bezier(0.45, 0, 0.55, 1);

const cleanWord = (s: string) =>
	s.trim().toLowerCase().replace(/[.,?!'"'']/g, "");

const fixCaptionText = (text: string): string => {
	return text
		.replace(/\bPC\s*OS\b/gi, "PCOS")
		.replace(/[''']B[''']/g, "'D'")
		.replace(/comment\s+[''']?B[''']?/gi, "comment 'D'")
		.replace(/\binformation\b/gi, "inflammation");
};

// --- Caption components ---
const InlineWord: React.FC<{
	token: TikTokPage["tokens"][number];
	absoluteMs: number;
}> = ({ token, absoluteMs }) => {
	const word = cleanWord(token.text);
	const isKeyword = KEYWORDS.has(word);
	const fadeIn = Math.max(0, Math.min(1, (absoluteMs - token.fromMs) / 180));
	if (fadeIn <= 0) return null;
	return (
		<span
			style={{
				color: isKeyword ? ACCENT : WHITE,
				opacity: fadeIn,
				display: "inline",
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
				paddingBottom: 120,
				paddingLeft: 20,
				paddingRight: 20,
				pointerEvents: "none",
			}}
		>
			<div
				style={{
					fontFamily: poppinsFamily,
					fontSize: 26,
					fontWeight: 800,
					color: WHITE,
					textAlign: "center",
					maxWidth: 350,
					lineHeight: 1.35,
					letterSpacing: -0.2,
					wordWrap: "break-word",
					overflowWrap: "break-word",
					WebkitTextStroke: "1.5px rgba(0,0,0,0.7)",
					paintOrder: "stroke fill",
					textShadow:
						"0 2px 10px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)",
				}}
			>
				{page.tokens.map((t) => (
					<InlineWord key={t.fromMs} token={t} absoluteMs={absoluteMs} />
				))}
			</div>
		</AbsoluteFill>
	);
};

const CaptionsOverlay: React.FC = () => {
	const [captions, setCaptions] = useState<Caption[] | null>(null);
	const [handle] = useState(() => delayRender("Loading VitD captions"));
	const { fps } = useVideoConfig();

	const fetchCaptions = useCallback(async () => {
		try {
			const res = await fetch(staticFile("captions.json"));
			const data = (await res.json()) as Caption[];
			const remapped: Caption[] = [];
			for (const c of data) {
				const outStart = srcMsToOutMs(c.startMs);
				const outEnd = srcMsToOutMs(c.endMs);
				if (outStart == null || outEnd == null) continue;
				if (outEnd - outStart < 10) continue;
				remapped.push({
					text: c.text,
					startMs: outStart,
					endMs: outEnd,
					timestampMs: c.timestampMs,
					confidence: c.confidence,
				});
			}
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
			for (const m of merged) {
				m.text = fixCaptionText(m.text);
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
					: BODY_FRAMES;
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

// --- B-roll visual overlay ---
const BRollClip: React.FC<{ src: string; durationFrames: number }> = ({
	src,
	durationFrames,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const localMs = (frame / fps) * 1000;
	const totalMs = (durationFrames / fps) * 1000;

	const fadeIn = interpolate(localMs, [0, 600], [0, 1], {
		easing: smoothEase,
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const fadeOut = interpolate(localMs, [totalMs - 600, totalMs], [1, 0], {
		easing: smoothEase,
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const opacity = Math.min(fadeIn, fadeOut);
	const zoom = interpolate(localMs, [0, totalMs], [1.08, 1.0], {
		easing: smoothEase,
	});

	return (
		<AbsoluteFill style={{ opacity }}>
			<AbsoluteFill style={{ background: "#000" }} />
			<AbsoluteFill style={{ overflow: "hidden" }}>
				<Video
					src={staticFile(src)}
					muted
					loop
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
						filter: "contrast(1.05) saturate(0.95) brightness(0.96)",
						transform: `scale(${zoom})`,
					}}
				/>
			</AbsoluteFill>
			<AbsoluteFill
				style={{
					background:
						"radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.4) 100%)",
				}}
			/>
		</AbsoluteFill>
	);
};

const PcosTextCard: React.FC<{ durationFrames: number }> = ({
	durationFrames,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const localMs = (frame / fps) * 1000;
	const totalMs = (durationFrames / fps) * 1000;

	const fadeIn = interpolate(localMs, [0, 600], [0, 1], {
		easing: smoothEase,
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const fadeOut = interpolate(localMs, [totalMs - 600, totalMs], [1, 0], {
		easing: smoothEase,
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const opacity = Math.min(fadeIn, fadeOut);

	const textScale = interpolate(localMs, [200, 800], [0.85, 1], {
		easing: Easing.bezier(0.16, 1, 0.3, 1),
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const textOp = interpolate(localMs, [200, 700], [0, 1], {
		easing: smoothEase,
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const lineWidth = interpolate(localMs, [400, 1000], [0, 120], {
		easing: Easing.bezier(0.16, 1, 0.3, 1),
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	return (
		<AbsoluteFill style={{ opacity }}>
			<AbsoluteFill
				style={{
					background:
						"radial-gradient(ellipse at 50% 45%, #1a3a34 0%, #0a1612 70%, #000 100%)",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 12,
						opacity: textOp,
						transform: `scale(${textScale})`,
					}}
				>
					<div
						style={{
							fontFamily: poppinsFamily,
							fontSize: 52,
							fontWeight: 800,
							color: WHITE,
							letterSpacing: 6,
							textShadow: "0 4px 20px rgba(22,99,88,0.6)",
						}}
					>
						PCOS
					</div>
					<div
						style={{
							width: lineWidth,
							height: 3,
							background: ACCENT,
							borderRadius: 2,
						}}
					/>
					<div
						style={{
							fontFamily: poppinsFamily,
							fontSize: 16,
							fontWeight: 600,
							color: "rgba(255,255,255,0.6)",
							letterSpacing: 3,
							marginTop: 4,
						}}
					>
						VITAMIN D3
					</div>
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

// --- Speaker video + audio (back-to-back, continuous) ---
const SpeakerSegments: React.FC = () => {
	return (
		<AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
			{COMPILED.map((seg, idx) => {
				const prev = idx > 0 ? COMPILED[idx - 1] : null;
				const next =
					idx < COMPILED.length - 1 ? COMPILED[idx + 1] : null;
				const hasCutBefore = prev
					? prev.srcEndSec < seg.srcStartSec - 0.05
					: false;
				const hasCutAfter = next
					? seg.srcEndSec < next.srcStartSec - 0.05
					: false;
				return (
					<Sequence
						key={idx}
						from={seg.from}
						durationInFrames={seg.dur}
						layout="none"
					>
						<SpeechSegment
							srcStartSec={seg.srcStartSec}
							srcEndSec={seg.srcEndSec}
							dur={seg.dur}
							fadeIn={hasCutBefore}
							fadeOut={hasCutAfter}
						/>
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};

const SpeechSegment: React.FC<{
	srcStartSec: number;
	srcEndSec: number;
	dur: number;
	fadeIn: boolean;
	fadeOut: boolean;
}> = ({ srcStartSec, srcEndSec, dur, fadeIn, fadeOut }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const DIP = CROSSFADE_FRAMES;

	const opIn = fadeIn
		? interpolate(frame, [0, DIP], [0, 1], {
				easing: smoothEase,
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
			})
		: 1;
	const opOut = fadeOut
		? interpolate(frame, [dur - DIP, dur], [1, 0], {
				easing: smoothEase,
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
			})
		: 1;
	const opacity = Math.min(opIn, opOut);

	const scaleIn = fadeIn
		? interpolate(frame, [0, DIP], [1.03, 1], {
				easing: smoothEase,
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
			})
		: 1;

	return (
		<AbsoluteFill style={{ opacity }}>
			<AbsoluteFill
				style={{
					background: "#000",
					overflow: "hidden",
					transform: `scale(${scaleIn})`,
				}}
			>
				<Video
					src={staticFile("main.mp4")}
					startFrom={Math.round(srcStartSec * fps)}
					endAt={Math.round(srcEndSec * fps)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
						filter: "contrast(1.04) saturate(0.96) brightness(1.02)",
					}}
				/>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

// --- B-roll overlay layer (visual only, voice plays behind) ---
const BRollLayer: React.FC = () => {
	return (
		<>
			{BROLL_OVERLAYS.map((broll, i) => {
				const fromFrame = Math.round(broll.outStartSec * FPS);
				const durFrames = Math.round(broll.durationSec * FPS);
				return (
					<Sequence
						key={`broll-${i}`}
						from={fromFrame}
						durationInFrames={durFrames}
						layout="none"
					>
						{broll.isTextCard ? (
							<PcosTextCard durationFrames={durFrames} />
						) : (
							<BRollClip src={broll.src} durationFrames={durFrames} />
						)}
					</Sequence>
				);
			})}
		</>
	);
};

// --- UI overlays ---
const BottomGradient: React.FC = () => (
	<AbsoluteFill
		style={{
			background:
				"linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.7) 85%, rgba(0,0,0,0.9) 100%)",
			pointerEvents: "none",
		}}
	/>
);

const TopBackdrop: React.FC = () => (
	<AbsoluteFill
		style={{
			background:
				"linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.15) 20%, transparent 35%)",
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
				top: 24,
				right: 24,
				opacity: enter * 0.85,
				transform: `scale(${0.9 + enter * 0.1})`,
				filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.45))",
			}}
		>
			<FitMantraLogo size={60} />
		</div>
	);
};

// --- Main composition ---
export const PcosVitaminD: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const mainExitFade = interpolate(
		frame,
		[BODY_FRAMES - 0.5 * fps, BODY_FRAMES],
		[1, 0],
		{
			easing: smoothEase,
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		},
	);

	return (
		<AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
			<Sequence durationInFrames={BODY_FRAMES + 12} layout="none">
				<AbsoluteFill style={{ opacity: mainExitFade }}>
					<SpeakerSegments />
					<BRollLayer />
					<TopBackdrop />
					<BottomGradient />
					<CaptionsOverlay />
				</AbsoluteFill>
			</Sequence>
			<Sequence
				from={BODY_FRAMES}
				durationInFrames={OUTRO_FRAMES}
				layout="none"
			>
				<BrandOutro />
			</Sequence>
			<Sequence durationInFrames={BODY_FRAMES} layout="none">
				<TopRightLogo />
			</Sequence>
		</AbsoluteFill>
	);
};
