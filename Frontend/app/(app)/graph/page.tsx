"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { RelationshipGraph } from "@/components/graph/relationship-graph";
import { accountsService } from "@/services/accounts.service";
import { workspaceService } from "@/services/workspace.service";
import { ApiError } from "@/services/api-client";
import type { Company, RelationshipEdge, RelationshipNode } from "@/types";

export default function GraphPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-11rem)] items-center justify-center text-sm text-white/40">
          Loading…
        </div>
      }
    >
      <GraphPageInner />
    </Suspense>
  );
}

function GraphPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get("company");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [nodes, setNodes] = useState<RelationshipNode[]>([]);
  const [edges, setEdges] = useState<RelationshipEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the account list once, and default to the first account if
  // none is selected in the URL.
  useEffect(() => {
    let cancelled = false;

    accountsService
      .list()
      .then((data) => {
        if (cancelled) return;
        setCompanies(data);
        if (!companyId && data.length > 0) {
          router.replace(`/graph?company=${data[0].id}`);
        }
      })
      .catch(() => {
        /* handled by the empty-state below */
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    workspaceService
      .getGraph(companyId)
      .then((data) => {
        if (cancelled) return;
        setNodes(data.nodes as RelationshipNode[]);
        setEdges(data.edges as RelationshipEdge[]);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message || "Could not load the relationship graph."
            : "Could not reach the backend. Make sure the FastAPI server is running.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const activeCompany = companies.find((c) => c.id === companyId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-white/70">
            Relationship Graph{activeCompany ? ` — ${activeCompany.name}` : ""}
          </h2>
          <p className="text-xs text-white/35">
            Hover a node to see role, confidence, evidence, pain points, and buying signals.
          </p>
        </div>

        {companies.length > 0 && (
          <select
            value={companyId ?? ""}
            onChange={(e) => router.push(`/graph?company=${e.target.value}`)}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 outline-none"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#111]">
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div className="flex h-[calc(100vh-11rem)] items-center justify-center gap-2 rounded-2xl border border-white/8 bg-[#0c0c0c] text-sm text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading graph…
        </div>
      )}

      {!loading && error && (
        <div className="flex h-[calc(100vh-11rem)] items-center justify-center rounded-2xl border border-white/8 bg-[#0c0c0c]">
          <p className="max-w-sm text-center text-xs text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && companies.length === 0 && (
        <div className="flex h-[calc(100vh-11rem)] items-center justify-center rounded-2xl border border-white/8 bg-[#0c0c0c]">
          <p className="max-w-sm text-center text-xs text-white/30">
            No accounts yet — run a company brief through the AI Workspace chat to see its
            relationship graph here.
          </p>
        </div>
      )}

      {!loading && !error && companies.length > 0 && <RelationshipGraph nodes={nodes} edges={edges} />}
    </div>
  );
}