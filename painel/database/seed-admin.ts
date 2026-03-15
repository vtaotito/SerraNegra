/**
 * Script para criar o usuário administrador inicial.
 * Executar: npx tsx database/seed-admin.ts
 * 
 * Usuário: vitor.tito
 * Email: vtao.tito@gmail.com
 * Senha padrão: Admin@2026
 */

import bcrypt from "bcryptjs";
import { Pool } from "pg";

async function seed() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://wms:CHANGE_ME@localhost:5432/wms",
  });

  const username = "vitor.tito";
  const email = "vtao.tito@gmail.com";
  const displayName = "Vitor Tito";
  const password = "Admin@2026";
  const role = "admin";
  const modules = JSON.stringify(["wms", "cockpit", "b2b"]);

  const passwordHash = await bcrypt.hash(password, 12);

  console.log("Criando usuário administrador...");
  console.log(`  Usuário: ${username}`);
  console.log(`  Email: ${email}`);
  console.log(`  Perfil: ${role}`);
  console.log(`  Senha padrão: ${password}`);
  console.log("");

  try {
    const result = await pool.query(
      `INSERT INTO panel_users (username, email, password_hash, display_name, role, allowed_modules, is_active)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, true)
       ON CONFLICT (username) DO UPDATE SET
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name,
         role = EXCLUDED.role,
         allowed_modules = EXCLUDED.allowed_modules
       RETURNING id, username, role`,
      [username, email, passwordHash, displayName, role, modules]
    );

    const user = result.rows[0];
    console.log(`Administrador criado/atualizado com sucesso!`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Role: ${user.role}`);
    console.log("");
    console.log("IMPORTANTE: Altere a senha após o primeiro login!");
  } catch (error) {
    console.error("Erro ao criar administrador:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
