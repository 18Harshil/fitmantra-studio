import { Img, staticFile } from "remotion";

export const FitMantraLogo: React.FC<{
  size?: number;
  withBadge?: boolean;
}> = ({ size = 200 }) => {
  return (
    <Img
      src={staticFile("logo.png")}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        borderRadius: "50%",
      }}
    />
  );
};
