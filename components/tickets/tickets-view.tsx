"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Filter, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { STATUSES, Ticket, TicketStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { CategoryBadge, StatusBadge } from "@/components/ui/status-badge";

type SortKey = "ticketNumber" | "receivedAt" | "finishedAt" | "responsibleId";
type SortDirection = "asc" | "desc";

export function TicketsView() {
  const { tickets, systems, categories, users, stages, globalSearch, setGlobalSearch, updateTicket, openTicket, openNewTicket } = useApp();
  const [status, setStatus] = useState("");
  const [system, setSystem] = useState("");
  const [category, setCategory] = useState("");
  const [responsible, setResponsible] = useState("");
  const [period, setPeriod] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("receivedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [savedCell, setSavedCell] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);

  const quickCounts = useMemo(() => ({
    all: tickets.length,
    attending: tickets.filter((item) => item.status === "Em atendimento").length,
    waiting: tickets.filter((item) => item.status === "Em espera").length,
    testing: tickets.filter((item) => item.status === "Teste Centauro" || item.status === "Teste Oficial").length,
    done: tickets.filter((item) => item.status === "Finalizado").length,
  }), [tickets]);

  const filtered = useMemo(() => {
    const search = globalSearch.trim().toLowerCase();
    const now = Date.now();
    return tickets.filter((ticket) => {
      const owner = users.find((item) => item.id === ticket.responsibleId)?.name ?? "";
      const systemName = systems.find((item) => item.id === ticket.systemId)?.name ?? "";
      const matchesSearch = !search || [ticket.ticketNumber, ticket.description, owner, systemName].some((value) => value.toLowerCase().includes(search));
      const matchesStatus = !status || (status === "Teste" ? ticket.status.includes("Teste") : ticket.status === status);
      const matchesPeriod = !period || now - new Date(`${ticket.receivedAt}T12:00:00`).getTime() <= Number(period) * 86400000;
      return matchesSearch && matchesStatus && (!system || ticket.systemId === system) && (!category || ticket.categoryId === category) && (!responsible || ticket.responsibleId === responsible) && matchesPeriod;
    }).sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      return av.localeCompare(bv, "pt-BR", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [tickets, users, systems, globalSearch, status, system, category, responsible, period, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const filterCount = [status, system, category, responsible, period].filter(Boolean).length;

  useEffect(() => setPage(1), [globalSearch, status, system, category, responsible, period, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

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
    setStatus(""); setSystem(""); setCategory(""); setResponsible(""); setPeriod(""); setGlobalSearch("");
  };

  const exportCsv = () => {
    const header = ["Ticket", "Sistema", "Status", "Categoria", "Descrição", "Responsável", "Recebido", "Finalizado"];
    const rows = filtered.map((ticket) => [
      ticket.ticketNumber,
      systems.find((item) => item.id === ticket.systemId)?.name ?? "",
      ticket.status,
      categories.find((item) => item.id === ticket.categoryId)?.name ?? "",
      ticket.description,
      users.find((item) => item.id === ticket.responsibleId)?.name ?? "",
      ticket.receivedAt,
      ticket.finishedAt ?? "",
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `ticketabit-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const SortIcon = ({ column }: { column: SortKey }) => sortKey !== column ? <span className="sort-idle">↕</span> : sortDirection === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />;

  return (
    <div className="page tickets-page">
      <div className="page-title-row">
        <div><div className="page-kicker">GESTÃO</div><h1>Tickets</h1><p>Acompanhe e atualize todas as demandas em um só lugar.</p></div>
        <div className="title-actions"><button className="secondary-button" onClick={exportCsv}><Download size={15} />Exportar CSV</button><button className="primary-button" onClick={openNewTicket}><Plus size={16} />Novo ticket</button></div>
      </div>
      <div className="quick-counters" role="tablist">
        <button className={!status ? "active" : ""} onClick={() => setStatus("")}><span>Todos</span><strong>{quickCounts.all}</strong></button>
        <button className={status === "Em atendimento" ? "active" : ""} onClick={() => setStatus("Em atendimento")}><i className="dot-blue"/><span>Em atendimento</span><strong>{quickCounts.attending}</strong></button>
        <button className={status === "Em espera" ? "active" : ""} onClick={() => setStatus("Em espera")}><i className="dot-amber"/><span>Em espera</span><strong>{quickCounts.waiting}</strong></button>
        <button className={status === "Teste" ? "active" : ""} onClick={() => setStatus("Teste")}><i className="dot-violet"/><span>Em teste</span><strong>{quickCounts.testing}</strong></button>
        <button className={status === "Finalizado" ? "active" : ""} onClick={() => setStatus("Finalizado")}><i className="dot-green"/><span>Finalizados</span><strong>{quickCounts.done}</strong></button>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <label className="table-search"><Search size={15} /><input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Pesquisar por ticket, descrição..." />{globalSearch && <button onClick={() => setGlobalSearch("")}><X size={14}/></button>}</label>
          <button className={`mobile-filter-button ${filterCount ? "has-filter" : ""}`} onClick={() => setMobileFilters(!mobileFilters)}><SlidersHorizontal size={15}/>Filtros {filterCount > 0 && <span>{filterCount}</span>}</button>
          <div className={`compact-filters ${mobileFilters ? "show" : ""}`}>
            <label><Filter size={14}/><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Status</option><option value="Teste">Em teste</option>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={13}/></label>
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
              <th><button onClick={() => sort("responsibleId")}>Responsável <SortIcon column="responsibleId" /></button></th>
              <th><button onClick={() => sort("receivedAt")}>Recebido <SortIcon column="receivedAt" /></button></th>
              <th><button onClick={() => sort("finishedAt")}>Finalizado <SortIcon column="finishedAt" /></button></th><th>Etapas</th>
            </tr></thead>
            <tbody>
              {pageItems.map((ticket) => {
                const systemItem = systems.find((item) => item.id === ticket.systemId);
                const categoryItem = categories.find((item) => item.id === ticket.categoryId);
                const owner = users.find((item) => item.id === ticket.responsibleId);
                return (
                  <tr key={ticket.id} onClick={() => openTicket(ticket.id)}>
                    <td className="ticket-number">#{ticket.ticketNumber}</td>
                    <td onClick={(e) => e.stopPropagation()}><label className="cell-select"><select value={ticket.systemId} onChange={(e) => quickSave(ticket, { systemId: e.target.value }, "Sistema")}>{systems.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={12}/></label></td>
                    <td onClick={(e) => e.stopPropagation()}><label className="status-select"><StatusBadge status={ticket.status}/><select aria-label="Alterar status" value={ticket.status} onChange={(e) => quickSave(ticket, { status: e.target.value as TicketStatus }, "Status")}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select>{savedCell === ticket.id + "Status" && <span className="cell-saved"><Check size={11}/>Salvo</span>}</label></td>
                    <td onClick={(e) => e.stopPropagation()}><label className="category-select"><CategoryBadge name={categoryItem?.name ?? "—"} color={categoryItem?.color}/><select aria-label="Alterar categoria" value={ticket.categoryId} onChange={(e) => quickSave(ticket, { categoryId: e.target.value }, "Categoria")}>{categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></td>
                    <td className="description-cell"><span>{ticket.description}</span></td>
                    <td onClick={(e) => e.stopPropagation()}><label className="owner-select"><Avatar name={owner?.name ?? "?"} size="sm"/><select aria-label="Alterar responsável" value={ticket.responsibleId} onChange={(e) => quickSave(ticket, { responsibleId: e.target.value }, "Responsável")}>{users.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span>{owner?.name.split(" ")[0]}</span></label></td>
                    <td className="date-cell">{formatDate(ticket.receivedAt)}</td><td className="date-cell">{formatDate(ticket.finishedAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}><div className="table-stages">{stages.filter((stage) => stage.active).sort((a,b) => a.position-b.position).map((stage) => <button key={stage.id} title={stage.name} className={ticket.stages[stage.id] ? "checked" : ""} onClick={() => quickSave(ticket, { stages: { ...ticket.stages, [stage.id]: !ticket.stages[stage.id] } }, "Etapas")}>{ticket.stages[stage.id] ? <Check size={10}/> : stage.abbreviation}</button>)}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!pageItems.length && <div className="empty-state"><span><Search size={21}/></span><h3>{tickets.length ? "Nenhum ticket encontrado" : "Nenhum ticket cadastrado"}</h3><p>{tickets.length ? "Não encontramos tickets com os filtros selecionados." : "Crie seu primeiro ticket para começar."}</p><button className="secondary-button" onClick={tickets.length ? clearFilters : openNewTicket}>{tickets.length ? "Limpar filtros" : "+ Novo ticket"}</button></div>}
        </div>
        <div className="table-pagination">
          <div><span>Linhas por página</span><select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}><option>25</option><option>50</option><option>100</option></select></div>
          <span>{filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} de {filtered.length} tickets</span>
          <div className="pagination-buttons"><button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft size={16}/></button><button disabled={page === totalPages} onClick={() => setPage(page + 1)} aria-label="Próxima página"><ChevronRight size={16}/></button></div>
        </div>
      </div>
    </div>
  );
}
