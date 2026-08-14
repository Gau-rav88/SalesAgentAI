"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Linkedin,
  Phone,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScoreRing } from "@/components/common/score-ring";
import { OutreachTimeline } from "@/components/queue/outreach-timeline";
import type { OutreachDraft } from "@/types";
import { queueService } from "@/services/queue.service";
import { apiFetch } from "../../services/api-client";
const CHANNEL_ICON = { email: Mail, linkedin: Linkedin, "call-script": Phone };

export function OutreachReviewPanel({
  draft,
  index,
  total,
  onPrev,
  onNext,
  onApprove,
  onReject,
}: {
  draft: OutreachDraft;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) {
  const [pendingAction, setPendingAction] = useState<
    "approve" | "reject" | null
  >(null);

  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [recipient, setRecipient] = useState("");
  const [senderConnected, setSenderConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");

  // Check Gmail connection status on initial mount
  useEffect(() => {
    async function loadGmailStatus() {
      try {
        const data: any = await apiFetch("/auth/google/status");

        setSenderConnected(data.connected);
        setConnectedEmail(data.email || "");
      } catch (err) {
        console.error(err);
      }
    }

    loadGmailStatus();
  }, []);

  // Sync draft fields and pre-fill recipient when active draft changes
  useEffect(() => {
    setSubject(draft.subject);
    setBody(draft.body);
    setRecipient("");
  }, [draft]);

  const ChannelIcon = CHANNEL_ICON[draft.channel];

  async function handleConnectGmail() {
    try {
      const data: any = await apiFetch("/auth/google/login");

      window.location.href = data.authorization_url;
    } catch (err) {
      console.error(err);
    }
  }

  async function handleApprove() {
    setPendingAction("approve");
    try {
      await onApprove(draft.id);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReject() {
    setPendingAction("reject");
    try {
      await onReject(draft.id);
    } finally {
      setPendingAction(null);
    }
  }

  const handleApproveAndSend = async () => {
    try {
      await queueService.sendEmail(draft.id, recipient, subject, body);

      await handleApprove();

      alert("Email sent successfully!");
    } catch (err) {
      console.error(err);

      alert("Failed to send email.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-white/90">
            {draft.companyName} · {draft.stakeholderName}
          </h3>
          <p className="text-xs text-white/40">{draft.subject}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={total <= 1}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </Button>
          <span className="px-1 text-xs text-white/30">
            {index + 1} / {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={total <= 1}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={draft.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]"
        >
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between border-b border-white/6 px-5 py-3">
                <div className="flex items-center gap-2 text-[11px] text-white/40">
                  <ChannelIcon className="h-3.5 w-3.5" /> {draft.channel}
                </div>
                <Badge
                  variant={
                    draft.status === "approved"
                      ? "success"
                      : draft.status === "rejected"
                        ? "danger"
                        : draft.status === "edited"
                          ? "outline"
                          : "warning"
                  }
                >
                  {draft.status}
                </Badge>
              </div>
              <div className="space-y-3 p-5">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/30">
                      Sender Account
                    </p>

                    {senderConnected ? (
                      <div className="mt-1 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                        <span>{connectedEmail}</span>
                        <span className="text-xs font-medium text-emerald-500">
                          Connected
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={handleConnectGmail}
                        className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
                      >
                        Connect Gmail
                      </button>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/30">
                      Recipient
                    </p>

                    <input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="recipient@company.com"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">
                    Subject
                  </p>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/20"
                  />
                </div>
                <Separator />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">
                    Message
                  </p>
                  <textarea
                    rows={12}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-transparent p-3 text-sm outline-none focus:border-white/20"
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-3 p-5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">
                    Why this draft (Reasoning)
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">
                    {draft.reasoning || "No reasoning recorded for this draft."}
                  </p>
                </div>

                {draft.evidence.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/30">
                        Supporting Evidence
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.evidence.map((e) => (
                          <span
                            key={e}
                            className="rounded-full border border-white/8 bg-white/[0.02] px-2.5 py-1 text-[11px] text-white/40"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {draft.status === "pending" || draft.status === "edited" ? (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === "reject" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  Reject
                </Button>
                <Button
                  disabled={
                    !recipient || !senderConnected || pendingAction !== null
                  }
                  onClick={handleApproveAndSend}
                >
                  {pendingAction === "approve" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Approve & Send
                </Button>
              </div>
            ) : (
              <p className="text-right text-[11px] text-white/25">
                {draft.status === "approved"
                  ? "Approved — ready for manual send"
                  : "Rejected"}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <div className="flex flex-col items-center gap-2 p-5">
                <ScoreRing
                  score={draft.confidence}
                  size={84}
                  label="confidence"
                />
                <p className="text-center text-[11px] text-white/30">
                  Based on Guardrail-verified claims from this account&apos;s
                  analysis
                </p>
              </div>
            </Card>

            <Card>
              <div className="p-5">
                <p className="mb-3 text-[10px] uppercase tracking-wider text-white/30">
                  Outreach Workflow
                </p>
                <OutreachTimeline draft={draft} />
              </div>
            </Card>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}