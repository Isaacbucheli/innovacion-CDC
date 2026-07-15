import { FileSpreadsheet, FileText, Cloud, type LucideIcon } from "lucide-react";

export interface SourceMeta { label: string; icon: LucideIcon; chip: string }

const META: Record<string, SourceMeta> = {
  excel:   { label: "Excel",   icon: FileSpreadsheet, chip: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  csv:     { label: "CSV",     icon: FileText,        chip: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  advisor: { label: "Advisor", icon: Cloud,           chip: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200" },
};

export function sourceMeta(source: string | null): SourceMeta | null {
  return source ? META[source.toLowerCase()] ?? null : null;
}
