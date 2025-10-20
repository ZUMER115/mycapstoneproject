// src/config/db.js
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // required by many hosted PG providers
  },
});

// small helper to run queries
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
