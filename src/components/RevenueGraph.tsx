type DayRevenue = { day: string; orders_count: number; revenue: number };

function formatShortDate(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatMonthName(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export default function RevenueGraph({ data }: { data: DayRevenue[] }) {
  const sortedData = [...data].sort((a, b) => Number(new Date(a.day)) - Number(new Date(b.day)));
  const maxRevenue = Math.max(...sortedData.map((row) => Number(row.revenue)), 1);
  const totalRevenue = sortedData.reduce((sum, row) => sum + Number(row.revenue), 0);
  const monthLabel = sortedData.length > 0 ? formatMonthName(sortedData[0].day) : "Mês atual";

  const points = sortedData.map((row, index) => {
    const x = 60 + (index * 100);
    const height = Math.max((Number(row.revenue) / maxRevenue) * 170, 12);
    return {
      ...row,
      x,
      y: 210 - height,
      barHeight: height,
      label: formatShortDate(row.day),
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 60} 220 L ${points[0]?.x ?? 60} 220 Z`;

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.18)] backdrop-blur-sm">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Receita do mês</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-black text-white tracking-tight">R$ {totalRevenue.toFixed(2)}</h2>
          <p className="mt-2 text-sm text-white/40 max-w-xl leading-relaxed">
            Gráfico dinâmico por dia do mês. Veja o fluxo de receita nos últimos dias e entenda como o movimento está crescendo.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-right">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Período</p>
          <p className="mt-2 text-sm font-semibold text-white">{monthLabel}</p>
          <p className="text-xs text-white/40">{points.length} dias analisados</p>
        </div>
      </div>

      <div className="relative rounded-[2rem] bg-slate-950/90 p-5">
        <div className="pointer-events-none absolute inset-x-0 top-6 h-full bg-gradient-to-b from-white/5 via-transparent to-transparent" />
        <svg viewBox="0 0 760 240" className="w-full h-[240px]">
          <defs>
            <linearGradient id="lineGradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(248,113,20,0.45)" />
              <stop offset="100%" stopColor="rgba(248,113,20,0)" />
            </linearGradient>
          </defs>

          <g opacity="0.3">
            {[0, 1, 2, 3].map((row) => (
              <line
                key={row}
                x1="60"
                x2="700"
                y1={50 + row * 40}
                y2={50 + row * 40}
                stroke="white"
                strokeWidth="1"
              />
            ))}
          </g>

          <path d={areaPath} fill="url(#areaGradient)" />
          <path d={linePath} fill="none" stroke="url(#lineGradient)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((point) => (
            <g key={point.day}>
              <circle cx={point.x} cy={point.y} r="7" fill="#111827" />
              <circle cx={point.x} cy={point.y} r="4.5" fill="url(#lineGradient)" />
            </g>
          ))}

          {points.map((point) => (
            <g key={`bar-${point.day}`}>
              <rect x={point.x - 16} y={220 - point.barHeight} width="32" height={point.barHeight} rx="10" fill="rgba(249,115,22,0.18)" />
            </g>
          ))}
        </svg>

        <div className="mt-4 grid grid-cols-7 gap-2 text-[10px] text-white/40">
          {points.map((point) => (
            <div key={`label-${point.day}`} className="text-center">
              <div className="font-black text-white text-xs">{Number(point.revenue).toFixed(0)}</div>
              <div>{point.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
