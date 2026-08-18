"use client";

import { Check } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";

export function Toast() {
  const { notice } = useApp();
  return (
    <div className={`toast ${notice ? "toast-visible" : ""}`} role="status">
      <span className="toast-icon"><Check size={13} strokeWidth={2.5} /></span>
      {notice}
    </div>
  );
}
