import "server-only";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { RowDataPacket } from "mysql2/promise";
import { execute, query, withTransaction } from "@/lib/db";
import { AppData, Category, ExtensionTicketInput, ExtensionTicketResult, HistoryEntry, StatusDefinition, SystemItem, Ticket, TicketImportError, TicketImportRow, TicketInput, User } from "@/lib/types";

interface SystemRow extends RowDataPacket, Omit<SystemItem, "active"> { active: boolean | number; }
interface CategoryRow extends RowDataPacket, Omit<Category, "active"> { active: boolean | number; }
interface UserRow extends RowDataPacket, Omit<User, "active" | "avatarUrl"> { active: boolean | number; avatarUpdatedAt: string | null; }
interface StatusRow extends RowDataPacket, Omit<StatusDefinition, "active" | "isFinal"> { active: boolean | number; isFinal: boolean | number; }
interface TicketRow extends RowDataPacket, Omit<Ticket, "history" | "responsibleIds"> {}
interface HistoryRow extends RowDataPacket, HistoryEntry { ticketId: string; }
interface ResponsibleRow extends RowDataPacket { ticketId: string; userId: string; }

export async function getAppData(): Promise<AppData> {
  const [systemRows, categoryRows, statusRows, userRows, ticketRows, historyRows, responsibleRows] = await Promise.all([
    query<SystemRow[]>("select id, name, active from systems order by name"),
    query<CategoryRow[]>("select id, name, color, active from categories order by name"),
    query<StatusRow[]>("select id, name, color, position, active, is_final as isFinal from statuses order by position, name"),
    query<UserRow[]>("select id, name, email, active, avatar_updated_at as avatarUpdatedAt from users order by name"),
    query<TicketRow[]>(`select id, ticket_number as ticketNumber, system_id as systemId, status,
      category_id as categoryId, description,
      received_at as receivedAt, finished_at as finishedAt, created_by as createdBy,
      created_at as createdAt, updated_at as updatedAt
      from tickets order by updated_at desc limit 1000`),
    query<HistoryRow[]>(`select h.id, h.ticket_id as ticketId, h.field, h.previous_value as previousValue,
      h.new_value as newValue, u.name as userName, h.created_at as createdAt
      from ticket_history h join users u on u.id = h.user_id order by h.created_at asc`),
    query<ResponsibleRow[]>("select ticket_id as ticketId, user_id as userId from ticket_responsibles order by created_at, user_id"),
  ]);

  return {
    systems: systemRows.map((row) => ({ ...row, active: Boolean(row.active) })),
    categories: categoryRows.map((row) => ({ ...row, active: Boolean(row.active) })),
    statuses: statusRows.map((row) => ({ ...row, active: Boolean(row.active), isFinal: Boolean(row.isFinal) })),
    users: userRows.map(({ avatarUpdatedAt, ...row }) => ({ ...row, active: Boolean(row.active), avatarUrl: avatarUpdatedAt ? `/api/account/photo/${row.id}?v=${encodeURIComponent(avatarUpdatedAt)}` : null })),
    tickets: ticketRows.map((row) => ({
      ...row,
      responsibleIds: responsibleRows.filter((responsible) => responsible.ticketId === row.id).map((responsible) => responsible.userId),
      finishedAt: row.finishedAt || null,
      history: historyRows.filter((history) => history.ticketId === row.id).map(({ ticketId: _, ...history }) => history),
    })),
  };
}

export class DuplicateTicketError extends Error {
  constructor() {
    super("Já existe um ticket com esse código.");
    this.name = "DuplicateTicketError";
  }
}

