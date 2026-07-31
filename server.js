// server.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");

const { pool, initialiserBase } = require("./db");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

// Configuration Cloudinary (les clés viennent des variables d'environnement)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer garde le fichier en mémoire le temps de l'envoyer à Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo maximum
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Seules les images sont autorisées."));
    }
  }
});

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
      "SELECT pseudo, motdepasse, is_banni FROM utilisateurs WHERE LOWER(pseudo) = LOWER($1)",
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

    if (utilisateur.is_banni) {
      return res.status(403).json({ erreur: "Ce compte a été banni." });
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

app.get("/moi", async (req, res) => {
  if (!req.session.pseudo) {
    return res.json({ connecte: false });
  }

  try {
    const resultat = await pool.query(
      "SELECT is_admin, is_banni FROM utilisateurs WHERE pseudo = $1",
      [req.session.pseudo]
    );

    // Compte supprimé ou banni entre-temps
    if (resultat.rows.length === 0 || resultat.rows[0].is_banni) {
      return req.session.destroy(() => res.json({ connecte: false }));
    }

    res.json({
      connecte: true,
      pseudo: req.session.pseudo,
      isAdmin: resultat.rows[0].is_admin
    });
  } catch (err) {
    console.error("Erreur /moi :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// ---------- MODÉRATION ----------

// Vérifie que la personne connectée est bien admin
async function estAdmin(pseudo) {
  if (!pseudo) return false;
  const resultat = await pool.query(
    "SELECT is_admin FROM utilisateurs WHERE pseudo = $1",
    [pseudo]
  );
  return resultat.rows.length > 0 && resultat.rows[0].is_admin === true;
}

// Middleware : bloque l'accès aux routes admin
async function verifierAdmin(req, res, next) {
  if (!req.session.pseudo) {
    return res.status(401).json({ erreur: "Non connecté." });
  }
  if (!(await estAdmin(req.session.pseudo))) {
    return res.status(403).json({ erreur: "Accès refusé." });
  }
  next();
}

// Devenir admin avec la clé secrète (une seule fois, ensuite le rôle est permanent)
app.post("/devenir-admin", async (req, res) => {
  if (!req.session.pseudo) {
    return res.status(401).json({ erreur: "Non connecté." });
  }

  const cleAttendue = process.env.ADMIN_KEY;

  if (!cleAttendue) {
    return res.status(500).json({ erreur: "Aucune clé admin configurée sur le serveur." });
  }

  if (req.body.cle !== cleAttendue) {
    console.warn(`Tentative admin échouée par ${req.session.pseudo}`);
    return res.status(403).json({ erreur: "Clé incorrecte." });
  }

  try {
    await pool.query(
      "UPDATE utilisateurs SET is_admin = TRUE WHERE pseudo = $1",
      [req.session.pseudo]
    );
    console.log(`${req.session.pseudo} est devenu administrateur.`);
    res.json({ succes: true });
  } catch (err) {
    console.error("Erreur devenir-admin :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// Liste complète des utilisateurs avec leur statut
app.get("/admin/utilisateurs", verifierAdmin, async (req, res) => {
  try {
    const resultat = await pool.query(
      "SELECT pseudo, is_admin, is_banni, cree_le FROM utilisateurs ORDER BY pseudo"
    );
    res.json({ utilisateurs: resultat.rows });
  } catch (err) {
    console.error("Erreur liste admin :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// Bannir / débannir un compte
app.post("/admin/bannir", verifierAdmin, async (req, res) => {
  const { pseudo, bannir } = req.body;

  if (pseudo === req.session.pseudo) {
    return res.status(400).json({ erreur: "Vous ne pouvez pas vous bannir vous-même." });
  }

  try {
    // On ne peut pas bannir un autre admin
    const cible = await pool.query(
      "SELECT is_admin FROM utilisateurs WHERE pseudo = $1",
      [pseudo]
    );

    if (cible.rows.length === 0) {
      return res.status(404).json({ erreur: "Utilisateur introuvable." });
    }

    if (cible.rows[0].is_admin && bannir) {
      return res.status(403).json({ erreur: "Impossible de bannir un administrateur." });
    }

    await pool.query(
      "UPDATE utilisateurs SET is_banni = $1 WHERE pseudo = $2",
      [bannir === true, pseudo]
    );

    console.log(`${req.session.pseudo} a ${bannir ? "banni" : "débanni"} ${pseudo}`);

    // Déconnecte immédiatement la personne bannie si elle est en ligne
    if (bannir === true) {
      deconnecterUtilisateur(pseudo);
    }

    res.json({ succes: true });
  } catch (err) {
    console.error("Erreur bannissement :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// Supprimer un message
app.post("/admin/supprimer-message", verifierAdmin, async (req, res) => {
  const { id, type } = req.body;

  if (!id || !["public", "prive"].includes(type)) {
    return res.status(400).json({ erreur: "Paramètres invalides." });
  }

  try {
    const table = type === "public" ? "messages_publics" : "messages_prives";
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);

    console.log(`${req.session.pseudo} a supprimé le message ${type} #${id}`);

    // Prévient tous les clients pour qu'ils retirent le message affiché
    io.emit("message_supprime", { id, type });

    res.json({ succes: true });
  } catch (err) {
    console.error("Erreur suppression message :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
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

// ---------- UPLOAD D'IMAGES ----------

app.post("/upload-image", upload.single("image"), async (req, res) => {
  if (!req.session.pseudo) {
    return res.status(401).json({ erreur: "Non connecté." });
  }

  if (!req.file) {
    return res.status(400).json({ erreur: "Aucune image reçue." });
  }

  try {
    // Envoie l'image à Cloudinary depuis la mémoire
    const resultat = await new Promise((resolve, reject) => {
      const flux = cloudinary.uploader.upload_stream(
        {
          folder: "messagerie",
          transformation: [
            { width: 1200, height: 1200, crop: "limit" }, // réduit les très grandes images
            { quality: "auto" }
          ]
        },
        (erreur, resultat) => {
          if (erreur) reject(erreur);
          else resolve(resultat);
        }
      );
      flux.end(req.file.buffer);
    });

    res.json({ succes: true, url: resultat.secure_url });
  } catch (err) {
    console.error("Erreur upload image :", err);
    res.status(500).json({ erreur: "Impossible d'envoyer l'image." });
  }
});

// Gestion des erreurs de multer (fichier trop lourd, mauvais type...)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ erreur: "Image trop lourde (5 Mo maximum)." });
  }
  if (err) {
    return res.status(400).json({ erreur: err.message });
  }
  next();
});

// ---------- SOCKET.IO ----------

io.engine.use(sessionMiddleware);

const socketsParPseudo = {};

// Déconnecte de force un utilisateur (utilisé lors d'un bannissement)
function deconnecterUtilisateur(pseudo) {
  const socketId = socketsParPseudo[pseudo];
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit("banni");
      socket.disconnect(true);
    }
  }
}

io.on("connection", async (socket) => {
  const session = socket.request.session;

  if (!session || !session.pseudo) {
    socket.disconnect();
    return;
  }

  const monPseudo = session.pseudo;

  // Vérifie que le compte n'est pas banni
  try {
    const verif = await pool.query(
      "SELECT is_banni FROM utilisateurs WHERE pseudo = $1",
      [monPseudo]
    );
    if (verif.rows.length === 0 || verif.rows[0].is_banni) {
      socket.emit("banni");
      socket.disconnect(true);
      return;
    }
  } catch (err) {
    console.error("Erreur vérification bannissement :", err);
    socket.disconnect(true);
    return;
  }

  socketsParPseudo[monPseudo] = socket.id;
  console.log(`${monPseudo} s'est connecté`);

  // Envoie les 100 derniers messages publics
  try {
    const resultat = await pool.query(
      "SELECT id, auteur, texte, image_url, date FROM messages_publics ORDER BY id DESC LIMIT 100"
    );
    socket.emit("historique_public", resultat.rows.reverse());
  } catch (err) {
    console.error("Erreur historique public :", err);
  }

  // --- Salon public "Radio 1" ---
  socket.on("message_public", async (data) => {
    const texte = (data.texte || "").trim();
    const imageUrl = data.imageUrl || null;

    // Il faut au moins un texte OU une image
    if (!texte && !imageUrl) return;

    try {
      const resultat = await pool.query(
        "INSERT INTO messages_publics (auteur, texte, image_url) VALUES ($1, $2, $3) RETURNING id, auteur, texte, image_url, date",
        [monPseudo, texte || null, imageUrl]
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
        "SELECT id, auteur, texte, image_url, date FROM messages_prives WHERE conversation_id = $1 ORDER BY id ASC LIMIT 200",
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
    const imageUrl = data.imageUrl || null;

    if ((!texte && !imageUrl) || !data.destinataire) return;

    try {
      const conversationId = idConversation(monPseudo, data.destinataire);

      const resultat = await pool.query(
        `INSERT INTO messages_prives (conversation_id, auteur, destinataire, texte, image_url)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, auteur, texte, image_url, date`,
        [conversationId, monPseudo, data.destinataire, texte || null, imageUrl]
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