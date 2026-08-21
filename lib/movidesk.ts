import "server-only";

import { MovideskTicketSnapshot, OfficialHistoryEvent, OfficialHistoryEventKind, OfficialTicketHistory } from "@/lib/types";

interface MovideskPerson {
  businessName?: unknown;
}

interface MovideskStatusHistory {
  status?: unknown;
  justification?: unknown;
  changedBy?: MovideskPerson | null;
  changedDate?: unknown;
}

interface MovideskOwnerHistory {
  ownerTeam?: unknown;
  owner?: MovideskPerson | null;
  changedBy?: MovideskPerson | null;
  changedDate?: unknown;
}

interface MovideskTicketHistoryResponse {
  id?: unknown;
  subject?: unknown;
  status?: unknown;
  createdDate?: unknown;
  lastActionDate?: unknown;
  actionCount?: unknown;
  reopenedIn?: unknown;
  resolvedIn?: unknown;
  closedIn?: unknown;
  ownerHistories?: unknown;
  statusHistories?: unknown;
}

export class MovideskHistoryError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "MovideskHistoryError";
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function date(value: unknown) {
  const candidate = text(value);
  return candidate && Number.isFinite(new Date(candidate).getTime()) ? candidate : "";
}

function personName(person?: MovideskPerson | null) {
  return text(person?.businessName);
}

export function mapMovideskTicketHistory(ticketNumber: string, ticket: MovideskTicketHistoryResponse): OfficialTicketHistory {
  const events: OfficialHistoryEvent[] = [];
  let sequence = 0;
  const addEvent = (kind: OfficialHistoryEventKind, title: string, createdAt: string, detail?: string, actor?: string) => {
    if (!createdAt) return;
    events.push({
      id: `${kind}-${sequence++}-${createdAt}`,
      kind,
      title,
      ...(detail ? { detail } : {}),
      ...(actor ? { actor } : {}),
      createdAt,
    });
  };

  addEvent("received", "Ticket recebido", date(ticket.createdDate), undefined, "Movidesk");

  const statusHistories = Array.isArray(ticket.statusHistories) ? ticket.statusHistories as MovideskStatusHistory[] : [];
  for (const history of statusHistories) {
    const status = text(history.status);
    if (!status) continue;
    const justification = text(history.justification);
    addEvent(
      "status",
      `Status alterado para ${status}`,
      date(history.changedDate),
      justification ? `Justificativa: ${justification}` : undefined,
      personName(history.changedBy) || "Movidesk",
    );
  }

  const ownerHistories = Array.isArray(ticket.ownerHistories) ? ticket.ownerHistories as MovideskOwnerHistory[] : [];
  for (const history of ownerHistories) {
    const owner = personName(history.owner);
    const team = text(history.ownerTeam);
    addEvent(
      "owner",
      owner ? `Responsável alterado para ${owner}` : team ? `Equipe responsável alterada para ${team}` : "Responsável alterado",
      date(history.changedDate),
      owner && team ? `Equipe: ${team}` : undefined,
      personName(history.changedBy) || "Movidesk",
    );
  }

  const actionCount = Math.max(0, Number(ticket.actionCount) || 0);
  addEvent(
    "action",
    "Última ação registrada",
    date(ticket.lastActionDate),
    actionCount ? `${actionCount} ${actionCount === 1 ? "ação registrada" : "ações registradas"} no ticket` : undefined,
    "Movidesk",
  );
  addEvent("reopened", "Ticket reaberto", date(ticket.reopenedIn), undefined, "Movidesk");
  addEvent("resolved", "Ticket resolvido", date(ticket.resolvedIn), undefined, "Movidesk");
  addEvent("closed", "Ticket fechado", date(ticket.closedIn), undefined, "Movidesk");

  events.sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());

  return {
    source: "movidesk",
    ticketNumber,
    actionCount,
    events,
    fetchedAt: new Date().toISOString(),
  };
}

