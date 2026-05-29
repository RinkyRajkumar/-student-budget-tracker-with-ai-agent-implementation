import { AlertTriangle, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CONFIRM_EVENT } from "../services/confirmDialog.js";

export default function SpendlyConfirmHost() {
  const [request, setRequest] = useState(null);

  useEffect(() => {
    function openConfirm(event) {
      setRequest(event.detail);
    }
    window.addEventListener(CONFIRM_EVENT, openConfirm);
    return () => window.removeEventListener(CONFIRM_EVENT, openConfirm);
  }, []);

  if (!request) return null;

  function close(result) {
    request.resolve(Boolean(result));
    setRequest(null);
  }

  const destructive = request.tone === "danger";

  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/70 px-4 backdrop-blur-md" role="dialog" aria-modal="true">
      <section className="w-full max-w-md rounded-[28px] border border-violet-300/20 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_18rem),rgba(10,12,28,0.96)] p-5 text-slate-100 shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
        <div className="flex items-start gap-4">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${destructive ? "bg-rose-500/15 text-rose-200" : "bg-violet-500/15 text-violet-200"}`}>
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black tracking-normal text-white">{request.title}</h2>
            {request.message && <p className="mt-2 text-sm leading-6 text-slate-400">{request.message}</p>}
          </div>
          <button className="rounded-2xl bg-white/8 p-2 text-slate-300 transition hover:bg-white/12 hover:text-white" onClick={() => close(false)} aria-label="Close confirmation">
            <X size={17} />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn-soft justify-center" onClick={() => close(false)}>{request.cancelLabel}</button>
          <button className={`${destructive ? "btn-danger" : "btn-primary"} justify-center`} onClick={() => close(true)}>
            <Check size={16} />
            {request.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
