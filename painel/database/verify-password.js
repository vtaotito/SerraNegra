const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://wms:wms_prod_password_2026@31.97.174.120:5432/wms",
});

async function run() {
  const res = await pool.query("SELECT password_hash FROM panel_users WHERE username = 'vitor.tito'");
  const hash = res.rows[0].password_hash;
  console.log("Hash:", hash);
  
  const match = await bcrypt.compare("Admin@2026", hash);
  console.log("Password matches:", match);
  
  if (!match) {
    console.log("Resetting password...");
    const newHash = await bcrypt.hash("Admin@2026", 12);
    await pool.query("UPDATE panel_users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL WHERE username = 'vitor.tito'", [newHash]);
    console.log("Password reset OK. New hash:", newHash);
  }
  
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
