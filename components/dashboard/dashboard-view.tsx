"use client";

import Link from "next/link";
import { ArrowRight, Clock3, TicketCheck, Timer, CirclePause, FlaskConical } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { PageHeader } from "@/components/layout/page-header";
import { formatDate, relativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";

export function DashboardView() {
  const { tickets, users, systems, statuses, currentUser, openTicket } = useApp();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const stats = [
    { label: "Total de tickets", value: tickets.length, hint: "em todos os status", icon: TicketCheck, tone: "neutral" },
    { label: "Em atendimento", value: tickets.filter((item) => item.status === "Em atendimento").length, hint: "demandas ativas", icon: Timer, tone: "blue" },
    { label: "Em espera", value: tickets.filter((item) => item.status === "Em espera").length, hint: "aguardando retorno", icon: CirclePause, tone: "amber" },
    { label: "Em teste", value: tickets.filter((item) => item.status.includes("Teste")).length, hint: "em validação", icon: FlaskConical, tone: "violet" },
    { label: "Finalizados", value: tickets.filter((item) => item.status === "Finalizado").length, hint: "concluídos", icon: TicketCheck, tone: "green" },
  ];
  const recent = [...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const waiting = tickets.filter((item) => ["Não iniciado", "Em atendimento", "Em espera"].includes(item.status)).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)).slice(0, 5);

  return (
    <div className="page dashboard-page">
      <PageHeader eyebrow="VISÃO GERAL" title={<>{greeting}, {currentUser?.name.split(" ")[0]}</>} description="Aqui está o resumo das demandas da sua equipe." />
      <div className="stat-grid">
        {stats.map(({ label, value, hint, icon: Icon, tone }) => <div className="stat-card" key={label}><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div><span className={`stat-icon stat-${tone}`}><Icon size={18}/></span></div>)}
      </div>
      <div className="dashboard-grid">
        <section className="dashboard-panel recent-panel">
          <div className="panel-heading"><div><h2>Tickets recentes</h2><p>Últimas demandas atualizadas</p></div><Link href="/tickets">Ver todos <ArrowRight size={14}/></Link></div>
          <div className="recent-list">
            {!recent.length && <div className="panel-empty"><TicketCheck size={18}/><strong>Nenhum ticket recente</strong><span>Os tickets atualizados aparecerão aqui.</span></div>}
            {recent.map((ticket) => {
              const owners = users.filter((item) => ticket.responsibleIds.includes(item.id));
              return <button key={ticket.id} onClick={() => openTicket(ticket.id)}><span className="recent-code">#{ticket.ticketNumber}</span><span className="recent-main"><strong>{ticket.description}</strong><small>{systems.find((item) => item.id === ticket.systemId)?.name} · atualizado {relativeTime(ticket.updatedAt)}</small></span><StatusBadge status={ticket.status} color={statuses.find((item) => item.name === ticket.status)?.color}/><span className="owner-avatars">{owners.slice(0, 2).map((owner) => <Avatar key={owner.id} name={owner.name} photoUrl={owner.avatarUrl} size="sm"/>)}</span></button>;
            })}
          </div>
        </section>
        <section className="dashboard-panel waiting-panel">
          <div className="panel-heading"><div><h2>Aguardando há mais tempo</h2><p>Tickets que pedem atenção</p></div><Clock3 size={17}/></div>
          <div className="waiting-list">
            {!waiting.length && <div className="panel-empty"><Clock3 size={18}/><strong>Nenhum ticket aguardando</strong><span>Não existem demandas pendentes no momento.</span></div>}
            {waiting.map((ticket) => {
              const days = Math.max(1, Math.floor((Date.now() - new Date(`${ticket.receivedAt}T12:00:00`).getTime()) / 86400000));
              const owners = users.filter((item) => ticket.responsibleIds.includes(item.id));
              return <button key={ticket.id} onClick={() => openTicket(ticket.id)}><div><span className="recent-code">#{ticket.ticketNumber}</span><StatusBadge status={ticket.status} color={statuses.find((item) => item.name === ticket.status)?.color}/></div><strong>{ticket.description}</strong><footer><span><span className="owner-avatars">{owners.slice(0, 2).map((owner) => <Avatar key={owner.id} name={owner.name} photoUrl={owner.avatarUrl} size="sm"/>)}</span>{owners.map((owner) => owner.name.split(" ")[0]).join(" e ")}</span><em>{days} dia{days === 1 ? "" : "s"}</em></footer></button>;
            })}
          </div>
        </section>
      </div>
      <p className="dashboard-footnote">Dados atualizados agora · {formatDate(new Date().toISOString(), true)}</p>
    </div>
  );
}
