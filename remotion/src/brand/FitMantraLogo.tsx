import { Img, staticFile } from "remotion";

export const FitMantraLogo: React.FC<{
  size?: number;
  src?: string;
}> = ({ size = 200, src = "logo.png" }) => {
  return (
    <Img
      src={staticFile(src)}
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

