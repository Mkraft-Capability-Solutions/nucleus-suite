"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { departmentCapability, headcountTrend } from "@/lib/hrms-data";

/**
 * Tracks a media query without pulling in a dependency. It starts `false` so the
 * server render and the first client render agree, then corrects itself on mount
 * and on every subsequent viewport change.
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Phone-width breakpoint: below Tailwind's `sm`. */
const NARROW = "(max-width: 639px)";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: string | number }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="max-w-[220px] rounded-lg border border-border p-3 shadow-[var(--shadow-overlay)]"
        // Opaque popover tokens so the tooltip stays readable over any surface in
        // either theme; the Tailwind utilities alone can be composited by recharts.
        style={{ background: "var(--popover)", color: "var(--popover-foreground)" }}
      >
        <p className="truncate font-mono text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="break-words font-mono text-sm font-bold text-primary">
          {payload[0].name ? `${payload[0].name}: ` : ""}
          {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

/** Recharts draws its own focus outline around the tooltip wrapper; drop it. */
const tooltipWrapper = { outline: "none" } as const;

function EmptyChart({ note }: { note: string }) {
  return (
    <div className="grid h-[200px] min-h-[200px] w-full place-items-center sm:h-[240px]" role="status">
      <p className="px-6 text-center text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

export type TrendPoint = { month: string; headcount: number };

export function WorkforceChart({ points }: { points?: TrendPoint[] | null }) {
  const narrow = useMediaQuery(NARROW);
  if (points && points.length === 0) return <EmptyChart note="No joining records yet — headcount history builds as employees join." />;
  const data = points ?? headcountTrend;
  const max = Math.max(...data.map((point) => point.headcount), 10);
  const min = Math.max(0, Math.min(...data.map((point) => point.headcount)) - 2);
  // On a phone only ~4 labels fit along the axis without colliding.
  const tickInterval = narrow ? Math.max(0, Math.ceil(data.length / 4) - 1) : "preserveStartEnd";
  return (
    <div className="h-[200px] min-h-[200px] w-full sm:h-[240px]" aria-label="Headcount trend">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 12, right: narrow ? 6 : 10, left: narrow ? -26 : -20, bottom: 0 }}>
          <defs>
            <linearGradient id="headcount-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.24} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
            minTickGap={narrow ? 14 : 6}
            tickFormatter={(value: string) => (narrow ? String(value).slice(0, 3) : String(value))}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 10 : 12 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={narrow ? 36 : 46}
            tickCount={narrow ? 4 : 6}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 10 : 12 }}
            domain={[min, max]}
          />
          <Tooltip content={<CustomTooltip />} wrapperStyle={tooltipWrapper} cursor={{ stroke: "var(--chart-1)", strokeOpacity: .35, strokeWidth: 1.5 }} />
          <Area
            type="monotone"
            dataKey="headcount"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            fill="url(#headcount-fill)"
            activeDot={{ r: 5, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 3 }}
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export type CapabilityBar = { name: string; value: number };

export function CapabilityBars({ bars, emptyNote }: { bars?: CapabilityBar[] | null; emptyNote?: string }) {
  const narrow = useMediaQuery(NARROW);
  if (bars && bars.length === 0) return <EmptyChart note={emptyNote ?? "No data yet."} />;
  const data = bars ?? departmentCapability;
  return (
    <div className="h-[240px] min-h-[240px] w-full" aria-label="Capability score by department">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 6, right: narrow ? 6 : 15, left: narrow ? 0 : 15, bottom: 0 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[0, "dataMax + 1"]}
            axisLine={false}
            tickLine={false}
            tickCount={narrow ? 4 : 6}
            tick={{ fill: "var(--text-2)", fontSize: narrow ? 10 : 11 }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={narrow ? 70 : 84}
            tickFormatter={(value: string) => {
              const text = String(value);
              return narrow && text.length > 10 ? `${text.slice(0, 9)}…` : text;
            }}
            tick={{ fill: "var(--text)", fontSize: narrow ? 10 : 12, fontWeight: 500 }}
          />
          <Tooltip content={<CustomTooltip />} wrapperStyle={tooltipWrapper} cursor={{ fill: "var(--row-hover)" }} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={narrow ? 11 : 14} isAnimationActive={true}>
            {data.map((entry, index) => {
              const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
              return (
                <Cell
                  key={entry.name}
                  fill={colors[index % colors.length]}
                  className="transition-opacity hover:opacity-80"
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const payrollMix = [
  { name: "Net pay", value: 74, color: "var(--chart-1)" },
  { name: "Deductions", value: 14, color: "var(--chart-4)" },
  { name: "Employer cost", value: 12, color: "var(--chart-2)" },
];

export function PayrollDonut() {
  return (
    <div className="relative h-[180px] min-h-[180px] w-full sm:h-[200px]" aria-label="Payroll cost composition">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Pie
            data={payrollMix}
            dataKey="value"
            nameKey="name"
            // Percentages, not pixels, so the ring scales with the card instead of
            // spilling out of a narrow column.
            innerRadius="60%"
            outerRadius="80%"
            startAngle={90}
            endAngle={-270}
            paddingAngle={4}
            stroke="none"
            isAnimationActive={true}
          >
            {payrollMix.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} wrapperStyle={tooltipWrapper} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
        <div className="min-w-0">
          <p className="truncate font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            ₹1.24Cr
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:text-xs">
            Total cost
          </p>
        </div>
      </div>
    </div>
  );
}

const orgHealth = [
  { axis: "Retention", score: 84 },
  { axis: "Capability", score: 78 },
  { axis: "Engagement", score: 73 },
  { axis: "Mobility", score: 67 },
  { axis: "Leadership", score: 81 },
  { axis: "Diversity", score: 76 },
];

export function OrgHealthRadar() {
  const narrow = useMediaQuery(NARROW);
  return (
    <div className="h-[190px] min-h-[190px] w-full sm:h-[210px]" aria-label="Organization health across six dimensions">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {/* A smaller web at phone width leaves room for the six axis labels. */}
        <RadarChart data={orgHealth} outerRadius={narrow ? "54%" : "66%"}>
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--text-2)", fontSize: narrow ? 9 : 11 }} />
          <Radar dataKey="score" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.17} strokeWidth={2} isAnimationActive />
          <Tooltip content={<CustomTooltip />} wrapperStyle={tooltipWrapper} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
