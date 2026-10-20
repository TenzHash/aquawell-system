// src/components/ui/Attention.tsx
import React from "react";

export function Attention({ icon: Icon, title, value, desc }: any) {
  return (
    <div className="attention-item">
      <span className="attention-icon">
        <Icon size={18} />
      </span>
      <div>
        <small>{title}</small>
        <strong>{value}</strong>
        <p>{desc}</p>
      </div>
    </div>
  );
}
