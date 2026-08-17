export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface Scene {
  start: number;
  end: number;
  tone: "educational" | "inspirational" | "cautionary" | "conversational";
  visual_type: "talking_head" | "broll_image" | "broll_video" | "text_card";
  visual_concept: string;
  transition_in: "fade" | "slide_left" | "slide_right" | "zoom_in";
  transition_out: "fade" | "slide_left" | "slide_right" | "zoom_out";
  narration_summary: string;
  remotion_visual_src: string | null;
}

export interface StatOverlay {
  timestamp: number;
  text: string;
  duration: number;
  large?: boolean;
  verticalOffset?: number;
}

export type BrollOverlay = {
  from_ms: number;
  to_ms: number;
  src: string;
  trim_seconds: number;
  object_position?: string;
};

export interface SuggestedCut {
  start: number;
  end: number;
  reason: string;
  confidence: number;
}

export interface ZoomEvent {
  /** When the keyword starts (ms from video start) */
  timestamp_ms: number;
  /** How long the zoom animation lasts, in ms */
  duration_ms: number;
  /** Target scale at peak zoom, e.g. 1.08 */
  scale: number;
}

export interface BgImageOverlay {
  timestamp: number;
  duration: number;
  src: string;
}

export interface PipEvent {
  timestamp: number;
  duration: number;
  pip_source: string;
  pip_description: string;
  pip_format: "pip" | "full";
}

export interface RemotionData {
  video: {
    src: string;
    duration_seconds: number;
    fps: number;
    width: number;
    height: number;
    /** Optional CSS filter for the main video. "none" disables all filters. */
    video_filter?: string;
  };
  words: Word[];
  scenes: Scene[];
  stat_overlays: StatOverlay[];
  pip_events: PipEvent[];
  bg_image_overlays: BgImageOverlay[];
  captions_src: string;
  highlight_keywords: string[];
  capitalize_words: string[];
  /** Vertical caption position: fraction of height to lift captions (negative = higher, positive = lower). Default 0. */
  captions_offset?: number;
  outro: {
    type: "video" | "logo";
    duration_seconds: number;
  };
  broll_overlays: BrollOverlay[];
  zoom_events: ZoomEvent[];
  brand: {
    logo_src: string;
    show_logo_watermark: boolean;
    logo_position: "top-right" | "top-left";
    logo_size: number;
  };
  suggested_cuts: SuggestedCut[];
  suggested_caption: string;
  hashtags: string;
  suggested_title: string;
  overall_mood: "calm" | "energetic" | "serious" | "inspirational";
}
