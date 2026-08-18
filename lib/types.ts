export const STATUSES = [
  "Não iniciado",
  "Em atendimento",
  "Em espera",
  "Teste Centauro",
  "Teste Oficial",
  "Finalizado",
] as const;

export type TicketStatus = (typeof STATUSES)[number];
export type Role = "Administrador" | "Usuário";

export interface SystemItem {
  id: string;
  name: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: "blue" | "amber" | "violet" | "slate" | "emerald" | "rose";
  active: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface Stage {
  id: string;
  name: string;
  abbreviation: string;
  position: number;
  active: boolean;
}

export interface HistoryEntry {
  id: string;
  field: string;
  previousValue?: string;
  newValue: string;
  userName: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  systemId: string;
  status: TicketStatus;
  categoryId: string;
  description: string;
  responsibleId: string;
  receivedAt: string;
  finishedAt: string | null;
  stages: Record<string, boolean>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
}

export interface TicketInput {
  ticketNumber: string;
  systemId: string;
  status: TicketStatus;
  categoryId: string;
  description: string;
  responsibleId: string;
  receivedAt: string;
  stages: Record<string, boolean>;
}

export interface AppData {
  tickets: Ticket[];
  systems: SystemItem[];
  categories: Category[];
  users: User[];
  stages: Stage[];
}
