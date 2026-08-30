interface SVGOverlayProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function SVGOverlay({
  x,
  y,
  width,
  height,
}: SVGOverlayProps) {
  return (
    <svg
      className="svg-overlay"
      viewBox="0 0 768 1086"
      preserveAspectRatio="none"
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}