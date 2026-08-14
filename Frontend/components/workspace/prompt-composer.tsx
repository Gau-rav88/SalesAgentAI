"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ChevronDown,
  Mic,
  ArrowUp,
  FileText,
  Table,
  Globe,
  Building2,
  Mail,
  HardDrive,
  NotebookText,
  CalendarDays,
  X,
  Telescope,
  FileBarChart,
  Swords,
  Target,
  Zap,
  UploadCloud,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type WorkspaceMode =
  | "Deep Research"
  | "Executive Brief"
  | "Competitive Analysis"
  | "Outreach Strategy"
  | "Quick Analysis";

export type AttachmentKind =
  | "pdf"
  | "csv"
  | "url"
  | "crm"
  | "gmail"
  | "drive"
  | "notion"
  | "calendar";

export interface ComposerAttachment {
  id: string;
  kind: AttachmentKind;
  label: string;
  file?: File;
}

const MODES: { id: WorkspaceMode; icon: React.ReactNode; description: string }[] = [
  { id: "Deep Research", icon: <Telescope className="h-4 w-4" />, description: "Full multi-agent pipeline" },
  { id: "Executive Brief", icon: <FileBarChart className="h-4 w-4" />, description: "Short, decision-ready summary" },
  { id: "Competitive Analysis", icon: <Swords className="h-4 w-4" />, description: "Positioning vs. the market" },
  { id: "Outreach Strategy", icon: <Target className="h-4 w-4" />, description: "Messaging & channel plan" },
  { id: "Quick Analysis", icon: <Zap className="h-4 w-4" />, description: "Fast, lightweight pass" },
];

const ADD_ITEMS: { kind: AttachmentKind; label: string; icon: React.ReactNode; group: "resource" | "connect" }[] = [
  { kind: "pdf", label: "Upload PDF", icon: <FileText className="h-4 w-4" />, group: "resource" },
  { kind: "csv", label: "Upload CSV", icon: <Table className="h-4 w-4" />, group: "resource" },
  { kind: "url", label: "Website URL", icon: <Globe className="h-4 w-4" />, group: "resource" },
  { kind: "crm", label: "Connect CRM", icon: <Building2 className="h-4 w-4" />, group: "connect" },
  { kind: "gmail", label: "Connect Gmail", icon: <Mail className="h-4 w-4" />, group: "connect" },
  { kind: "drive", label: "Connect Google Drive", icon: <HardDrive className="h-4 w-4" />, group: "connect" },
  { kind: "notion", label: "Connect Notion", icon: <NotebookText className="h-4 w-4" />, group: "connect" },
  { kind: "calendar", label: "Connect Calendar", icon: <CalendarDays className="h-4 w-4" />, group: "connect" },
];

// ---- helpers for auto-detecting what was dropped/pasted ----

function detectFileKind(file: File): "pdf" | "csv" | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    name.endsWith(".csv")
  ) {
    return "csv";
  }
  return null;
}

