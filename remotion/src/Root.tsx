import { Composition } from "remotion";
import { MainVideo } from "./compositions/MainVideo";
import type { RemotionData } from "./types";

// Import data — in preview this comes from public/remotion_data.json
// In render it is passed via --props
import data from "../public/remotion_data.json";

export const RemotionRoot: React.FC = () => {
  const typedData = data as unknown as RemotionData;
  const fps = typedData.video.fps;
  const bodyFrames = Math.ceil(typedData.video.duration_seconds * fps);
  const outroFrames = Math.round((typedData.outro?.duration_seconds ?? 4.78) * fps);
  const durationInFrames = bodyFrames + outroFrames;

  return (
    <Composition
      id="MainVideo"
      component={MainVideo as unknown as React.FC<Record<string, unknown>>}
      durationInFrames={durationInFrames}
      fps={fps}
      width={typedData.video.width}
      height={typedData.video.height}
      defaultProps={{ data: typedData }}
    />
  );
};