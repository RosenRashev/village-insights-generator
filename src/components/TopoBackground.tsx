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

type Link = { x1: number; y1: number; x2: number; y2: number };

const LINKS: Link[] = DOTS.flatMap((_, i) => {
  const out: Link[] = [];
  const a = DOTS[i]!;
  const push = (j: number) => {
    const b = DOTS[j];
    if (b) out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  };
  if ((i + 1) % 5 !== 0) push(i + 1);
  push(i + 5);
  if ((i + 1) % 5 !== 0 && i % 2 === 0) push(i + 6);
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
        {LINKS.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="var(--primary)"
            strokeOpacity={0.3}
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
              fillOpacity={0.46}
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
              strokeOpacity={0.27}
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
