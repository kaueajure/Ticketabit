export type TicketStatus = string;
export type StatusColor = "neutral" | "blue" | "amber" | "violet" | "red" | "green";

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
  active: boolean;
  avatarUrl: string | null;
}

export interface StatusDefinition {
  id: string;
  name: string;
  color: StatusColor;
  position: number;
  active: boolean;
  isFinal: boolean;
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
  responsibleIds: string[];
  receivedAt: string;
  finishedAt: string | null;
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
  responsibleIds: string[];
  receivedAt: string;
  finishedAt: string | null;
}

export type TicketImportField = "ticketNumber" | "system" | "status" | "category" | "description" | "responsible" | "receivedAt" | "finishedAt";

export interface TicketImportRow {
  ticketNumber?: string;
  system?: string;
  status?: string;
  category?: string;
  description?: string;
  responsible?: string;
  receivedAt?: string;
  finishedAt?: string;
  sourceSheet?: string;
  sourceRow?: number;
}

export interface TicketImportError {
  row: number;
  sheet?: string;
  field: TicketImportField | "ticket";
  kind?: "duplicate" | "validation";
  message: string;
}

export interface AppData {
  tickets: Ticket[];
  systems: SystemItem[];
  categories: Category[];
  statuses: StatusDefinition[];
  users: User[];
}
