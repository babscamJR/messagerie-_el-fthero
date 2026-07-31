// db.js - connexion et initialisation de la base de données PostgreSQL

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render exige SSL en production, mais pas en local
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

// Crée les tables si elles n'existent pas encore
async function initialiserBase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id SERIAL PRIMARY KEY,
      pseudo VARCHAR(50) UNIQUE NOT NULL,
      motdepasse TEXT NOT NULL,
      cree_le TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages_publics (
      id SERIAL PRIMARY KEY,
      auteur VARCHAR(50) NOT NULL,
      texte TEXT NOT NULL,
      date TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages_prives (
      id SERIAL PRIMARY KEY,
      conversation_id VARCHAR(120) NOT NULL,
      auteur VARCHAR(50) NOT NULL,
      destinataire VARCHAR(50) NOT NULL,
      texte TEXT NOT NULL,
      date TIMESTAMP DEFAULT NOW()
    );
  `);

  // Index pour accélérer la recherche des conversations privées
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_conversation
    ON messages_prives (conversation_id);
  `);

  console.log("Base de données initialisée.");
}

module.exports = { pool, initialiserBase };