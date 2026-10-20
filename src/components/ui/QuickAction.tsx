// src/components/ui/QuickAction.tsx
import React from "react";
import { ArrowRight } from "lucide-react";

export function QuickAction({ icon: Icon, title, desc, onClick }: any) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span className="quick-icon">
        <Icon size={19} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{desc}</small>
      </span>
      <ArrowRight size={16} className="quick-arrow" />
    </button>
  );
}
