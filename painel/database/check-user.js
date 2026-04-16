const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://wms:wms_prod_password_2026@31.97.174.120:5432/wms",
});

pool.query("SELECT username, failed_login_attempts, locked_until, is_active, password_hash FROM panel_users WHERE username = 'vitor.tito'")
  .then((r) => {
    console.log(JSON.stringify(r.rows[0], null, 2));
    pool.end();
  })
  .catch((e) => { console.error(e); pool.end(); });
