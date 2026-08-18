import "server-only";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { execute, query, withTransaction } from "@/lib/db";
import { AppData, Category, HistoryEntry, Stage, SystemItem, Ticket, TicketInput, User } from "@/lib/types";
import { today } from "@/lib/utils";

interface SystemRow extends RowDataPacket, Omit<SystemItem, "active"> { active: boolean | number; }
interface CategoryRow extends RowDataPacket, Omit<Category, "active"> { active: boolean | number; }
interface UserRow extends RowDataPacket, Omit<User, "active"> { active: boolean | number; }
interface StageRow extends RowDataPacket, Omit<Stage, "active"> { active: boolean | number; }
interface TicketRow extends RowDataPacket, Omit<Ticket, "stages" | "history"> {}
interface TicketStageRow extends RowDataPacket { ticketId: string; stageId: string; checked: number; }
interface HistoryRow extends RowDataPacket, HistoryEntry { ticketId: string; }

export async function getAppData(): Promise<AppData> {
  const [systemRows, categoryRows, userRows, stageRows, ticketRows, stageLinks, historyRows] = await Promise.all([
    query<SystemRow[]>("select id, name, active from systems order by name"),
    query<CategoryRow[]>("select id, name, color, active from categories order by name"),
    query<UserRow[]>("select id, name, email, role, active from users order by name"),
    query<StageRow[]>("select id, name, abbreviation, position, active from stages order by position, name"),
    query<TicketRow[]>(`select id, ticket_number as ticketNumber, system_id as systemId, status,
      category_id as categoryId, description, responsible_id as responsibleId,
      received_at as receivedAt, finished_at as finishedAt, created_by as createdBy,
      created_at as createdAt, updated_at as updatedAt
      from tickets order by updated_at desc limit 1000`),
    query<TicketStageRow[]>("select ticket_id as ticketId, stage_id as stageId, checked from ticket_stages"),
    query<HistoryRow[]>(`select h.id, h.ticket_id as ticketId, h.field, h.previous_value as previousValue,
      h.new_value as newValue, u.name as userName, h.created_at as createdAt
      from ticket_history h join users u on u.id = h.user_id order by h.created_at asc`),
  ]);

  return {
    systems: systemRows.map((row) => ({ ...row, active: Boolean(row.active) })),
    categories: categoryRows.map((row) => ({ ...row, active: Boolean(row.active) })),
    users: userRows.map((row) => ({ ...row, active: Boolean(row.active) })),
    stages: stageRows.map((row) => ({ ...row, active: Boolean(row.active) })),
    tickets: ticketRows.map((row) => ({
      ...row,
      finishedAt: row.finishedAt || null,
      stages: Object.fromEntries(stageLinks.filter((link) => link.ticketId === row.id).map((link) => [link.stageId, Boolean(link.checked)])),
      history: historyRows.filter((history) => history.ticketId === row.id).map(({ ticketId: _, ...history }) => history),
    })),
  };
}

