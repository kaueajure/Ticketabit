import "server-only";

import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

const globalForDb = globalThis as unknown as { ticketabitPool?: Pool };

function createDatabasePool() {
  if (process.env.DATABASE_URL) {
    return mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      enableKeepAlive: true,
    });
  }

  const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Configuração MySQL ausente: ${missing.join(", ")}`);

  return mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    enableKeepAlive: true,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });
}

export function getPool() {
  if (!globalForDb.ticketabitPool) globalForDb.ticketabitPool = createDatabasePool();
  return globalForDb.ticketabitPool;
}

export async function query<T extends RowDataPacket[]>(sql: string, values: unknown[] = []) {
  const [rows] = await getPool().execute<T>(sql, values as never[]);
  return rows;
}

export async function execute(sql: string, values: unknown[] = []) {
  const [result] = await getPool().execute<ResultSetHeader>(sql, values as never[]);
  return result;
}

export async function withTransaction<T>(callback: (connection: PoolConnection) => Promise<T>) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
