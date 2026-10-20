// src/components/ui/Status.tsx
import React from "react";

export function Status({ status }: { status?: string }) {
  const s = String(status || "UNKNOWN");
  let cls = ["PAID", "DELIVERED", "PICKED UP", "READY FOR PICKUP"].includes(s)
    ? "success"
    : ["PENDING", "CONFIRMED", "OUT FOR-DELIVERY"].includes(s)
      ? "warning"
      : "neutral";
  return <span className={`status ${cls}`}>{s.replaceAll("_", " ")}</span>;
}