export async function createTicket(input: TicketInput, user: User) {
  const id = randomUUID();
  const historyId = randomUUID();
  const finishedAt = input.status === "Finalizado" ? today() : null;
  await withTransaction(async (connection) => {
    await connection.execute(
      `insert into tickets (id, ticket_number, system_id, status, category_id, description,
       responsible_id, received_at, finished_at, created_by, updated_by)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.ticketNumber.trim(), input.systemId, input.status, input.categoryId, input.description.trim(), input.responsibleId, input.receivedAt, finishedAt, user.id, user.id],
    );
    const checkedStages = Object.entries(input.stages);
    for (const [stageId, checked] of checkedStages) {
      await connection.execute("insert into ticket_stages (ticket_id, stage_id, checked) values (?, ?, ?)", [id, stageId, checked]);
    }
    await connection.execute(
      "insert into ticket_history (id, ticket_id, user_id, field, new_value) values (?, ?, ?, 'Ticket', 'Ticket criado')",
      [historyId, id, user.id],
    );
  });
  return id;
}

const ticketColumns: Record<string, string> = {
  ticketNumber: "ticket_number",
  systemId: "system_id",
  status: "status",
  categoryId: "category_id",
  description: "description",
  responsibleId: "responsible_id",
  receivedAt: "received_at",
  finishedAt: "finished_at",
};

export async function updateTicket(id: string, changes: Partial<Ticket>, label: string, user: User) {
  await withTransaction(async (connection) => {
    if (changes.stages) {
      for (const [stageId, checked] of Object.entries(changes.stages)) {
        await connection.execute(
          "insert into ticket_stages (ticket_id, stage_id, checked) values (?, ?, ?) on duplicate key update checked = values(checked)",
          [id, stageId, checked],
        );
      }
      await connection.execute(
        "insert into ticket_history (id, ticket_id, user_id, field, new_value) values (?, ?, ?, ?, ?)",
        [randomUUID(), id, user.id, label, "Etapas atualizadas"],
      );
      await connection.execute("update tickets set updated_by = ?, updated_at = current_timestamp where id = ?", [user.id, id]);
      return;
    }

    const key = Object.keys(changes).find((item) => ticketColumns[item]);
    if (!key) throw new Error("Campo de ticket inválido.");
    const column = ticketColumns[key];
    const [currentRows] = await connection.execute<RowDataPacket[]>(`select ${column} as value, status from tickets where id = ? for update`, [id]);
    if (!currentRows[0]) throw new Error("Ticket não encontrado.");
    const value = (changes[key as keyof Ticket] ?? null) as string | null;
    const extra = key === "status"
      ? String(value) === "Finalizado"
        ? ", finished_at = current_date"
        : currentRows[0].status === "Finalizado" ? ", finished_at = null" : ""
      : "";
    await connection.execute(`update tickets set ${column} = ?, updated_by = ?${extra} where id = ?`, [value, user.id, id]);
    await connection.execute(
      "insert into ticket_history (id, ticket_id, user_id, field, previous_value, new_value) values (?, ?, ?, ?, ?, ?)",
      [randomUUID(), id, user.id, label, String(currentRows[0].value ?? ""), String(value ?? "")],
    );
  });
}

export async function deleteTicket(id: string) {
  await execute("delete from tickets where id = ?", [id]);
}

export type EntityType = "systems" | "categories" | "users" | "stages";

export async function createEntity(type: EntityType, payload: Record<string, unknown>) {
  const id = randomUUID();
  if (type === "systems") await execute("insert into systems (id, name, active) values (?, ?, true)", [id, String(payload.name).trim()]);
  if (type === "categories") await execute("insert into categories (id, name, color, active) values (?, ?, ?, true)", [id, String(payload.name).trim(), payload.color ?? "slate"]);
  if (type === "stages") await execute("insert into stages (id, name, abbreviation, position, active) values (?, ?, ?, ?, true)", [id, String(payload.name).trim(), String(payload.abbreviation).trim().slice(0, 2).toUpperCase(), Number(payload.position ?? 0)]);
  if (type === "users") {
    const password = String(payload.password ?? "");
    if (password.length < 8) throw new Error("A senha deve possuir pelo menos 8 caracteres.");
    const hash = await bcrypt.hash(password, 12);
    await execute("insert into users (id, name, email, password_hash, role, active) values (?, ?, ?, ?, ?, true)", [id, String(payload.name).trim(), String(payload.email).trim().toLowerCase(), hash, payload.role === "Administrador" ? "Administrador" : "Usuário"]);
  }
  return id;
}

export async function updateEntity(type: EntityType, id: string, changes: Record<string, unknown>) {
  const allowed: Record<EntityType, string[]> = {
    systems: ["name", "active"], categories: ["name", "color", "active"], users: ["name", "email", "role", "active"], stages: ["name", "abbreviation", "position", "active"],
  };
  const key = Object.keys(changes).find((item) => allowed[type].includes(item));
  if (!key) throw new Error("Campo inválido.");
  await execute(`update ${type} set ${key} = ? where id = ?`, [changes[key], id]);
}
