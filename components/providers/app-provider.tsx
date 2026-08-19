"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { AppData, Category, StatusDefinition, SystemItem, ThemePreference, Ticket, TicketInput, User } from "@/lib/types";
import { readApiJson } from "@/lib/client-http";

type Entity = SystemItem | Category | StatusDefinition | User;
type EntityType = "systems" | "categories" | "statuses" | "users";
const emptyData: AppData = { tickets: [], systems: [], categories: [], statuses: [], users: [] };

function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem("ticketabit:theme", theme);
}

interface AppContextValue extends AppData {
  hydrated: boolean;
  loading: boolean;
  loadError: string | null;
  currentUser: User | null;
  ticketModalOpen: boolean;
  selectedTicketId: string | null;
  globalSearch: string;
  notice: string | null;
  theme: ThemePreference;
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
  changeTheme: (theme: ThemePreference) => Promise<boolean>;
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
  const [theme, setTheme] = useState<ThemePreference>("light");

  const reloadData = async () => {
    if (window.location.pathname === "/login") {
      setLoading(false);
      setHydrated(true);
      return;
    }
    setLoadError(null);
    try {
      const response = await fetch("/api/bootstrap", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (response.status === 401) {
        window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (response.redirected && new URL(response.url).pathname === "/login") {
        window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const result = await readApiJson<AppData & { currentUser: User; error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os dados.");
      const { currentUser: authenticatedUser, ...appData } = result;
      const accountTheme: ThemePreference = authenticatedUser.theme === "dark" ? "dark" : "light";
      setData(appData as AppData);
      setCurrentUser({ ...authenticatedUser, theme: accountTheme } as User);
      setTheme(accountTheme);
      applyTheme(accountTheme);
    } catch (error) {
      setLoadError(error instanceof DOMException && error.name === "TimeoutError"
        ? "O servidor demorou demais para responder. Tente novamente."
        : error instanceof Error ? error.message : "Não foi possível conectar ao banco de dados.");
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  };

  useEffect(() => {
    const cachedTheme = window.localStorage.getItem("ticketabit:theme") === "dark" ? "dark" : "light";
    setTheme(cachedTheme);
    applyTheme(cachedTheme);
    void reloadData();
  }, []);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2400);
  };

  const changeTheme = async (nextTheme: ThemePreference) => {
    const previousTheme = theme;
    setTheme(nextTheme);
    applyTheme(nextTheme);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: nextTheme }),
      });
      const result = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar o tema.");
      setCurrentUser((current) => current ? { ...current, theme: nextTheme } : current);
      showNotice(nextTheme === "dark" ? "Tema escuro ativado" : "Tema claro ativado");
      return true;
    } catch (error) {
      setTheme(previousTheme);
      applyTheme(previousTheme);
      showNotice(error instanceof Error ? error.message : "Não foi possível salvar o tema.");
      return false;
    }
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
    ...data, hydrated, loading, loadError, currentUser, ticketModalOpen, selectedTicketId, globalSearch, notice, theme,
    reloadData,
    openNewTicket: () => setTicketModalOpen(true), closeNewTicket: () => setTicketModalOpen(false),
    openTicket: setSelectedTicketId, closeTicket: () => setSelectedTicketId(null), setGlobalSearch,
    createTicket, updateTicket, deleteTicket, addEntity, updateEntity, showNotice, changeTheme,
  }), [data, hydrated, loading, loadError, currentUser, ticketModalOpen, selectedTicketId, globalSearch, notice, theme]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
