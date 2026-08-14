"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { LayoutGrid } from "lucide-react";

const Threads = dynamic(() => import("@/components/backgrounds/threads"), { ssr: false });

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090909] px-4">
      <div className="absolute inset-0 opacity-70">
        <Threads color={[1, 1, 1]} amplitude={0.5} distance={0.15} enableMouseInteraction={false} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#090909]/60 via-[#090909]/70 to-[#090909]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm"
      >
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-white to-white/70 text-[#090909]">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">ProspectIQ</span>
        </Link>

        <div className="glass-panel rounded-2xl p-7 shadow-premium">
          <h1 className="text-lg font-semibold text-white text-center">{title}</h1>
          <p className="mt-1 text-center text-xs text-white/40">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </motion.div>
    </div>
  );
}
