import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const requiredDatabaseVariables = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingDatabaseVariables = process.env.DATABASE_URL
  ? []
  : requiredDatabaseVariables.filter((key) => !process.env[key]);

if (missingDatabaseVariables.length) {
  throw new Error(
    `Configuração do MySQL ausente: ${missingDatabaseVariables.join(", ")}. ` +
    "Crie o arquivo .env a partir do .env.example e preencha as credenciais reais.",
  );
}

const config = process.env.DATABASE_URL
  ? { uri: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };

const connection = await mysql.createConnection({ ...config, multipleStatements: true });
try {
  const sql = await fs.readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
  await connection.query(sql);
  console.log("Banco Ticketabit atualizado com sucesso.");
} finally {
  await connection.end();
}
