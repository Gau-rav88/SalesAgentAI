"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrustDistributionPoint } from "@/types";

function colorFor(bucket: string) {
  const low = parseInt(bucket.split("-")[0], 10);
  if (low >= 80) return "#22c55e";
  if (low >= 60) return "#e5e4e2";
  if (low >= 40) return "#8a8a8a";
  return "#4a4a4a";
}

export function TrustDistributionChart({ data }: { data: TrustDistributionPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trust Score Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          {total === 0 ? (
            <p className="flex h-full items-center justify-center text-xs text-white/30">
              No trust scores yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: -20, right: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="bucket"
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
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{
                    background: "#151515",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "#fff",
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {data.map((entry) => (
                    <Cell key={entry.bucket} fill={colorFor(entry.bucket)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}