"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Check, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { STATUSES, TicketInput, TicketStatus } from "@/lib/types";
import { today } from "@/lib/utils";

const emptyForm = (): TicketInput => ({
  ticketNumber: "",
  systemId: "",
  status: "Não iniciado",
  categoryId: "",
  description: "",
  responsibleId: "",
  receivedAt: today(),
  stages: {},
});

export function TicketFormModal() {
  const { ticketModalOpen, closeNewTicket, systems, categories, users, stages, createTicket } = useApp();
  const [form, setForm] = useState<TicketInput>(emptyForm());
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ticketModalOpen) {
      setForm({
        ...emptyForm(),
        systemId: systems.find((item) => item.active)?.id ?? "",
        categoryId: categories.find((item) => item.active)?.id ?? "",
        responsibleId: users.find((item) => item.active)?.id ?? "",
        stages: Object.fromEntries(stages.filter((stage) => stage.active).map((stage) => [stage.id, false])),
      });
      setError("");
    }
  }, [ticketModalOpen, systems, categories, users, stages]);

  if (!ticketModalOpen) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.ticketNumber.trim() || !form.description.trim()) {
      setError("Preencha o código e a descrição do ticket.");
      return;
    }
    setSubmitting(true);
    const result = await createTicket(form);
    if (!result.ok) {
      setError(result.error ?? "Não foi possível criar o ticket.");
      setSubmitting(false);
      return;
    }
    window.setTimeout(() => {
      setSubmitting(false);
      closeNewTicket();
    }, 250);
  };

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="new-ticket-title">
      <button className="modal-backdrop" onClick={closeNewTicket} aria-label="Fechar" />
      <form className="ticket-modal" onSubmit={submit}>
        <div className="modal-header">
          <div><span className="eyebrow">Novo registro</span><h2 id="new-ticket-title">Criar ticket</h2><p>Adicione as informações essenciais para começar.</p></div>
          <button type="button" className="icon-button" onClick={closeNewTicket} aria-label="Fechar"><X size={19} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label className="form-field"><span>Ticket <b>*</b></span><input autoFocus value={form.ticketNumber} onChange={(e) => setForm({ ...form, ticketNumber: e.target.value })} placeholder="Digite o número ou código" /></label>
            <label className="form-field"><span>Data de recebimento</span><span className="input-with-icon"><CalendarDays size={15} /><input type="date" value={form.receivedAt} onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} /></span></label>
            <label className="form-field"><span>Sistema <b>*</b></span><select value={form.systemId} onChange={(e) => setForm({ ...form, systemId: e.target.value })}>{systems.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="form-field"><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TicketStatus })}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="form-field"><span>Categoria <b>*</b></span><select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="form-field"><span>Responsável <b>*</b></span><select value={form.responsibleId} onChange={(e) => setForm({ ...form, responsibleId: e.target.value })}>{users.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="form-field form-field-full"><span>Descrição <b>*</b></span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descreva a demanda de forma objetiva..." rows={4} /></label>
          </div>
          {stages.some((stage) => stage.active) && (
            <div className="stages-field">
              <div><span>Etapas</span><small>Opcional — marque o que já foi concluído</small></div>
              <div className="stage-options">
                {stages.filter((stage) => stage.active).sort((a, b) => a.position - b.position).map((stage) => (
                  <label key={stage.id} className={`stage-option ${form.stages[stage.id] ? "checked" : ""}`}>
                    <input type="checkbox" checked={!!form.stages[stage.id]} onChange={(e) => setForm({ ...form, stages: { ...form.stages, [stage.id]: e.target.checked } })} />
                    <span className="stage-check">{form.stages[stage.id] ? <Check size={13} /> : stage.abbreviation}</span>
                    <span>{stage.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-footer"><button type="button" className="secondary-button" onClick={closeNewTicket}>Cancelar</button><button type="submit" className="primary-button" disabled={submitting}>{submitting ? "Criando..." : "Criar ticket"}</button></div>
      </form>
    </div>
  );
}
