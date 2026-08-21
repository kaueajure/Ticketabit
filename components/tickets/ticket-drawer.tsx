"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Clock3, Trash2, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { OfficialTicketHistory, TicketStatus } from "@/lib/types";
import { formatDate, relativeTime } from "@/lib/utils";
import { readApiJson } from "@/lib/client-http";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResponsiblePicker } from "@/components/tickets/responsible-picker";

export function TicketDrawer() {
  const { selectedTicketId, closeTicket, tickets, systems, categories, statuses, users, updateTicket, deleteTicket } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [officialHistory, setOfficialHistory] = useState<OfficialTicketHistory | null>(null);
  const [officialHistoryLoading, setOfficialHistoryLoading] = useState(false);
  const [officialHistoryError, setOfficialHistoryError] = useState("");
  const [officialHistoryReload, setOfficialHistoryReload] = useState(0);
  const ticket = tickets.find((item) => item.id === selectedTicketId);
  const [description, setDescription] = useState("");

  useEffect(() => {
    setConfirmDelete(false);
    setHistoryOpen(false);
    setOfficialHistory(null);
    setOfficialHistoryLoading(false);
    setOfficialHistoryError("");
    setOfficialHistoryReload(0);
    setDescription(ticket?.description ?? "");
  }, [selectedTicketId, ticket?.id]);

  useEffect(() => {
    if (!historyOpen || !ticket?.id || officialHistory) return;
    const controller = new AbortController();
    setOfficialHistoryLoading(true);
    setOfficialHistoryError("");

    void fetch(`/api/tickets/${encodeURIComponent(ticket.id)}/movidesk-history`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const result = await readApiJson<OfficialTicketHistory & { error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar o histórico oficial.");
      setOfficialHistory(result);
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setOfficialHistoryError(error instanceof Error ? error.message : "Não foi possível carregar o histórico oficial.");
    }).finally(() => {
      if (!controller.signal.aborted) setOfficialHistoryLoading(false);
    });

    return () => controller.abort();
  }, [historyOpen, ticket?.id, officialHistory, officialHistoryReload]);

  if (!selectedTicketId || !ticket) return null;

  const responsibles = users.filter((item) => ticket.responsibleIds.includes(item.id));
  const creator = users.find((item) => item.id === ticket.createdBy);
  const currentStatus = statuses.find((item) => item.name === ticket.status);
  const lastUpdaterName = ticket.history.at(-1)?.userName ?? responsibles[0]?.name ?? "Usuário";
  const lastUpdater = users.find((item) => item.name === lastUpdaterName);

  return createPortal(
    <div className="drawer-layer ticket-details-layer" role="dialog" aria-modal="true" aria-labelledby="ticket-details-title">
      <button className="drawer-backdrop" onClick={closeTicket} aria-label="Fechar modal" />
      <aside className="ticket-drawer">
        <div className="drawer-header">
          <div className="drawer-breadcrumb"><span>Tickets</span><span>/</span><strong id="ticket-details-title">#{ticket.ticketNumber}</strong></div>
          <div><button className="icon-button" onClick={closeTicket} aria-label="Fechar"><X size={19} /></button></div>
        </div>
        <div className="drawer-content">
          <div className="drawer-title-row">
            <span className="ticket-code">#{ticket.ticketNumber}</span>
            <StatusBadge status={ticket.status} color={currentStatus?.color} />
          </div>
          <textarea className="drawer-description" value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => { if (description.trim() && description !== ticket.description) updateTicket(ticket.id, { description: description.trim() }, "Descrição"); }} rows={2} />
          <div className="drawer-meta">
            <label><span>Status</span><select value={ticket.status} onChange={(e) => updateTicket(ticket.id, { status: e.target.value as TicketStatus }, "Status")}>{statuses.filter((status) => status.active || status.name === ticket.status).map((status) => <option key={status.id} value={status.name}>{status.name}</option>)}</select></label>
            <label><span>Sistema</span><select value={ticket.systemId} onChange={(e) => updateTicket(ticket.id, { systemId: e.target.value }, "Sistema")}>{systems.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span>Categoria</span><select value={ticket.categoryId} onChange={(e) => updateTicket(ticket.id, { categoryId: e.target.value }, "Categoria")}>{categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <div className="drawer-responsibles"><span>Responsáveis</span><ResponsiblePicker compact users={users} value={ticket.responsibleIds} onChange={(responsibleIds) => updateTicket(ticket.id, { responsibleIds }, "Responsáveis")}/></div>
            <div><span>Recebido</span><p><CalendarDays size={15} />{formatDate(ticket.receivedAt)}</p></div>
            <label><span>Data final</span><input aria-label="Data de finalização" type="date" value={ticket.finishedAt ?? ""} onChange={(e) => updateTicket(ticket.id, { finishedAt: e.target.value || null }, "Data de finalização")} /></label>
          </div>
          <section className="drawer-section activity-section">
            <div className="section-heading"><div><h3>Atividade</h3><p>Histórico oficial do Movidesk e alterações no Ticketabit.</p></div><button className="text-button" onClick={() => setHistoryOpen(!historyOpen)}>{historyOpen ? "Ocultar" : "Ver histórico"}</button></div>
            <div className="last-update">
              <Avatar name={lastUpdaterName} photoUrl={lastUpdater?.avatarUrl} size="sm" />
              <p><strong>Atualizado por {lastUpdaterName}</strong><span>{relativeTime(ticket.updatedAt)}</span></p>
            </div>
            {historyOpen && <div className="history-sources">
              <div className="history-source">
                <div className="history-source-heading"><strong>Movidesk</strong>{officialHistory && <span>{officialHistory.actionCount} {officialHistory.actionCount === 1 ? "ação" : "ações"}</span>}</div>
                {officialHistoryLoading && <div className="history-loading-state"><i className="spin"/>Consultando histórico oficial...</div>}
                {officialHistoryError && <div className="history-error-state"><span>{officialHistoryError}</span><button type="button" onClick={() => setOfficialHistoryReload((value) => value + 1)}>Tentar novamente</button></div>}
                {officialHistory && !officialHistory.events.length && <div className="history-empty-state">O Movidesk não retornou eventos para este ticket.</div>}
                {officialHistory && officialHistory.events.length > 0 && <div className="history-list official-history-list">{officialHistory.events.map((event) => <div key={event.id}><span className={`history-dot history-dot-${event.kind}`} /><p><strong>{event.title}</strong>{event.detail && <small>{event.detail}</small>}<em>{event.actor ? `${event.actor} · ` : ""}{formatDate(event.createdAt, true)}</em></p></div>)}</div>}
              </div>
              <div className="history-source local-history-source">
                <div className="history-source-heading"><strong>Ticketabit</strong><span>{ticket.history.length} {ticket.history.length === 1 ? "alteração" : "alterações"}</span></div>
                {!ticket.history.length && <div className="history-empty-state">Nenhuma alteração local registrada.</div>}
                {ticket.history.length > 0 && <div className="history-list">{[...ticket.history].reverse().map((entry) => <div key={entry.id}><span className="history-dot" /><p><strong>{entry.field === "Ticket" ? entry.newValue : `${entry.field} alterado`}</strong>{entry.previousValue && <small>de “{entry.previousValue}” para “{entry.newValue}”</small>}<em>{entry.userName} · {formatDate(entry.createdAt, true)}</em></p></div>)}</div>}
              </div>
            </div>}
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
    </div>,
    document.body,
  );
}