async function requestMovideskTicket(ticketNumber: string, select: string, expand?: string): Promise<MovideskTicketHistoryResponse> {
  const token = process.env.MOVIDESK_API_TOKEN?.trim();
  if (!token) throw new MovideskHistoryError("A integração com o Movidesk ainda não foi configurada.", 503);

  const baseUrl = (process.env.MOVIDESK_API_URL?.trim() || "https://api.movidesk.com/public/v1").replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/tickets`);
  url.searchParams.set("token", token);
  url.searchParams.set("id", ticketNumber);
  url.searchParams.set("$select", select);
  if (expand) url.searchParams.set("$expand", expand);

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new MovideskHistoryError(timedOut ? "O Movidesk demorou demais para responder." : "Não foi possível conectar à API do Movidesk.", 502);
  }

  if (response.status === 401 || response.status === 403) {
    throw new MovideskHistoryError("O token da API do Movidesk não foi aceito.", 502);
  }
  if (response.status === 404) throw new MovideskHistoryError(`Ticket #${ticketNumber} não encontrado no Movidesk.`, 404);
  if (!response.ok) throw new MovideskHistoryError("O Movidesk não conseguiu retornar os dados deste ticket.", 502);

  const body = await response.text();
  let result: MovideskTicketHistoryResponse | null;
  try {
    result = JSON.parse(body) as MovideskTicketHistoryResponse | null;
  } catch {
    throw new MovideskHistoryError("O Movidesk retornou uma resposta inválida.", 502);
  }
  if (!result || typeof result !== "object" || Array.isArray(result) || !result.id) {
    throw new MovideskHistoryError(`Ticket #${ticketNumber} não encontrado no Movidesk.`, 404);
  }

  return result;
}

export async function getMovideskTicketHistory(ticketNumber: string): Promise<OfficialTicketHistory> {
  const result = await requestMovideskTicket(
    ticketNumber,
    "id,createdDate,lastActionDate,actionCount,reopenedIn,resolvedIn,closedIn",
    "ownerHistories,statusHistories",
  );

  return mapMovideskTicketHistory(ticketNumber, result);
}

export async function getMovideskTicketSnapshot(ticketNumber: string): Promise<MovideskTicketSnapshot> {
  const result = await requestMovideskTicket(ticketNumber, "id,subject,status");
  const subject = text(result.subject);
  const status = text(result.status);
  if (!subject) throw new MovideskHistoryError("O ticket do Movidesk não possui um assunto válido.", 422);
  if (!status) throw new MovideskHistoryError("O ticket do Movidesk não possui um status válido.", 422);
  return { ticketNumber, subject, status };
}

export async function getMovideskRecentTicketSnapshots(): Promise<{ snapshots: MovideskTicketSnapshot[]; truncated: boolean }> {
  const token = process.env.MOVIDESK_API_TOKEN?.trim();
  if (!token) throw new MovideskHistoryError("A integração com o Movidesk ainda não foi configurada.", 503);

  const baseUrl = (process.env.MOVIDESK_API_URL?.trim() || "https://api.movidesk.com/public/v1").replace(/\/+$/, "");
  const pageSize = 1_000;
  const maximumPages = 8;
  const snapshots = new Map<string, MovideskTicketSnapshot>();
  let truncated = false;

  for (let page = 0; page < maximumPages; page += 1) {
    const url = new URL(`${baseUrl}/tickets`);
    url.searchParams.set("token", token);
    url.searchParams.set("$select", "id,subject,status");
    url.searchParams.set("$orderby", "id desc");
    url.searchParams.set("$top", String(pageSize));
    url.searchParams.set("$skip", String(page * pageSize));

    let response: Response;
    try {
      response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      throw new MovideskHistoryError(timedOut ? "O Movidesk demorou demais para responder." : "Não foi possível conectar à API do Movidesk.", 502);
    }

    if (response.status === 401 || response.status === 403) throw new MovideskHistoryError("O token da API do Movidesk não foi aceito.", 502);
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      throw new MovideskHistoryError(Number.isFinite(retryAfter) && retryAfter > 0
        ? `O limite do Movidesk foi atingido. Tente novamente em ${retryAfter} segundos.`
        : "O limite de consultas do Movidesk foi atingido. Aguarde um minuto e tente novamente.", 429);
    }
    if (!response.ok) throw new MovideskHistoryError("O Movidesk não conseguiu retornar a lista de tickets.", 502);

    const body = await response.text();
    let result: unknown;
    try {
      result = JSON.parse(body) as unknown;
    } catch {
      throw new MovideskHistoryError("O Movidesk retornou uma lista inválida.", 502);
    }
    if (!Array.isArray(result)) throw new MovideskHistoryError("O Movidesk retornou uma lista inválida.", 502);

    for (const raw of result as MovideskTicketHistoryResponse[]) {
      const ticketNumber = String(raw.id ?? "").trim();
      const subject = text(raw.subject);
      const status = text(raw.status);
      if (ticketNumber && subject && status) snapshots.set(ticketNumber, { ticketNumber, subject, status });
    }

    if (result.length < pageSize) break;
    if (page === maximumPages - 1) truncated = true;
  }

  return { snapshots: [...snapshots.values()], truncated };
}
