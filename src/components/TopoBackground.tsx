const LINES = Array.from({ length: 14 }, (_, i) => i);

function contour(index: number) {
  const y = 40 + index * 62;
  const amp = 14 + (index % 4) * 6;
  const seg = 120;
  let d = `M -200 ${y}`;
  for (let x = -200; x < 1800; x += seg * 2) {
    d += ` q ${seg / 2} ${-amp} ${seg} 0 q ${seg / 2} ${amp} ${seg} 0`;
  }
  return d;
}

export function TopoBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <svg
        className="topo-drift h-[140vh] w-[160vw] -translate-x-[10vw]"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {LINES.map((i) => (
          <path
            key={i}
            d={contour(i)}
            stroke="var(--primary)"
            strokeOpacity={i % 3 === 0 ? 0.22 : 0.14}
            strokeWidth={i % 3 === 0 ? 1.6 : 1}
          />
        ))}
      </svg>
    </div>
  );
}
