"use client";

import Link from "next/link";
import { ArrowRight, Clock3, Plus, TicketCheck, Timer, CirclePause, FlaskConical } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { formatDate, relativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";

export function DashboardView() {
  const { tickets, users, systems, currentUser, openTicket, openNewTicket } = useApp();
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
      <div className="page-title-row dashboard-title">
        <div><div className="page-kicker">VISÃO GERAL</div><h1>{greeting}, {currentUser?.name.split(" ")[0]}</h1><p>Aqui está o resumo das demandas da sua equipe.</p></div>
        <button className="primary-button" onClick={openNewTicket}><Plus size={16}/>Novo ticket</button>
      </div>
      <div className="stat-grid">
        {stats.map(({ label, value, hint, icon: Icon, tone }) => <div className="stat-card" key={label}><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div><span className={`stat-icon stat-${tone}`}><Icon size={18}/></span></div>)}
      </div>
      <div className="dashboard-grid">
        <section className="dashboard-panel recent-panel">
          <div className="panel-heading"><div><h2>Tickets recentes</h2><p>Últimas demandas atualizadas</p></div><Link href="/tickets">Ver todos <ArrowRight size={14}/></Link></div>
          <div className="recent-list">
            {recent.map((ticket) => {
              const owner = users.find((item) => item.id === ticket.responsibleId);
              return <button key={ticket.id} onClick={() => openTicket(ticket.id)}><span className="recent-code">#{ticket.ticketNumber}</span><span className="recent-main"><strong>{ticket.description}</strong><small>{systems.find((item) => item.id === ticket.systemId)?.name} · atualizado {relativeTime(ticket.updatedAt)}</small></span><StatusBadge status={ticket.status}/><Avatar name={owner?.name ?? "?"} size="sm"/></button>;
            })}
          </div>
        </section>
        <section className="dashboard-panel waiting-panel">
          <div className="panel-heading"><div><h2>Aguardando há mais tempo</h2><p>Tickets que pedem atenção</p></div><Clock3 size={17}/></div>
          <div className="waiting-list">
            {waiting.map((ticket) => {
              const days = Math.max(1, Math.floor((Date.now() - new Date(`${ticket.receivedAt}T12:00:00`).getTime()) / 86400000));
              const owner = users.find((item) => item.id === ticket.responsibleId);
              return <button key={ticket.id} onClick={() => openTicket(ticket.id)}><div><span className="recent-code">#{ticket.ticketNumber}</span><StatusBadge status={ticket.status}/></div><strong>{ticket.description}</strong><footer><span><Avatar name={owner?.name ?? "?"} size="sm"/>{owner?.name}</span><em>{days} dia{days === 1 ? "" : "s"}</em></footer></button>;
            })}
          </div>
        </section>
      </div>
      <p className="dashboard-footnote">Dados atualizados agora · {formatDate(new Date().toISOString(), true)}</p>
    </div>
  );
}
