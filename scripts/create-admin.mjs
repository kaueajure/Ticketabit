import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
  throw new Error("Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD (mínimo de 8 caracteres).");
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

const connection = await mysql.createConnection(config);
try {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await connection.execute(
    `insert into users (id, name, email, password_hash, role, active)
     values (?, ?, ?, ?, 'Administrador', true)
     on duplicate key update name = values(name), password_hash = values(password_hash), role = 'Administrador', active = true`,
    [randomUUID(), ADMIN_NAME.trim(), ADMIN_EMAIL.trim().toLowerCase(), passwordHash],
  );
  console.log(`Administrador ${ADMIN_EMAIL} criado/atualizado com sucesso.`);
} finally {
  await connection.end();
}
