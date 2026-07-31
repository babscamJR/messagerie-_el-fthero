// server.js
require("dotenv").config();
console.log("URL détectée :", process.env.DATABASE_URL ? "OUI" : "NON");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");

const { pool, initialiserBase } = require("./db");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Donne toujours le même identifiant pour une conversation entre 2 pseudos
function idConversation(pseudoA, pseudoB) {
  return [pseudoA, pseudoB].sort().join("|");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Les sessions sont stockées en base (elles survivent aux redémarrages)
const sessionMiddleware = session({
  store: new pgSession({
    pool: pool,
    tableName: "sessions",
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || "secret-de-developpement-a-changer",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 jours
});
app.use(sessionMiddleware);

app.use(express.static("public"));

// ---------- AUTHENTIFICATION ----------

app.post("/inscription", async (req, res) => {
  try {
    const { pseudo, motdepasse } = req.body;

    if (!pseudo || !motdepasse) {
      return res.status(400).json({ erreur: "Pseudo et mot de passe requis." });
    }

    const existant = await pool.query(
      "SELECT id FROM utilisateurs WHERE LOWER(pseudo) = LOWER($1)",
      [pseudo]
    );

    if (existant.rows.length > 0) {
      return res.status(400).json({ erreur: "Ce pseudo est déjà pris." });
    }

    const motdepasseCrypte = bcrypt.hashSync(motdepasse, 10);

    await pool.query(
      "INSERT INTO utilisateurs (pseudo, motdepasse) VALUES ($1, $2)",
      [pseudo, motdepasseCrypte]
    );

    req.session.pseudo = pseudo;
    res.json({ succes: true });
  } catch (err) {
    console.error("Erreur inscription :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

app.post("/connexion", async (req, res) => {
  try {
    const { pseudo, motdepasse } = req.body;

    const resultat = await pool.query(
      "SELECT pseudo, motdepasse FROM utilisateurs WHERE LOWER(pseudo) = LOWER($1)",
      [pseudo]
    );

    if (resultat.rows.length === 0) {
      return res.status(400).json({ erreur: "Pseudo ou mot de passe incorrect." });
    }

    const utilisateur = resultat.rows[0];
    const valide = bcrypt.compareSync(motdepasse, utilisateur.motdepasse);

    if (!valide) {
      return res.status(400).json({ erreur: "Pseudo ou mot de passe incorrect." });
    }

    req.session.pseudo = utilisateur.pseudo;
    res.json({ succes: true });
  } catch (err) {
    console.error("Erreur connexion :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

app.post("/deconnexion", (req, res) => {
  req.session.destroy(() => {
    res.json({ succes: true });
  });
});

app.get("/moi", (req, res) => {
  if (req.session.pseudo) {
    res.json({ connecte: true, pseudo: req.session.pseudo });
  } else {
    res.json({ connecte: false });
  }
});

app.get("/utilisateurs", async (req, res) => {
  if (!req.session.pseudo) {
    return res.status(401).json({ erreur: "Non connecté." });
  }

  try {
    const resultat = await pool.query(
      "SELECT pseudo FROM utilisateurs WHERE pseudo != $1 ORDER BY pseudo",
      [req.session.pseudo]
    );
    res.json({ utilisateurs: resultat.rows.map(r => r.pseudo) });
  } catch (err) {
    console.error("Erreur liste utilisateurs :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// ---------- SOCKET.IO ----------

io.engine.use(sessionMiddleware);

const socketsParPseudo = {};

io.on("connection", async (socket) => {
  const session = socket.request.session;

  if (!session || !session.pseudo) {
    socket.disconnect();
    return;
  }

  const monPseudo = session.pseudo;
  socketsParPseudo[monPseudo] = socket.id;
  console.log(`${monPseudo} s'est connecté`);

  // Envoie les 100 derniers messages publics
  try {
    const resultat = await pool.query(
      "SELECT auteur, texte, date FROM messages_publics ORDER BY id DESC LIMIT 100"
    );
    socket.emit("historique_public", resultat.rows.reverse());
  } catch (err) {
    console.error("Erreur historique public :", err);
  }

  // --- Salon public "Radio 1" ---
  socket.on("message_public", async (data) => {
    const texte = (data.texte || "").trim();
    if (!texte) return;

    try {
      const resultat = await pool.query(
        "INSERT INTO messages_publics (auteur, texte) VALUES ($1, $2) RETURNING auteur, texte, date",
        [monPseudo, texte]
      );
      io.emit("message_public", resultat.rows[0]);
    } catch (err) {
      console.error("Erreur message public :", err);
    }
  });

  // --- Messages privés ---
  socket.on("demander_historique_prive", async (data) => {
    try {
      const conversationId = idConversation(monPseudo, data.destinataire);
      const resultat = await pool.query(
        "SELECT auteur, texte, date FROM messages_prives WHERE conversation_id = $1 ORDER BY id ASC LIMIT 200",
        [conversationId]
      );
      socket.emit("historique_prive", {
        avec: data.destinataire,
        messages: resultat.rows
      });
    } catch (err) {
      console.error("Erreur historique privé :", err);
    }
  });

  socket.on("message_prive", async (data) => {
    const texte = (data.texte || "").trim();
    if (!texte || !data.destinataire) return;

    try {
      const conversationId = idConversation(monPseudo, data.destinataire);

      const resultat = await pool.query(
        `INSERT INTO messages_prives (conversation_id, auteur, destinataire, texte)
         VALUES ($1, $2, $3, $4) RETURNING auteur, texte, date`,
        [conversationId, monPseudo, data.destinataire, texte]
      );

      const message = resultat.rows[0];

      // Envoie au destinataire s'il est connecté
      const socketDestinataire = socketsParPseudo[data.destinataire];
      if (socketDestinataire) {
        io.to(socketDestinataire).emit("message_prive", {
          avec: monPseudo,
          message
        });
      }

      // Renvoie à l'expéditeur
      socket.emit("message_prive", {
        avec: data.destinataire,
        message
      });
    } catch (err) {
      console.error("Erreur message privé :", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`${monPseudo} s'est déconnecté`);
    delete socketsParPseudo[monPseudo];
  });
});

// ---------- DÉMARRAGE ----------

const PORT = process.env.PORT || 3000;

initialiserBase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("Impossible d'initialiser la base de données :", err);
    process.exit(1);
  });