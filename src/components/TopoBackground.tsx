type Dot = { x: number; y: number; r: number; dur: number; delay: number };

// Deterministic pseudo-random scatter (jittered grid) so SSR and client match.
function makeDots(): Dot[] {
  const dots: Dot[] = [];
  const cols = 5;
  const rows = 4;
  let n = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const jx = ((n * 37) % 11) / 11 - 0.5;
      const jy = ((n * 53) % 13) / 13 - 0.5;
      dots.push({
        x: ((col + 0.5) / cols) * 1600 + jx * 190,
        y: ((row + 0.5) / rows) * 900 + jy * 150,
        r: 3 + ((n * 7) % 3),
        dur: 6 + ((n * 3) % 5),
        delay: (n * 0.7) % 6,
      });
      n++;
    }
  }
  return dots;
}

const DOTS = makeDots();

const LINKS: [number, number][] = DOTS.flatMap((_, i) => {
  const out: [number, number][] = [];
  if ((i + 1) % 5 !== 0 && i + 1 < DOTS.length) out.push([i, i + 1]);
  if (i + 5 < DOTS.length) out.push([i, i + 5]);
  if ((i + 1) % 5 !== 0 && i + 6 < DOTS.length && i % 2 === 0) out.push([i, i + 6]);
  return out;
});

export function TopoBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg
        className="h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {LINKS.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={DOTS[a].x}
            y1={DOTS[a].y}
            x2={DOTS[b].x}
            y2={DOTS[b].y}
            stroke="var(--primary)"
            strokeOpacity={0.15}
            strokeWidth={1}
            strokeDasharray="5 8"
          />
        ))}
        {DOTS.map((d, i) => (
          <g key={i}>
            <circle
              className="scan-dot"
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill="var(--primary)"
              fillOpacity={0.24}
              style={
                {
                  "--dot-dur": `${d.dur}s`,
                  "--dot-delay": `${d.delay}s`,
                } as React.CSSProperties
              }
            />
            <circle
              className="scan-dot"
              cx={d.x}
              cy={d.y}
              r={d.r * 3}
              stroke="var(--primary)"
              strokeOpacity={0.14}
              strokeWidth={1}
              style={
                {
                  "--dot-dur": `${d.dur + 2}s`,
                  "--dot-delay": `${d.delay + 1}s`,
                } as React.CSSProperties
              }
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
