import { useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { addWafComment } from "@/lib/api";
import { canEditModule } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import type { WafComment } from "@/types";

export default function Comments({ clientId, canonicalId, comments, onAdded }: {
  clientId: number; canonicalId: number; comments: WafComment[]; onAdded: () => void;
}) {
  const editable = canEditModule("waf");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await addWafComment(clientId, canonicalId, text.trim());
      setText("");
      toast.success("Comentario agregado");
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al comentar");
    } finally { setSending(false); }
  }

  return (
    <div className="space-y-3">
      {comments.length === 0 ? <p className="text-sm text-muted-foreground">Sin comentarios.</p> : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.comment_id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground grid place-items-center text-[11px] font-medium shrink-0">
                {c.user_display.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm">{c.comment_text}</div>
                <div className="text-[11px] text-muted-foreground">{c.user_display} · {fmtDate(c.created_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="flex gap-2 items-end">
          <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un comentario…" className="flex-1" />
          <Button variant="outline" onClick={send} disabled={sending || !text.trim()}>Enviar</Button>
        </div>
      )}
    </div>
  );
}
