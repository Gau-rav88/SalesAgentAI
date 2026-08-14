"use client";

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS } from "@/lib/constants";
import type { ResearchActivityPoint } from "@/types";

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ResearchActivityLineChart({ data }: { data: ResearchActivityPoint[] }) {
  const hasActivity = data.some((d) => d.analyses > 0);
  const chartData = data.map((d) => ({ ...d, date: formatDay(d.date) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Research Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          {!hasActivity ? (
            <p className="flex h-full items-center justify-center text-xs text-white/30">
              No analyses run in the last 14 days.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -20, right: 8 }}>
                <defs>
                  <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.white} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART_COLORS.white} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#151515",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "#fff",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="analyses"
                  stroke="#ffffff"
                  strokeWidth={2}
                  fill="url(#activityFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}