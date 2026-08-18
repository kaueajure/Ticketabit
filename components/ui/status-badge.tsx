import { TicketStatus } from "@/lib/types";

const statusClasses: Record<TicketStatus, string> = {
  "Não iniciado": "status-neutral",
  "Em atendimento": "status-blue",
  "Em espera": "status-amber",
  "Teste Centauro": "status-violet",
  "Teste Oficial": "status-red",
  "Finalizado": "status-green",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`status-badge ${statusClasses[status]}`}><span className="status-dot" />{status}</span>;
}

export function CategoryBadge({ name, color = "slate" }: { name: string; color?: string }) {
  return <span className={`category-badge category-${color}`}>{name}</span>;
}
