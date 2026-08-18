import { StatusColor, TicketStatus } from "@/lib/types";

const defaultColors: Record<string, StatusColor> = {
  "Não iniciado": "neutral",
  "Em atendimento": "blue",
  "Em espera": "amber",
  "Teste Centauro": "violet",
  "Teste Oficial": "red",
  "Finalizado": "green",
};

export function StatusBadge({ status, color }: { status: TicketStatus; color?: StatusColor }) {
  return <span className={`status-badge status-${color ?? defaultColors[status] ?? "neutral"}`}><span className="status-dot" />{status}</span>;
}

export function CategoryBadge({ name, color = "slate" }: { name: string; color?: string }) {
  return <span className={`category-badge category-${color}`}>{name}</span>;
}
