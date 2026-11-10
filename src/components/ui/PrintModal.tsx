import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";

/** Modal that shows a document and prints only that document (see the @media print rules in styles.css). */
export function PrintModal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey); document.body.classList.add("printing-modal-open");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("printing-modal-open"); };
  }, [onClose]);
  return createPortal(
    <div className="modal-scrim print-scrim" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-card print-modal ${wide ? "print-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="print-modal-bar no-print">
          <strong>{title}</strong>
          <div>
            <button className="btn small primary" onClick={() => window.print()}><Printer size={15} /> Print</button>
            <button className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="print-area">{children}</div>
      </div>
    </div>,
    document.body
  );
}