// Matches things like "https://x.com", "www.x.com", "x.com/path" but not plain
// sentences ("go check google.com please") — no spaces allowed.
const URL_PATTERN = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?([/?#]\S*)?$/i;

function extractUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  if (!URL_PATTERN.test(trimmed)) return null;
  return trimmed;
}

interface PromptComposerProps {
  onSend: (text: string, meta: { mode: WorkspaceMode; attachments: ComposerAttachment[] }) => void;
  sending?: boolean;
}

export function PromptComposer({ onSend, sending }: PromptComposerProps) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<WorkspaceMode>("Deep Research");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [urlDraft, setUrlDraft] = useState("");
  const [urlOpen, setUrlOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileKind = useRef<"pdf" | "csv" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounter = useRef(0);
  const dropErrorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashDropError(message: string) {
    setDropError(message);
    if (dropErrorTimeout.current) clearTimeout(dropErrorTimeout.current);
    dropErrorTimeout.current = setTimeout(() => setDropError(null), 2500);
  }

  function addAttachment(kind: AttachmentKind, label: string, file?: File) {
    setAttachments((prev) => {
      // Connections are single-toggle; files/URLs can stack.
      if (["crm", "gmail", "drive", "notion", "calendar"].includes(kind) && prev.some((a) => a.kind === kind)) {
        return prev;
      }
      return [...prev, { id: `${kind}-${Date.now()}`, kind, label, file }];
    });
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handleAddSelect(kind: AttachmentKind) {
    if (kind === "pdf" || kind === "csv") {
      pendingFileKind.current = kind;
      fileInputRef.current?.click();
      return;
    }
    if (kind === "url") {
      setUrlOpen(true);
      return;
    }
    const item = ADD_ITEMS.find((i) => i.kind === kind);
    addAttachment(kind, item?.label.replace("Connect ", "") ?? kind);
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const kind = pendingFileKind.current;
    if (file && kind) {
      addAttachment(kind, file.name, file);
    }
    e.target.value = "";
    pendingFileKind.current = null;
  }

  function confirmUrl() {
    const trimmed = urlDraft.trim();
    if (trimmed) {
      addAttachment("url", trimmed.replace(/^https?:\/\//, ""));
    }
    setUrlDraft("");
    setUrlOpen(false);
  }

  // ---- unified router: given a File OR a raw text string, decide pdf / csv / url ----
  function routeIncoming(file: File | null, text: string | null): boolean {
    if (file) {
      const kind = detectFileKind(file);
      if (kind) {
        addAttachment(kind, file.name, file);
        return true;
      }
      flashDropError("Only PDF or CSV files are supported");
      return false;
    }
    if (text) {
      const url = extractUrl(text);
      if (url) {
        addAttachment("url", url.replace(/^https?:\/\//, ""));
        return true;
      }
    }
    return false;
  }

  // ---- drag & drop on the whole composer ----
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("text/plain")) {
      setIsDragging(true);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);

    // Only ever take the first item — one attachment per drop.
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) {
      routeIncoming(file, null);
      return;
    }

    const text =
      e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (text) {
      const handled = routeIncoming(null, text);
      if (!handled) flashDropError("Drop a PDF, CSV, or a link");
    }
  }

  // ---- paste (Ctrl/Cmd+V) into the textarea ----
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const file = e.clipboardData.files?.[0] ?? null;
    if (file) {
      // A real file was pasted (e.g. copied from Finder/Explorer) — never let it
      // dump binary/garbage text into the box.
      e.preventDefault();
      routeIncoming(file, null);
      return;
    }

    const text = e.clipboardData.getData("text/plain");
    const url = text ? extractUrl(text) : null;
    if (url) {
      e.preventDefault();
      addAttachment("url", url.replace(/^https?:\/\//, ""));
      return;
    }
    // Otherwise it's plain text — let the browser paste it into the textarea as normal.
  }

  function handleSend() {
    if (!prompt.trim() || sending) return;
    onSend(prompt.trim(), { mode, attachments });
    setPrompt("");
    setAttachments([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const activeMode = MODES.find((m) => m.id === mode)!;

  return (
    <div className="border-t border-white/6 p-3">
      <input ref={fileInputRef} type="file" accept=".pdf,.csv" className="hidden" onChange={handleFileChosen} />

      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-2xl border border-white/8 bg-white/[0.02] transition-colors focus-within:border-white/20 focus-within:bg-white/[0.03]",
          isDragging && "border-white/40 bg-white/[0.06]",
        )}
      >
        {/* Drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/30 bg-black/60 text-[13px] font-medium text-white/80"
            >
              <UploadCloud className="h-4 w-4" />
              Drop PDF, CSV, or a link
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drop/paste error toast */}
        <AnimatePresence>
          {dropError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300"
            >
              {dropError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attachment chips */}
        <AnimatePresence initial={false}>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-1.5 px-3.5 pt-3">
                {attachments.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] py-1 pl-2.5 pr-1.5 text-[11px] font-medium text-white/70"
                  >
                    {a.label}
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="rounded-full p-0.5 text-white/40 hover:bg-white/10 hover:text-white/80"
                      aria-label={`Remove ${a.label}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inline URL entry */}
        <AnimatePresence initial={false}>
          {urlOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden px-3.5 pt-3"
            >
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5">
                <Globe className="h-3.5 w-3.5 shrink-0 text-white/40" />
                <input
                  autoFocus
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmUrl();
                    }
                    if (e.key === "Escape") setUrlOpen(false);
                  }}
                  placeholder="https://company.com"
                  className="flex-1 bg-transparent text-[13px] text-white/85 placeholder-white/25 outline-none"
                />
                <button
                  type="button"
                  onClick={confirmUrl}
                  className="text-[11px] font-medium text-white/60 hover:text-white"
                >
                  Add
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          ref={textareaRef}
          className="w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[14px] leading-relaxed text-white/90 placeholder-white/30 focus:outline-none"
          rows={2}
          placeholder="Research a company, upload resources, or ask ProspectIQ to generate a sales strategy..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={sending}
        />

        <div className="flex flex-col gap-3 px-2.5 pb-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* "+" attach/connect menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                  aria-label="Add resources or connect sources"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Add resources</DropdownMenuLabel>
                {ADD_ITEMS.filter((i) => i.group === "resource").map((item) => (
                  <DropdownMenuItem key={item.kind} onSelect={() => handleAddSelect(item.kind)}>
                    <span className="text-white/50">{item.icon}</span>
                    {item.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Connect a source</DropdownMenuLabel>
                {ADD_ITEMS.filter((i) => i.group === "connect").map((item) => {
                  const connected = attachments.some((a) => a.kind === item.kind);
                  return (
                    <DropdownMenuItem key={item.kind} onSelect={() => handleAddSelect(item.kind)}>
                      <span className="text-white/50">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {connected && <span className="text-[10px] text-emerald-400">Connected</span>}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mode selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[12px] font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                >
                  <span className="text-white/50">{activeMode.icon}</span>
                  <span className="hidden sm:inline">{mode}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel>Research mode</DropdownMenuLabel>
                {MODES.map((m) => (
                  <DropdownMenuItem key={m.id} onSelect={() => setMode(m.id)}>
                    <span className="text-white/50">{m.icon}</span>
                    <span className="flex-1">
                      <span className={cn("block", m.id === mode && "text-white")}>{m.id}</span>
                      <span className="block text-[10px] text-white/35">{m.description}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/50 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
              aria-label="Voice input"
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!prompt.trim() || sending}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all",
                prompt.trim() && !sending
                  ? "btn-metallic"
                  : "cursor-not-allowed bg-white/[0.05] text-white/25",
              )}
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}