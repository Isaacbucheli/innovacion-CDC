import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  }
  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="absolute top-2 right-2 h-7" onClick={copy}>
        {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}{copied ? "Copiado" : "Copiar"}
      </Button>
      <pre className="bg-secondary rounded-md p-3 pr-20 text-xs font-mono whitespace-pre-wrap break-words overflow-auto max-h-80">{code}</pre>
    </div>
  );
}
