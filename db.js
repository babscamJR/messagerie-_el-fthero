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
      texte TEXT,
      image_url TEXT,
      date TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages_prives (
      id SERIAL PRIMARY KEY,
      conversation_id VARCHAR(120) NOT NULL,
      auteur VARCHAR(50) NOT NULL,
      destinataire VARCHAR(50) NOT NULL,
      texte TEXT,
      image_url TEXT,
      date TIMESTAMP DEFAULT NOW()
    );
  `);

  // Colonne "salon" pour distinguer les différentes radios
  await pool.query(`ALTER TABLE messages_publics ADD COLUMN IF NOT EXISTS salon VARCHAR(30) DEFAULT 'radio1';`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_salon ON messages_publics (salon);`);

  // ----- Format forum pour Radio 2 (HR) -----

  await pool.query(`
    CREATE TABLE IF NOT EXISTS publications (
      id SERIAL PRIMARY KEY,
      salon VARCHAR(30) NOT NULL DEFAULT 'radio2',
      auteur VARCHAR(50) NOT NULL,
      titre VARCHAR(200) NOT NULL,
      contenu TEXT,
      image_url TEXT,
      date TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
      pseudo VARCHAR(50) NOT NULL,
      valeur SMALLINT NOT NULL,
      UNIQUE (publication_id, pseudo)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS commentaires (
      id SERIAL PRIMARY KEY,
      publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
      auteur VARCHAR(50) NOT NULL,
      texte TEXT NOT NULL,
      date TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pub_salon ON publications (salon);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_com_pub ON commentaires (publication_id);`);

  // Colonnes de modération sur les comptes
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS is_banni BOOLEAN DEFAULT FALSE;`);

  // Ajoute les colonnes image si les tables existaient déjà sans elles
  await pool.query(`ALTER TABLE messages_publics ADD COLUMN IF NOT EXISTS image_url TEXT;`);
  await pool.query(`ALTER TABLE messages_prives ADD COLUMN IF NOT EXISTS image_url TEXT;`);
  await pool.query(`ALTER TABLE messages_publics ALTER COLUMN texte DROP NOT NULL;`);
  await pool.query(`ALTER TABLE messages_prives ALTER COLUMN texte DROP NOT NULL;`);

  // Index pour accélérer la recherche des conversations privées
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_conversation
    ON messages_prives (conversation_id);
  `);

  console.log("Base de données initialisée.");
}

module.exports = { pool, initialiserBase };