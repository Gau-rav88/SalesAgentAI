"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Globe,
  Users,
  Brain,
  ShieldAlert,
  ListChecks,
  GitBranch,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AuditAgent, AuditEvent } from "@/types";
import { cn } from "@/lib/utils";
import AuditAgentRenderer from "./cards/AuditAgentRenderer";
const AGENT_ICON: Record<AuditAgent, React.ElementType> = {
  Orchestrator: GitBranch,
  WebCrawler: Globe,
  PeopleIntel: Users,
  ReasonEngine: Brain,
  StrategyAI: Sparkles,
  GuardrailAgent: ShieldAlert,
  QueueManager: ListChecks,
  IntentAgent: Brain,
  PersonaAgent: Users,
};

const STATUS_VARIANT: Record<
  AuditEvent["status"],
  "success" | "warning" | "outline"
> = {
  success: "success",
  warning: "warning",
  info: "outline",
};

export function AuditTimeline({
  events,
  analysis,
}: {
  events: AuditEvent[];
  analysis: any;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(
    events[0]?.id ?? null,
  );

  function getAgentData(agent: string) {
    switch (agent) {
      case "Research Agent":
        return analysis?.research;

      case "Knowledge Ingestion":
        return analysis?.knowledge;

      case "Persona Agent":
        return analysis?.persona;

      case "Intent Agent":
        return analysis?.intent;

      case "Strategy Agent":
        return analysis?.strategy;

      case "Guardrail Agent":
        return analysis?.guardrail;

      default:
        return null;
    }
  }

  return (
    <div className="relative pl-8">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/8" />
      <div className="space-y-3">
        {events.map((event, i) => {
          const Icon = AGENT_ICON[event.agent] ?? GitBranch;
          const isOpen = expandedId === event.id;
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative"
            >
              <div
                className={cn(
                  "absolute -left-8 top-3.5 flex h-[30px] w-[30px] items-center justify-center rounded-full border bg-[#111111]",
                  event.status === "success" &&
                    "border-emerald-500/30 text-emerald-400",
                  event.status === "warning" &&
                    "border-amber-500/30 text-amber-400",
                  event.status === "info" && "border-white/15 text-white/50",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>

              <Card
                className="cursor-pointer p-4 transition-colors hover:border-white/12"
                onClick={() => setExpandedId(isOpen ? null : event.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[13px] font-medium text-white/85">
                      {event.event}
                    </span>
                    <Badge variant="outline">{event.agent}</Badge>
                    <Badge variant={STATUS_VARIANT[event.status]}>
                      {event.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-white/30">
                    {event.time}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-3 border-t border-white/6 pt-3 text-[12px] leading-relaxed text-white/45">
                        {event.detail}
                      </p>
                                        
                      <AuditAgentRenderer
                        agent={event.event}
                        analysis={analysis}
                        event={event}
                    />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
