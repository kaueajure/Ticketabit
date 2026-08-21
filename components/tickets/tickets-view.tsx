"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Download, Filter, RefreshCw, Search, SlidersHorizontal, Upload } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { MovideskBulkSyncResult, Ticket, TicketStatus } from "@/lib/types";
import { readApiJson } from "@/lib/client-http";
import { formatDate } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { CategoryBadge, StatusBadge } from "@/components/ui/status-badge";
import { CsvImportModal } from "@/components/tickets/csv-import-modal";

type SortKey = "ticketNumber" | "receivedAt" | "finishedAt" | "responsibleIds";
type SortDirection = "asc" | "desc";
const EXECUTION_FILTER = "__execution__";

export function TicketsView() {
  const { tickets, systems, categories, statuses, users, globalSearch, setGlobalSearch, updateTicket, openTicket, reloadData, showNotice } = useApp();
  const [status, setStatus] = useState(EXECUTION_FILTER);
  const [system, setSystem] = useState("");
  const [category, setCategory] = useState("");
  const [responsible, setResponsible] = useState("");
  const [period, setPeriod] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("receivedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [savedCell, setSavedCell] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [syncingMovidesk, setSyncingMovidesk] = useState(false);

  const statusCounts = useMemo(() => new Map(statuses.map((configuredStatus) => [
    configuredStatus.name,
    tickets.filter((ticket) => ticket.status === configuredStatus.name).length,
  ])), [tickets, statuses]);
  const finalStatusNames = useMemo(() => new Set(statuses.filter((item) => item.isFinal).map((item) => item.name)), [statuses]);
  const executionCount = useMemo(() => tickets.filter((ticket) => !finalStatusNames.has(ticket.status)).length, [tickets, finalStatusNames]);

  const filtered = useMemo(() => {
    const search = globalSearch.trim().toLowerCase();
    const now = Date.now();
    return tickets.filter((ticket) => {
      const owner = users.filter((item) => ticket.responsibleIds.includes(item.id)).map((item) => item.name).join(" ");
      const systemName = systems.find((item) => item.id === ticket.systemId)?.name ?? "";
      const matchesSearch = !search || [ticket.ticketNumber, ticket.description, owner, systemName].some((value) => value.toLowerCase().includes(search));
      const matchesStatus = status === EXECUTION_FILTER ? !finalStatusNames.has(ticket.status) : !status || ticket.status === status;
      const matchesPeriod = !period || now - new Date(`${ticket.receivedAt}T12:00:00`).getTime() <= Number(period) * 86400000;
      return matchesSearch && matchesStatus && (!system || ticket.systemId === system) && (!category || ticket.categoryId === category) && (!responsible || ticket.responsibleIds.includes(responsible)) && matchesPeriod;
    }).sort((a, b) => {
      const av = sortKey === "responsibleIds" ? users.filter((item) => a.responsibleIds.includes(item.id)).map((item) => item.name).join(" ") : String(a[sortKey] ?? "");
      const bv = sortKey === "responsibleIds" ? users.filter((item) => b.responsibleIds.includes(item.id)).map((item) => item.name).join(" ") : String(b[sortKey] ?? "");
      return av.localeCompare(bv, "pt-BR", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [tickets, users, systems, globalSearch, status, system, category, responsible, period, sortKey, sortDirection, finalStatusNames]);

  const filterCount = [status && status !== EXECUTION_FILTER ? status : "", system, category, responsible, period].filter(Boolean).length;

  const sort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((value) => value === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection("asc"); }
  };

  const quickSave = (ticket: Ticket, changes: Partial<Ticket>, label: string) => {
    updateTicket(ticket.id, changes, label);
    setSavedCell(ticket.id + label);
    window.setTimeout(() => setSavedCell(""), 1200);
  };

  const clearFilters = () => {
    setStatus(EXECUTION_FILTER); setSystem(""); setCategory(""); setResponsible(""); setPeriod(""); setGlobalSearch("");
  };

  const exportCsv = () => {
    const header = ["Ticket", "Sistema", "Status", "Categoria", "Descrição", "Responsável", "Recebido", "Finalizado"];
    const rows = filtered.map((ticket) => [
      ticket.ticketNumber,
      systems.find((item) => item.id === ticket.systemId)?.name ?? "",
      ticket.status,
      categories.find((item) => item.id === ticket.categoryId)?.name ?? "",
      ticket.description,
      users.filter((item) => ticket.responsibleIds.includes(item.id)).map((item) => item.name).join(" e "),
      ticket.receivedAt,
      ticket.finishedAt ?? "",
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `ticketabit-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const syncMovidesk = async () => {
    setSyncingMovidesk(true);
    try {
      const response = await fetch("/api/tickets/movidesk-sync", {
        method: "POST",
        signal: AbortSignal.timeout(60_000),
      });
      const result = await readApiJson<MovideskBulkSyncResult & { error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Não foi possível sincronizar os tickets.");
      await reloadData();
      const message = result.updated
        ? `${result.updated} ${result.updated === 1 ? "status atualizado" : "status atualizados"} pelo Movidesk.`
        : `${result.matched} ${result.matched === 1 ? "ticket conferido" : "tickets conferidos"}; nenhuma alteração encontrada.`;
      showNotice(result.unmappedStatuses.length ? `${message} ${result.unmappedStatuses.length} status sem correspondência.` : message);
    } catch (error) {
      showNotice(error instanceof DOMException && error.name === "TimeoutError"
        ? "A sincronização demorou demais. Tente novamente."
        : error instanceof Error ? error.message : "Não foi possível sincronizar os tickets.");
    } finally {
      setSyncingMovidesk(false);
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => sortKey !== column ? <span className="sort-idle">↕</span> : sortDirection === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />;

  return (
    <div className="workspace-page tickets-page">
      <header className="tickets-workspace-header">
        <div className="quick-counters" role="tablist">
          <button className={status === EXECUTION_FILTER ? "active" : ""} onClick={() => setStatus(EXECUTION_FILTER)}><span>Execução</span><strong>{executionCount}</strong></button>
          <button className={!status ? "active" : ""} onClick={() => setStatus("")}><span>Todos</span><strong>{tickets.length}</strong></button>
          {statuses.map((configuredStatus) => (
            <button key={configuredStatus.id} className={status === configuredStatus.name ? "active" : ""} onClick={() => setStatus(configuredStatus.name)}>
              <i className={`dot-${configuredStatus.color}`}/><span>{configuredStatus.name}</span><strong>{statusCounts.get(configuredStatus.name) ?? 0}</strong>
            </button>
          ))}
        </div>
        <div className="tickets-workspace-actions"><button className="secondary-button ticket-sync-button" onClick={() => void syncMovidesk()} disabled={syncingMovidesk} aria-label="Sincronizar todos os tickets com o Movidesk"><RefreshCw className={syncingMovidesk ? "spin" : ""} size={15}/><span>{syncingMovidesk ? "Sincronizando..." : "Sincronizar"}</span></button><button className="secondary-button" onClick={() => setCsvImportOpen(true)}><Upload size={15} /><span>Importar</span></button><button className="secondary-button" onClick={exportCsv}><Download size={15} /><span>Exportar</span></button></div>
      </header>
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-result-count">{filtered.length} {filtered.length === 1 ? "ticket" : "tickets"}</span>
          <button className={`mobile-filter-button ${filterCount ? "has-filter" : ""}`} onClick={() => setMobileFilters(!mobileFilters)}><SlidersHorizontal size={15}/>Filtros {filterCount > 0 && <span>{filterCount}</span>}</button>
          <div className={`compact-filters ${mobileFilters ? "show" : ""}`}>
            <label><Filter size={14}/><select value={status} onChange={(e) => setStatus(e.target.value)}><option value={EXECUTION_FILTER}>Execução</option><option value="">Todos os status</option>{statuses.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select><ChevronDown size={13}/></label>
            <label><select value={system} onChange={(e) => setSystem(e.target.value)}><option value="">Sistema</option>{systems.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={13}/></label>
            <label><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Categoria</option>{categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={13}/></label>
            <label><select value={responsible} onChange={(e) => setResponsible(e.target.value)}><option value="">Responsável</option>{users.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={13}/></label>
            <label><select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="">Data</option><option value="1">Hoje</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select><ChevronDown size={13}/></label>
            {(filterCount > 0 || globalSearch) && <button className="clear-button" onClick={clearFilters}>Limpar filtros</button>}
          </div>
        </div>
        <div className="table-scroll">
          <table className="tickets-table">
            <thead><tr>
              <th className="col-ticket"><button onClick={() => sort("ticketNumber")}>Ticket <SortIcon column="ticketNumber" /></button></th>
              <th>Sistema</th><th>Status</th><th>Categoria</th><th className="col-description">Descrição</th>
              <th><button onClick={() => sort("responsibleIds")}>Responsáveis <SortIcon column="responsibleIds" /></button></th>
              <th><button onClick={() => sort("receivedAt")}>Recebido <SortIcon column="receivedAt" /></button></th>
              <th><button onClick={() => sort("finishedAt")}>Finalizado <SortIcon column="finishedAt" /></button></th>
            </tr></thead>
            <tbody>
              {filtered.map((ticket) => {
                const systemItem = systems.find((item) => item.id === ticket.systemId);
                const categoryItem = categories.find((item) => item.id === ticket.categoryId);
                const owners = users.filter((item) => ticket.responsibleIds.includes(item.id));
                return (
                  <tr key={ticket.id} onClick={() => openTicket(ticket.id)}>
                    <td className="ticket-number">#{ticket.ticketNumber}</td>
                    <td onClick={(e) => e.stopPropagation()}><label className="cell-select"><select value={ticket.systemId} onChange={(e) => quickSave(ticket, { systemId: e.target.value }, "Sistema")}>{systems.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={12}/></label></td>
                    <td onClick={(e) => e.stopPropagation()}><label className="status-select"><StatusBadge status={ticket.status} color={statuses.find((item) => item.name === ticket.status)?.color}/><select aria-label="Alterar status" value={ticket.status} onChange={(e) => quickSave(ticket, { status: e.target.value as TicketStatus }, "Status")}>{statuses.filter((item) => item.active || item.name === ticket.status).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select>{savedCell === ticket.id + "Status" && <span className="cell-saved"><Check size={11}/>Salvo</span>}</label></td>
                    <td onClick={(e) => e.stopPropagation()}><label className="category-select"><CategoryBadge name={categoryItem?.name ?? "—"} color={categoryItem?.color}/><select aria-label="Alterar categoria" value={ticket.categoryId} onChange={(e) => quickSave(ticket, { categoryId: e.target.value }, "Categoria")}>{categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></td>
                    <td className="description-cell"><span>{ticket.description}</span></td>
                    <td><div className="owner-multi"> <span className="owner-avatars">{owners.slice(0, 3).map((owner) => <Avatar key={owner.id} name={owner.name} photoUrl={owner.avatarUrl} size="sm"/>)}</span><span>{owners.map((owner) => owner.name.split(" ")[0]).join(" e ") || "—"}</span></div></td>
                    <td className="date-cell">{formatDate(ticket.receivedAt)}</td><td className="date-cell">{formatDate(ticket.finishedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <div className="empty-state"><span><Search size={21}/></span><h3>{tickets.length ? "Nenhum ticket encontrado" : "Nenhum ticket cadastrado"}</h3><p>{tickets.length ? "Não encontramos tickets com os filtros selecionados." : "Use “Novo ticket” no cabeçalho para criar o primeiro registro."}</p>{tickets.length && <button className="secondary-button" onClick={clearFilters}>Limpar filtros</button>}</div>}
        </div>
      </div>
      <CsvImportModal open={csvImportOpen} onClose={() => setCsvImportOpen(false)} />
    </div>
  );
}
