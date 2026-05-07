const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

let pool;

async function getPool() {
  if (pool && pool.connected) return pool;

  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected to SQL Server');
    return pool;
  } catch (error) {
    console.error('❌ SQL Server Connection Error:', error.message);
    throw error;
  }
}

module.exports = {
  sql,
  getPool
};