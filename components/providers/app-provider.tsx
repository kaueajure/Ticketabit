"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { AppData, Category, StatusDefinition, SystemItem, Ticket, TicketInput, User } from "@/lib/types";

type Entity = SystemItem | Category | StatusDefinition | User;
type EntityType = "systems" | "categories" | "statuses" | "users";
const emptyData: AppData = { tickets: [], systems: [], categories: [], statuses: [], users: [] };

interface AppContextValue extends AppData {
  hydrated: boolean;
  loading: boolean;
  loadError: string | null;
  currentUser: User | null;
  ticketModalOpen: boolean;
  selectedTicketId: string | null;
  globalSearch: string;
  notice: string | null;
  reloadData: () => Promise<void>;
  openNewTicket: () => void;
  closeNewTicket: () => void;
  openTicket: (id: string) => void;
  closeTicket: () => void;
  setGlobalSearch: (value: string) => void;
  createTicket: (input: TicketInput) => Promise<{ ok: boolean; error?: string }>;
  updateTicket: (id: string, changes: Partial<Ticket>, label?: string) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  addEntity: (type: EntityType, entity: Entity, password?: string) => Promise<{ ok: boolean; error?: string }>;
  updateEntity: (type: EntityType, id: string, changes: Partial<Entity> & { password?: string }) => Promise<{ ok: boolean; error?: string }>;
  showNotice: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const reloadData = async () => {
    if (window.location.pathname === "/login") {
      setLoading(false);
      setHydrated(true);
      return;
    }
    setLoadError(null);
    try {
      const response = await fetch("/api/bootstrap", { cache: "no-store" });
      if (response.status === 401) {
        window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os dados.");
      const { currentUser: authenticatedUser, ...appData } = result;
      setData(appData as AppData);
      setCurrentUser(authenticatedUser as User);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível conectar ao banco de dados.");
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  };

  useEffect(() => { void reloadData(); }, []);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2400);
  };

  const createTicket = async (input: TicketInput) => {
    try {
      const response = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) return { ok: false, error: result.error ?? "Não foi possível criar o ticket." };
      await reloadData();
      showNotice("Ticket criado");
      return { ok: true };
    } catch {
      return { ok: false, error: "Falha de conexão com o servidor." };
    }
  };

  const updateTicket = async (id: string, changes: Partial<Ticket>, label = "Ticket") => {
    const previousData = data;
    const now = new Date().toISOString();
    setData((current) => ({
      ...current,
      tickets: current.tickets.map((ticket) => {
        if (ticket.id !== id) return ticket;
        return { ...ticket, ...changes, updatedAt: now };
      }),
    }));
    try {
      const response = await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes, label }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      showNotice("Alterações salvas");
    } catch (error) {
      setData(previousData);
      showNotice(error instanceof Error ? error.message : "Erro ao salvar");
    }
  };

  const deleteTicket = async (id: string) => {
    try {
      const response = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData((current) => ({ ...current, tickets: current.tickets.filter((ticket) => ticket.id !== id) }));
      setSelectedTicketId(null);
      showNotice("Ticket excluído");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Erro ao excluir");
    }
  };

  const addEntity = async (type: EntityType, entity: Entity, password?: string) => {
    try {
      const response = await fetch(`/api/entities/${type}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...entity, password }) });
      const result = await response.json();
      if (!response.ok) return { ok: false, error: result.error ?? "Não foi possível adicionar." };
      await reloadData();
      showNotice("Item adicionado");
      return { ok: true };
    } catch {
      return { ok: false, error: "Falha de conexão com o servidor." };
    }
  };

  const updateEntity = async (type: EntityType, id: string, changes: Partial<Entity> & { password?: string }) => {
    try {
      const response = await fetch(`/api/entities/${type}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, changes }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await reloadData();
      showNotice("Alterações salvas");
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar";
      showNotice(message);
      return { ok: false, error: message };
    }
  };

  const value = useMemo(() => ({
    ...data, hydrated, loading, loadError, currentUser, ticketModalOpen, selectedTicketId, globalSearch, notice,
    reloadData,
    openNewTicket: () => setTicketModalOpen(true), closeNewTicket: () => setTicketModalOpen(false),
    openTicket: setSelectedTicketId, closeTicket: () => setSelectedTicketId(null), setGlobalSearch,
    createTicket, updateTicket, deleteTicket, addEntity, updateEntity, showNotice,
  }), [data, hydrated, loading, loadError, currentUser, ticketModalOpen, selectedTicketId, globalSearch, notice]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
