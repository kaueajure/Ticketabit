"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, Clock3, MoreHorizontal, Trash2, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { STATUSES, TicketStatus } from "@/lib/types";
import { formatDate, relativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, CategoryBadge } from "@/components/ui/status-badge";

export function TicketDrawer() {
  const { selectedTicketId, closeTicket, tickets, systems, categories, users, stages, updateTicket, deleteTicket } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const ticket = tickets.find((item) => item.id === selectedTicketId);
  const [description, setDescription] = useState("");

  useEffect(() => {
    setConfirmDelete(false);
    setHistoryOpen(false);
    setDescription(ticket?.description ?? "");
  }, [selectedTicketId, ticket?.id]);

  if (!selectedTicketId || !ticket) return null;

  const system = systems.find((item) => item.id === ticket.systemId);
  const category = categories.find((item) => item.id === ticket.categoryId);
  const responsible = users.find((item) => item.id === ticket.responsibleId);
  const creator = users.find((item) => item.id === ticket.createdBy);

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-labelledby="ticket-drawer-title">
      <button className="drawer-backdrop" onClick={closeTicket} aria-label="Fechar painel" />
      <aside className="ticket-drawer">
        <div className="drawer-header">
          <div className="drawer-breadcrumb"><span>Tickets</span><span>/</span><strong>#{ticket.ticketNumber}</strong></div>
          <div><button className="icon-button" aria-label="Mais opções"><MoreHorizontal size={19} /></button><button className="icon-button" onClick={closeTicket} aria-label="Fechar"><X size={19} /></button></div>
        </div>
        <div className="drawer-content">
          <div className="drawer-title-row">
            <span className="ticket-code">#{ticket.ticketNumber}</span>
            <StatusBadge status={ticket.status} />
          </div>
          <textarea className="drawer-description" value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => { if (description.trim() && description !== ticket.description) updateTicket(ticket.id, { description: description.trim() }, "Descrição"); }} rows={2} />
          <div className="drawer-meta">
            <label><span>Status</span><select value={ticket.status} onChange={(e) => updateTicket(ticket.id, { status: e.target.value as TicketStatus }, "Status")}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label><span>Sistema</span><select value={ticket.systemId} onChange={(e) => updateTicket(ticket.id, { systemId: e.target.value }, "Sistema")}>{systems.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span>Categoria</span><select value={ticket.categoryId} onChange={(e) => updateTicket(ticket.id, { categoryId: e.target.value }, "Categoria")}>{categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span>Responsável</span><select value={ticket.responsibleId} onChange={(e) => updateTicket(ticket.id, { responsibleId: e.target.value }, "Responsável")}>{users.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <div><span>Recebido</span><p><CalendarDays size={15} />{formatDate(ticket.receivedAt)}</p></div>
            <div><span>Finalizado</span><p><CalendarDays size={15} />{formatDate(ticket.finishedAt)}</p></div>
          </div>
          <section className="drawer-section">
            <div className="section-heading"><div><h3>Etapas</h3><p>Acompanhamento interno deste ticket.</p></div><span>{Object.values(ticket.stages).filter(Boolean).length}/{stages.filter((stage) => stage.active).length}</span></div>
            <div className="drawer-stages">
              {stages.filter((stage) => stage.active).sort((a, b) => a.position - b.position).map((stage) => {
                const checked = !!ticket.stages[stage.id];
                return <button key={stage.id} className={checked ? "complete" : ""} onClick={() => updateTicket(ticket.id, { stages: { ...ticket.stages, [stage.id]: !checked } }, "Etapas")}><span>{checked ? <Check size={14} /> : stage.abbreviation}</span>{stage.name}</button>;
              })}
            </div>
          </section>
          <section className="drawer-section activity-section">
            <div className="section-heading"><div><h3>Atividade</h3><p>Alterações recentes no ticket.</p></div><button className="text-button" onClick={() => setHistoryOpen(!historyOpen)}>{historyOpen ? "Ocultar" : "Ver histórico"}</button></div>
            <div className="last-update">
              <Avatar name={responsible?.name ?? "Usuário"} size="sm" />
              <p><strong>Atualizado por {ticket.history.at(-1)?.userName ?? responsible?.name}</strong><span>{relativeTime(ticket.updatedAt)}</span></p>
            </div>
            {historyOpen && <div className="history-list">{[...ticket.history].reverse().map((entry) => <div key={entry.id}><span className="history-dot" /><p><strong>{entry.field === "Ticket" ? entry.newValue : `${entry.field} alterado`}</strong>{entry.previousValue && <small>de “{entry.previousValue}” para “{entry.newValue}”</small>}<em>{entry.userName} · {formatDate(entry.createdAt, true)}</em></p></div>)}</div>}
          </section>
          <div className="drawer-audit"><Clock3 size={14} /><span>Criado por {creator?.name ?? "Usuário"} em {formatDate(ticket.createdAt, true)}</span></div>
          <button className="danger-text-button" onClick={() => setConfirmDelete(true)}><Trash2 size={15} />Excluir ticket</button>
        </div>
        {confirmDelete && (
          <div className="confirm-layer">
            <div className="confirm-dialog">
              <span className="danger-icon"><Trash2 size={20} /></span>
              <h3>Excluir ticket #{ticket.ticketNumber}?</h3>
              <p>Esta ação não poderá ser desfeita. O ticket e seu histórico serão removidos.</p>
              <div><button className="secondary-button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button className="danger-button" onClick={() => { setConfirmDelete(false); deleteTicket(ticket.id); }}>Excluir</button></div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