export async function createTicket(input: TicketInput, user: User, historyMessage = "Ticket criado") {
  const id = randomUUID();
  const historyId = randomUUID();
  const responsibleIds = [...new Set(input.responsibleIds)];
  if (!responsibleIds.length) throw new Error("Selecione ao menos um responsável.");
  const [statusRows, duplicateRows] = await Promise.all([
    query<RowDataPacket[]>("select id from statuses where name = ? and active = true limit 1", [input.status]),
    query<RowDataPacket[]>("select id from tickets where ticket_number = ? limit 1", [input.ticketNumber.trim()]),
  ]);
  if (!statusRows[0]) throw new Error("Status inválido ou inativo.");
  if (duplicateRows[0]) throw new DuplicateTicketError();
  const responsibleRows = await query<RowDataPacket[]>(`select id from users where active = true and id in (${responsibleIds.map(() => "?").join(",")})`, responsibleIds);
  if (responsibleRows.length !== responsibleIds.length) throw new Error("Um ou mais responsáveis são inválidos ou estão inativos.");
  await withTransaction(async (connection) => {
    await connection.execute(
      `insert into tickets (id, ticket_number, system_id, status, category_id, description,
       responsible_id, received_at, finished_at, created_by, updated_by)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.ticketNumber.trim(), input.systemId, input.status, input.categoryId, input.description.trim(), responsibleIds[0], input.receivedAt, input.finishedAt || null, user.id, user.id],
    );
    await connection.execute(
      `insert into ticket_responsibles (ticket_id, user_id) values ${responsibleIds.map(() => "(?, ?)").join(",")}`,
      responsibleIds.flatMap((responsibleId) => [id, responsibleId]),
    );
    await connection.execute(
      "insert into ticket_history (id, ticket_id, user_id, field, new_value) values (?, ?, ?, 'Ticket', ?)",
      [historyId, id, user.id, historyMessage],
    );
  });
  return id;
}

export class TicketImportValidationError extends Error {
  constructor(public errors: TicketImportError[]) {
    super("Existem dados inválidos no arquivo CSV.");
    this.name = "TicketImportValidationError";
  }
}

function normalizedLookupValue(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export class ExtensionTicketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtensionTicketValidationError";
  }
}

export async function getExtensionOptions() {
  const [systemRows, categoryRows, statusRows] = await Promise.all([
    query<RowDataPacket[]>("select id, name from systems where active = true order by name"),
    query<RowDataPacket[]>("select id, name from categories where active = true order by name"),
    query<RowDataPacket[]>("select id, name, is_final as isFinal from statuses where active = true order by position, name"),
  ]);
  const configuredCategory = process.env.EXTENSION_DEFAULT_CATEGORY?.trim() || "Suporte";
  const configuredStatus = process.env.EXTENSION_DEFAULT_STATUS?.trim() || "Não iniciado";
  const defaultCategory = categoryRows.find((row) => normalizedLookupValue(String(row.name)) === normalizedLookupValue(configuredCategory)) ?? categoryRows[0];
  const defaultStatus = statusRows.find((row) => normalizedLookupValue(String(row.name)) === normalizedLookupValue(configuredStatus))
    ?? statusRows.find((row) => !Boolean(row.isFinal))
    ?? statusRows[0];

  return {
    systems: systemRows.map((row) => ({ id: String(row.id), name: String(row.name) })),
    categories: categoryRows.map((row) => ({ id: String(row.id), name: String(row.name) })),
    statuses: statusRows.map((row) => ({ id: String(row.id), name: String(row.name) })),
    defaults: {
      category: defaultCategory ? String(defaultCategory.name) : "",
      status: defaultStatus ? String(defaultStatus.name) : "",
    },
  };
}

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function findUniqueNamedRow(rows: RowDataPacket[], input: string, label: string, partial = false) {
  const requested = normalizedLookupValue(input);
  const exact = rows.find((row) => normalizedLookupValue(String(row.name)) === requested || String(row.id ?? "") === input);
  if (exact) return exact;
  if (partial && requested) {
    const matches = rows.filter((row) => {
      const candidate = normalizedLookupValue(String(row.name));
      return candidate.includes(requested) || requested.includes(candidate);
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) throw new ExtensionTicketValidationError(`${label} “${input}” corresponde a mais de uma opção ativa.`);
  }
  throw new ExtensionTicketValidationError(`${label} “${input}” não encontrado entre as opções ativas.`);
}

export async function createTicketFromExtension(input: ExtensionTicketInput): Promise<ExtensionTicketResult> {
  const ticketNumber = String(input.ticketNumber ?? "").trim().replace(/^#/, "");
  const title = String(input.title ?? "").trim();
  const systemName = String(input.system ?? "").trim();
  const categoryName = String(input.category ?? "").trim();
  const statusName = String(input.status ?? "Não iniciado").trim() || "Não iniciado";
  const responsibleEmail = String(input.responsibleEmail ?? "").trim();

  if (!ticketNumber || ticketNumber.length > 80) throw new ExtensionTicketValidationError("Informe um número de ticket válido com até 80 caracteres.");
  if (!title) throw new ExtensionTicketValidationError("A extensão não encontrou o título do ticket.");
  if (Buffer.byteLength(title, "utf8") > 65535) throw new ExtensionTicketValidationError("O título do ticket ultrapassa o tamanho permitido.");
  if (!systemName) throw new ExtensionTicketValidationError("A extensão não encontrou o sistema do ticket.");
  if (!categoryName) throw new ExtensionTicketValidationError("Configure a categoria padrão na extensão.");
  if (!responsibleEmail || responsibleEmail.length > 190) throw new ExtensionTicketValidationError("Configure o e-mail do responsável na extensão.");

  const [systemRows, categoryRows, statusRows, userRows] = await Promise.all([
    query<RowDataPacket[]>("select id, name from systems where active = true order by name"),
    query<RowDataPacket[]>("select id, name from categories where active = true order by name"),
    query<RowDataPacket[]>("select name from statuses where active = true order by position, name"),
    query<RowDataPacket[]>("select id, name, email from users where active = true and lower(email) = lower(?) limit 2", [responsibleEmail]),
  ]);

  const system = findUniqueNamedRow(systemRows, systemName, "Sistema", true);
  const category = findUniqueNamedRow(categoryRows, categoryName, "Categoria");
  const status = findUniqueNamedRow(statusRows, statusName, "Status");
  const userRow = userRows[0];
  if (!userRow) throw new ExtensionTicketValidationError(`Responsável “${responsibleEmail}” não encontrado entre os usuários ativos.`);

  const user: User = {
    id: String(userRow.id),
    name: String(userRow.name),
    email: String(userRow.email),
    active: true,
    avatarUrl: null,
  };
  const id = await createTicket({
    ticketNumber,
    systemId: String(system.id),
    status: String(status.name),
    categoryId: String(category.id),
    description: title,
    responsibleIds: [user.id],
    receivedAt: todayInSaoPaulo(),
    finishedAt: null,
  }, user, "Ticket criado pela extensão do Movidesk");

  return {
    id,
    ticketNumber,
    system: String(system.name),
    category: String(category.name),
    status: String(status.name),
    responsible: user.name,
  };
}

function parseImportDate(value: string) {
  const input = value.trim();
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const brMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : brMatch
      ? { year: Number(brMatch[3]), month: Number(brMatch[2]), day: Number(brMatch[1]) }
      : null;
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (date.getUTCFullYear() !== parts.year || date.getUTCMonth() !== parts.month - 1 || date.getUTCDate() !== parts.day) return null;
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export async function importTickets(rows: TicketImportRow[], user: User, force = false) {
  if (!rows.length || rows.length > 1000) {
    throw new TicketImportValidationError([{ row: 0, field: "ticket", message: "O arquivo deve possuir entre 1 e 1.000 linhas." }]);
  }

  const [systemRows, categoryRows, statusRows, userRows] = await Promise.all([
    query<RowDataPacket[]>("select id, name from systems where active = true"),
    query<RowDataPacket[]>("select id, name from categories where active = true"),
    query<RowDataPacket[]>("select name from statuses where active = true"),
    query<RowDataPacket[]>("select id, name, email from users where active = true"),
  ]);
  const systems = new Map(systemRows.map((item) => [normalizedLookupValue(String(item.name)), String(item.id)]));
  const categories = new Map(categoryRows.map((item) => [normalizedLookupValue(String(item.name)), String(item.id)]));
  const statuses = new Map(statusRows.map((item) => [normalizedLookupValue(String(item.name)), String(item.name)]));
  const usersByFirstName = new Map<string, Array<{ id: string; name: string }>>();
  const usersByEmail = new Map<string, { id: string; name: string }>();
  for (const item of userRows) {
    const userOption = { id: String(item.id), name: String(item.name) };
    const firstName = normalizedLookupValue(userOption.name).split(/\s+/)[0];
    usersByFirstName.set(firstName, [...(usersByFirstName.get(firstName) ?? []), userOption]);
    usersByEmail.set(normalizedLookupValue(String(item.email)), userOption);
  }

  const ticketNumbers = rows.map((row) => String(row.ticketNumber ?? "").trim()).filter(Boolean);
  const existingRows = ticketNumbers.length
    ? await query<RowDataPacket[]>(`select ticket_number as ticketNumber from tickets where ticket_number in (${ticketNumbers.map(() => "?").join(",")})`, ticketNumbers)
    : [];
  const existingTickets = new Set(existingRows.map((item) => normalizedLookupValue(String(item.ticketNumber))));
  const fileTickets = new Set<string>();
  const errors: TicketImportError[] = [];
  const blockedIndexes = new Set<number>();

  const addError = (index: number, field: TicketImportError["field"], message: string, kind: TicketImportError["kind"] = "validation") => {
    if (kind !== "duplicate") blockedIndexes.add(index);
    errors.push({
      row: Number(rows[index].sourceRow) || index + 2,
      sheet: rows[index].sourceSheet || undefined,
      field,
      kind,
      message,
    });
  };
  const prepared = rows.map((row, index) => {
    const ticketNumber = String(row.ticketNumber ?? "").trim();
    const systemName = String(row.system ?? "").trim();
    const statusName = String(row.status ?? "").trim();
    const categoryName = String(row.category ?? "").trim();
    const description = String(row.description ?? "").trim();
    const responsibleName = String(row.responsible ?? "").trim();
    const receivedValue = String(row.receivedAt ?? "").trim();
    const finishedValue = String(row.finishedAt ?? "").trim();
    const normalizedTicket = normalizedLookupValue(ticketNumber);
    const systemId = systems.get(normalizedLookupValue(systemName));
    const status = statuses.get(normalizedLookupValue(statusName));
    const categoryId = categories.get(normalizedLookupValue(categoryName));
    const responsibleParts = responsibleName.split(/\s+(?:e|&)\s+|[,;/+]+/i).map((part) => part.trim()).filter(Boolean);
    const responsibleIds: string[] = [];
    for (const responsiblePart of responsibleParts) {
      const normalizedPart = normalizedLookupValue(responsiblePart);
      const matches = responsiblePart.includes("@")
        ? [usersByEmail.get(normalizedPart)].filter((item): item is { id: string; name: string } => Boolean(item))
        : usersByFirstName.get(normalizedPart.split(/\s+/)[0]) ?? [];
      if (!matches.length) addError(index, "responsible", `Responsável “${responsiblePart}” não encontrado entre os usuários ativos.`);
      else if (matches.length > 1) addError(index, "responsible", `Há mais de um usuário com o primeiro nome “${responsiblePart.split(/\s+/)[0]}”. Use o e-mail para identificar.`);
      else responsibleIds.push(matches[0].id);
    }
    const receivedAt = parseImportDate(receivedValue);
    const finishedAt = finishedValue ? parseImportDate(finishedValue) : null;

    if (!ticketNumber) addError(index, "ticketNumber", "Informe o número do ticket.");
    else if (ticketNumber.length > 80) addError(index, "ticketNumber", "O número deve possuir no máximo 80 caracteres.");
    else if (existingTickets.has(normalizedTicket)) addError(index, "ticketNumber", `O ticket ${ticketNumber} já existe.`, "duplicate");
    else if (fileTickets.has(normalizedTicket)) addError(index, "ticketNumber", `O ticket ${ticketNumber} está repetido no arquivo.`, "duplicate");
    if (normalizedTicket) fileTickets.add(normalizedTicket);
    if (!systemName || !systemId) addError(index, "system", `Sistema “${systemName || "vazio"}” não encontrado entre os sistemas ativos.`);
    if (!statusName || !status) addError(index, "status", `Status “${statusName || "vazio"}” não encontrado entre os status ativos.`);
    if (!categoryName || !categoryId) addError(index, "category", `Categoria “${categoryName || "vazia"}” não encontrada entre as categorias ativas.`);
    if (!description) addError(index, "description", "Informe a descrição.");
    else if (Buffer.byteLength(description, "utf8") > 65535) addError(index, "description", "A descrição é maior que o limite permitido.");
    if (!responsibleName) addError(index, "responsible", "Informe ao menos um responsável.");
    if (!receivedAt) addError(index, "receivedAt", "Use uma data válida no formato D/M/AAAA, DD/MM/AAAA ou AAAA-MM-DD.");
    if (finishedValue && !finishedAt) addError(index, "finishedAt", "Use uma data válida no formato D/M/AAAA, DD/MM/AAAA ou AAAA-MM-DD.");

    return {
      id: randomUUID(), ticketNumber, systemId: systemId ?? "", status: status ?? "", categoryId: categoryId ?? "",
      description, responsibleIds: [...new Set(responsibleIds)], receivedAt: receivedAt ?? "", finishedAt,
    };
  });

  if (errors.length && !force) throw new TicketImportValidationError(errors);
  const importable = force ? prepared.filter((_, index) => !blockedIndexes.has(index)) : prepared;
  if (!importable.length) throw new TicketImportValidationError(errors);

  await withTransaction(async (connection) => {
    const ticketPlaceholders = importable.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",");
    const ticketValues = importable.flatMap((item) => [
      item.id, item.ticketNumber, item.systemId, item.status, item.categoryId, item.description,
      item.responsibleIds[0], item.receivedAt, item.finishedAt, user.id, user.id,
    ]);
    await connection.execute(
      `insert into tickets (id, ticket_number, system_id, status, category_id, description, responsible_id, received_at, finished_at, created_by, updated_by) values ${ticketPlaceholders}`,
      ticketValues,
    );
    const responsiblePairs = importable.flatMap((item) => item.responsibleIds.map((responsibleId) => [item.id, responsibleId]));
    await connection.execute(
      `insert into ticket_responsibles (ticket_id, user_id) values ${responsiblePairs.map(() => "(?, ?)").join(",")}`,
      responsiblePairs.flat(),
    );
    const historyPlaceholders = importable.map(() => "(?, ?, ?, 'Ticket', 'Ticket importado via CSV')").join(",");
    const historyValues = importable.flatMap((item) => [randomUUID(), item.id, user.id]);
    await connection.execute(
      `insert into ticket_history (id, ticket_id, user_id, field, new_value) values ${historyPlaceholders}`,
      historyValues,
    );
  });

  return { imported: importable.length, skipped: prepared.length - importable.length };
}

const ticketColumns: Record<string, string> = {
  ticketNumber: "ticket_number",
  systemId: "system_id",
  status: "status",
  categoryId: "category_id",
  description: "description",
  receivedAt: "received_at",
  finishedAt: "finished_at",
};

export async function updateTicket(id: string, changes: Partial<Ticket>, label: string, user: User) {
  await withTransaction(async (connection) => {
    if (changes.responsibleIds) {
      const responsibleIds = [...new Set(changes.responsibleIds)];
      if (!responsibleIds.length) throw new Error("Selecione ao menos um responsável.");
      const [ticketRows] = await connection.execute<RowDataPacket[]>("select id from tickets where id = ? for update", [id]);
      if (!ticketRows[0]) throw new Error("Ticket não encontrado.");
      const [currentResponsibleRows] = await connection.execute<RowDataPacket[]>(`select tr.user_id as id, u.name from ticket_responsibles tr join users u on u.id = tr.user_id where tr.ticket_id = ? order by tr.created_at, u.name`, [id]);
      const [newResponsibleRows] = await connection.execute<RowDataPacket[]>(`select id, name from users where active = true and id in (${responsibleIds.map(() => "?").join(",")})`, responsibleIds);
      if (newResponsibleRows.length !== responsibleIds.length) throw new Error("Um ou mais responsáveis são inválidos ou estão inativos.");
      const newNames = responsibleIds.map((responsibleId) => String(newResponsibleRows.find((row) => row.id === responsibleId)?.name ?? ""));
      await connection.execute("delete from ticket_responsibles where ticket_id = ?", [id]);
      await connection.execute(
        `insert into ticket_responsibles (ticket_id, user_id) values ${responsibleIds.map(() => "(?, ?)").join(",")}`,
        responsibleIds.flatMap((responsibleId) => [id, responsibleId]),
      );
      await connection.execute("update tickets set responsible_id = ?, updated_by = ? where id = ?", [responsibleIds[0], user.id, id]);
      await connection.execute(
        "insert into ticket_history (id, ticket_id, user_id, field, previous_value, new_value) values (?, ?, ?, ?, ?, ?)",
        [randomUUID(), id, user.id, label, currentResponsibleRows.map((row) => row.name).join(", "), newNames.join(", ")],
      );
      return;
    }
    const key = Object.keys(changes).find((item) => ticketColumns[item]);
    if (!key) throw new Error("Campo de ticket inválido.");
    const column = ticketColumns[key];
    const [currentRows] = await connection.execute<RowDataPacket[]>(`select ${column} as value, status from tickets where id = ? for update`, [id]);
    if (!currentRows[0]) throw new Error("Ticket não encontrado.");
    const value = (changes[key as keyof Ticket] ?? null) as string | null;
    if (key === "finishedAt" && value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Data de finalização inválida.");
    if (key === "status") {
      const [configuredStatuses] = await connection.execute<RowDataPacket[]>("select id from statuses where name = ? and active = true limit 1", [value]);
      if (!configuredStatuses[0]) throw new Error("Status inválido ou inativo.");
    }
    await connection.execute(`update tickets set ${column} = ?, updated_by = ? where id = ?`, [value, user.id, id]);
    await connection.execute(
      "insert into ticket_history (id, ticket_id, user_id, field, previous_value, new_value) values (?, ?, ?, ?, ?, ?)",
      [randomUUID(), id, user.id, label, String(currentRows[0].value ?? ""), String(value ?? "")],
    );
  });
}

export async function deleteTicket(id: string) {
  await execute("delete from tickets where id = ?", [id]);
}

export type EntityType = "systems" | "categories" | "statuses" | "users";

export async function createEntity(type: EntityType, payload: Record<string, unknown>) {
  const id = randomUUID();
  if (type === "systems") await execute("insert into systems (id, name, active) values (?, ?, true)", [id, String(payload.name).trim()]);
  if (type === "categories") await execute("insert into categories (id, name, color, active) values (?, ?, ?, true)", [id, String(payload.name).trim(), payload.color ?? "slate"]);
  if (type === "statuses") await execute("insert into statuses (id, name, color, position, active, is_final) values (?, ?, ?, ?, true, ?)", [id, String(payload.name).trim(), payload.color ?? "neutral", Number(payload.position ?? 0), Boolean(payload.isFinal)]);
  if (type === "users") {
    const password = String(payload.password ?? "");
    if (password.length < 6) throw new Error("A senha deve possuir pelo menos 6 caracteres.");
    const hash = await bcrypt.hash(password, 12);
    await execute("insert into users (id, name, email, password_hash, active) values (?, ?, ?, ?, true)", [id, String(payload.name).trim(), String(payload.email).trim().toLowerCase(), hash]);
  }
  return id;
}

export async function updateEntity(type: EntityType, id: string, changes: Record<string, unknown>) {
  const columns: Record<EntityType, Record<string, string>> = {
    systems: { name: "name", active: "active" },
    categories: { name: "name", color: "color", active: "active" },
    statuses: { name: "name", color: "color", position: "position", active: "active", isFinal: "is_final" },
    users: { name: "name", email: "email", active: "active" },
  };
  const entries = Object.entries(changes).filter(([key]) => columns[type][key]);
  const assignmentParts = entries.map(([key]) => `${columns[type][key]} = ?`);
  const values = entries.map(([key, value]) => {
    if (key === "name") return String(value).trim();
    if (key === "email") return String(value).trim().toLowerCase();
    return value;
  });
  if (type === "users" && typeof changes.password === "string" && changes.password) {
    if (changes.password.length < 6) throw new Error("A senha deve possuir pelo menos 6 caracteres.");
    assignmentParts.push("password_hash = ?");
    values.push(await bcrypt.hash(changes.password, 12));
  }
  if (!assignmentParts.length) throw new Error("Campo inválido.");
  const assignments = assignmentParts.join(", ");

  if (type === "statuses" && changes.name) {
    await withTransaction(async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>("select name from statuses where id = ? for update", [id]);
      if (!rows[0]) throw new Error("Status não encontrado.");
      await connection.execute(`update statuses set ${assignments} where id = ?`, [...values, id] as never[]);
      if (rows[0].name !== changes.name) await connection.execute("update tickets set status = ? where status = ?", [changes.name, rows[0].name]);
    });
    return;
  }

  await execute(`update ${type} set ${assignments} where id = ?`, [...values, id]);
}
