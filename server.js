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

// Salons publics disponibles
// adminSeul: true => seuls les administrateurs peuvent y écrire
const SALONS = {
  radio1: { nom: "📻 Radio 1", adminSeul: false, type: "chat" },
  radio2: { nom: "👻 Radio 2 (HR)", adminSeul: false, type: "forum" },
  radio3: { nom: "📢 Radio 3 (Annonces)", adminSeul: true, type: "chat" }
};

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
      "SELECT is_admin, is_banni, doit_changer_mdp FROM utilisateurs WHERE pseudo = $1",
      [req.session.pseudo]
    );

    // Compte supprimé ou banni entre-temps
    if (resultat.rows.length === 0 || resultat.rows[0].is_banni) {
      return req.session.destroy(() => res.json({ connecte: false }));
    }

    res.json({
      connecte: true,
      pseudo: req.session.pseudo,
      isAdmin: resultat.rows[0].is_admin,
      doitChangerMdp: resultat.rows[0].doit_changer_mdp === true
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

// Génère un mot de passe temporaire lisible (évite les caractères ambigus)
function genererMotDePasseTemporaire() {
  const lettres = "abcdefghijkmnpqrstuvwxyz";
  const chiffres = "23456789";
  let mdp = "";
  for (let i = 0; i < 4; i++) mdp += lettres[Math.floor(Math.random() * lettres.length)];
  mdp += "-";
  for (let i = 0; i < 4; i++) mdp += chiffres[Math.floor(Math.random() * chiffres.length)];
  return mdp;
}

// Réinitialise le mot de passe d'un compte et renvoie le nouveau
app.post("/admin/reinitialiser-motdepasse", verifierAdmin, async (req, res) => {
  const { pseudo } = req.body;

  if (!pseudo) {
    return res.status(400).json({ erreur: "Pseudo manquant." });
  }

  try {
    const cible = await pool.query(
      "SELECT is_admin FROM utilisateurs WHERE pseudo = $1",
      [pseudo]
    );

    if (cible.rows.length === 0) {
      return res.status(404).json({ erreur: "Utilisateur introuvable." });
    }

    // Un admin ne peut pas réinitialiser le mot de passe d'un autre admin
    if (cible.rows[0].is_admin && pseudo !== req.session.pseudo) {
      return res.status(403).json({ erreur: "Impossible de réinitialiser le mot de passe d'un administrateur." });
    }

    const nouveau = genererMotDePasseTemporaire();
    const crypte = bcrypt.hashSync(nouveau, 10);

    await pool.query(
      "UPDATE utilisateurs SET motdepasse = $1, doit_changer_mdp = TRUE WHERE pseudo = $2",
      [crypte, pseudo]
    );

    console.log(`${req.session.pseudo} a réinitialisé le mot de passe de ${pseudo}`);

    // Déconnecte la personne pour qu'elle se reconnecte avec le nouveau
    deconnecterUtilisateur(pseudo);

    res.json({ succes: true, motdepasse: nouveau });
  } catch (err) {
    console.error("Erreur réinitialisation mot de passe :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// Changer son propre mot de passe
app.post("/changer-motdepasse", async (req, res) => {
  if (!req.session.pseudo) {
    return res.status(401).json({ erreur: "Non connecté." });
  }

  const { actuel, nouveau } = req.body;

  if (!actuel || !nouveau) {
    return res.status(400).json({ erreur: "Tous les champs sont requis." });
  }

  if (nouveau.length < 4) {
    return res.status(400).json({ erreur: "Le nouveau mot de passe doit faire au moins 4 caractères." });
  }

  try {
    const resultat = await pool.query(
      "SELECT motdepasse FROM utilisateurs WHERE pseudo = $1",
      [req.session.pseudo]
    );

    if (resultat.rows.length === 0) {
      return res.status(404).json({ erreur: "Compte introuvable." });
    }

    if (!bcrypt.compareSync(actuel, resultat.rows[0].motdepasse)) {
      return res.status(400).json({ erreur: "Mot de passe actuel incorrect." });
    }

    const crypte = bcrypt.hashSync(nouveau, 10);
    await pool.query(
      "UPDATE utilisateurs SET motdepasse = $1, doit_changer_mdp = FALSE WHERE pseudo = $2",
      [crypte, req.session.pseudo]
    );

    console.log(`${req.session.pseudo} a changé son mot de passe`);
    res.json({ succes: true });
  } catch (err) {
    console.error("Erreur changement mot de passe :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// Liste des groupes en attente de validation
app.get("/admin/groupes-en-attente", verifierAdmin, async (req, res) => {
  try {
    const resultat = await pool.query(`
      SELECT id, titre, createur, cree_le,
             EXTRACT(DAY FROM NOW() - cree_le)::int AS jours_ecoules
      FROM groupes
      WHERE statut = 'en_attente'
      ORDER BY cree_le ASC
    `);
    res.json({ groupes: resultat.rows });
  } catch (err) {
    console.error("Erreur groupes en attente :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// Valider ou refuser un groupe
app.post("/admin/valider-groupe", verifierAdmin, async (req, res) => {
  const { id, accepter } = req.body;
  if (!id) return res.status(400).json({ erreur: "ID manquant." });

  try {
    if (accepter === true) {
      await pool.query(
        "UPDATE groupes SET statut = 'valide', valide_par = $1, valide_le = NOW() WHERE id = $2",
        [req.session.pseudo, id]
      );
      console.log(`${req.session.pseudo} a validé le groupe #${id}`);
      io.emit("groupe_valide", { id });
    } else {
      await pool.query("DELETE FROM groupes WHERE id = $1", [id]);
      console.log(`${req.session.pseudo} a refusé le groupe #${id}`);
      io.emit("groupe_supprime", { id });
    }

    res.json({ succes: true });
  } catch (err) {
    console.error("Erreur validation groupe :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// Supprimer définitivement un compte et tout ce qui lui appartient
app.post("/admin/supprimer-compte", verifierAdmin, async (req, res) => {
  const { pseudo } = req.body;

  if (!pseudo) {
    return res.status(400).json({ erreur: "Pseudo manquant." });
  }

  if (pseudo === req.session.pseudo) {
    return res.status(400).json({ erreur: "Vous ne pouvez pas supprimer votre propre compte." });
  }

  try {
    const cible = await pool.query(
      "SELECT is_admin FROM utilisateurs WHERE pseudo = $1",
      [pseudo]
    );

    if (cible.rows.length === 0) {
      return res.status(404).json({ erreur: "Utilisateur introuvable." });
    }

    if (cible.rows[0].is_admin) {
      return res.status(403).json({ erreur: "Impossible de supprimer un administrateur." });
    }

    // Déconnecte la personne avant de tout effacer
    deconnecterUtilisateur(pseudo);

    // Supprime tout ce qui est rattaché au compte.
    // Les commentaires et votes des publications partent en cascade.
    await pool.query("DELETE FROM membres_groupe WHERE pseudo = $1", [pseudo]);
    await pool.query("DELETE FROM invitations_groupe WHERE invite = $1 OR invite_par = $1", [pseudo]);
    await pool.query("DELETE FROM messages_groupe WHERE auteur = $1", [pseudo]);
    await pool.query("DELETE FROM groupes WHERE createur = $1 AND statut = 'en_attente'", [pseudo]);
    await pool.query("DELETE FROM commentaires WHERE auteur = $1", [pseudo]);
    await pool.query("DELETE FROM votes WHERE pseudo = $1", [pseudo]);
    await pool.query("DELETE FROM publications WHERE auteur = $1", [pseudo]);
    await pool.query("DELETE FROM messages_prives WHERE auteur = $1 OR destinataire = $1", [pseudo]);
    await pool.query("DELETE FROM messages_publics WHERE auteur = $1", [pseudo]);
    await pool.query("DELETE FROM utilisateurs WHERE pseudo = $1", [pseudo]);

    console.log(`${req.session.pseudo} a SUPPRIMÉ le compte ${pseudo}`);

    io.emit("compte_supprime", { pseudo });

    res.json({ succes: true });
  } catch (err) {
    console.error("Erreur suppression compte :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// Supprimer une publication du forum (et ses commentaires/votes en cascade)
app.post("/admin/supprimer-publication", verifierAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ erreur: "ID manquant." });

  try {
    await pool.query("DELETE FROM publications WHERE id = $1", [id]);
    console.log(`${req.session.pseudo} a supprimé la publication #${id}`);
    io.emit("publication_supprimee", { id });
    res.json({ succes: true });
  } catch (err) {
    console.error("Erreur suppression publication :", err);
    res.status(500).json({ erreur: "Erreur serveur." });
  }
});

// Supprimer un commentaire
app.post("/admin/supprimer-commentaire", verifierAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ erreur: "ID manquant." });

  try {
    await pool.query("DELETE FROM commentaires WHERE id = $1", [id]);
    console.log(`${req.session.pseudo} a supprimé le commentaire #${id}`);
    io.emit("commentaire_supprime", { id });
    res.json({ succes: true });
  } catch (err) {
    console.error("Erreur suppression commentaire :", err);
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

// Envoie à tout le monde la liste des pseudos actuellement connectés
function diffuserPresence() {
  io.emit("presence", { enLigne: Object.keys(socketsParPseudo) });
}

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
  diffuserPresence();

  // Envoie la liste des salons disponibles au client
  socket.emit("liste_salons", SALONS);

  // Historique d'un salon donné, à la demande
  socket.on("demander_historique_salon", async (data) => {
    const salon = data.salon;
    if (!SALONS[salon]) return;

    try {
      const resultat = await pool.query(
        "SELECT id, auteur, texte, image_url, date FROM messages_publics WHERE salon = $1 ORDER BY id DESC LIMIT 100",
        [salon]
      );
      socket.emit("historique_salon", {
        salon,
        messages: resultat.rows.reverse()
      });
    } catch (err) {
      console.error("Erreur historique salon :", err);
    }
  });

  // --- Salon public "Radio 1" ---
  socket.on("message_public", async (data) => {
    const texte = (data.texte || "").trim();
    const imageUrl = data.imageUrl || null;
    const salon = data.salon || "radio1";

    // Salon inexistant
    if (!SALONS[salon]) return;

    // Il faut au moins un texte OU une image
    if (!texte && !imageUrl) return;

    // Vérifie les droits d'écriture pour les salons réservés aux admins
    if (SALONS[salon].adminSeul) {
      const autorise = await estAdmin(monPseudo);
      if (!autorise) {
        socket.emit("erreur_envoi", {
          message: "Seuls les administrateurs peuvent écrire dans ce salon."
        });
        return;
      }
    }

    try {
      const resultat = await pool.query(
        "INSERT INTO messages_publics (auteur, texte, image_url, salon) VALUES ($1, $2, $3, $4) RETURNING id, auteur, texte, image_url, date, salon",
        [monPseudo, texte || null, imageUrl, salon]
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

  // ---------- GROUPES ----------

  // Vérifie qu'une personne est bien membre d'un groupe validé
  async function estMembre(groupeId, pseudo) {
    const r = await pool.query(`
      SELECT 1 FROM membres_groupe m
      JOIN groupes g ON g.id = m.groupe_id
      WHERE m.groupe_id = $1 AND m.pseudo = $2 AND g.statut = 'valide'
    `, [groupeId, pseudo]);
    return r.rows.length > 0;
  }

  // Envoie à la personne la liste de ses groupes et invitations
  async function envoyerMesGroupes() {
    try {
      const groupes = await pool.query(`
        SELECT g.id, g.titre, g.statut, g.createur,
               (SELECT COUNT(*) FROM membres_groupe m2 WHERE m2.groupe_id = g.id)::int AS nb_membres
        FROM groupes g
        JOIN membres_groupe m ON m.groupe_id = g.id
        WHERE m.pseudo = $1
        ORDER BY g.titre
      `, [monPseudo]);

      const invitations = await pool.query(`
        SELECT i.id, i.groupe_id, i.invite_par, g.titre
        FROM invitations_groupe i
        JOIN groupes g ON g.id = i.groupe_id
        WHERE i.invite = $1 AND g.statut = 'valide'
      `, [monPseudo]);

      socket.emit("mes_groupes", {
        groupes: groupes.rows,
        invitations: invitations.rows
      });
    } catch (err) {
      console.error("Erreur mes_groupes :", err);
    }
  }

  socket.on("demander_mes_groupes", envoyerMesGroupes);

  // Créer un groupe (en attente de validation)
  socket.on("creer_groupe", async (data) => {
    const titre = (data.titre || "").trim();

    if (!titre) {
      socket.emit("erreur_envoi", { message: "Le titre du groupe est obligatoire." });
      return;
    }

    if (titre.length > 100) {
      socket.emit("erreur_envoi", { message: "Titre trop long (100 caractères maximum)." });
      return;
    }

    try {
      const resultat = await pool.query(
        "INSERT INTO groupes (titre, createur) VALUES ($1, $2) RETURNING id, titre, statut, createur",
        [titre, monPseudo]
      );

      const groupe = resultat.rows[0];

      // Le créateur devient automatiquement membre
      await pool.query(
        "INSERT INTO membres_groupe (groupe_id, pseudo) VALUES ($1, $2)",
        [groupe.id, monPseudo]
      );

      console.log(`${monPseudo} a créé le groupe "${titre}" (en attente)`);

      socket.emit("groupe_cree", { groupe });
      envoyerMesGroupes();

      // Prévient les admins connectés qu'une demande attend
      io.emit("demande_groupe_en_attente");
    } catch (err) {
      console.error("Erreur création groupe :", err);
    }
  });

  // Inviter quelqu'un (réservé aux membres du groupe)
  socket.on("inviter_groupe", async (data) => {
    const groupeId = parseInt(data.groupeId, 10);
    const invite = (data.pseudo || "").trim();

    if (!groupeId || !invite) return;

    try {
      if (!(await estMembre(groupeId, monPseudo))) {
        socket.emit("erreur_envoi", { message: "Vous n'êtes pas membre de ce groupe." });
        return;
      }

      const existe = await pool.query(
        "SELECT 1 FROM utilisateurs WHERE pseudo = $1 AND is_banni = FALSE",
        [invite]
      );
      if (existe.rows.length === 0) {
        socket.emit("erreur_envoi", { message: "Utilisateur introuvable." });
        return;
      }

      const dejaMembre = await pool.query(
        "SELECT 1 FROM membres_groupe WHERE groupe_id = $1 AND pseudo = $2",
        [groupeId, invite]
      );
      if (dejaMembre.rows.length > 0) {
        socket.emit("erreur_envoi", { message: "Cette personne est déjà dans le groupe." });
        return;
      }

      await pool.query(
        `INSERT INTO invitations_groupe (groupe_id, invite, invite_par)
         VALUES ($1, $2, $3) ON CONFLICT (groupe_id, invite) DO NOTHING`,
        [groupeId, invite, monPseudo]
      );

      socket.emit("erreur_envoi", { message: `Invitation envoyée à ${invite}.` });

      // Notifie la personne invitée si elle est connectée
      const socketInvite = socketsParPseudo[invite];
      if (socketInvite) {
        io.to(socketInvite).emit("nouvelle_invitation");
      }
    } catch (err) {
      console.error("Erreur invitation :", err);
    }
  });

  // Accepter ou refuser une invitation
  socket.on("repondre_invitation", async (data) => {
    const groupeId = parseInt(data.groupeId, 10);
    const accepter = data.accepter === true;

    if (!groupeId) return;

    try {
      const invitation = await pool.query(
        "SELECT 1 FROM invitations_groupe WHERE groupe_id = $1 AND invite = $2",
        [groupeId, monPseudo]
      );
      if (invitation.rows.length === 0) return;

      if (accepter) {
        await pool.query(
          `INSERT INTO membres_groupe (groupe_id, pseudo) VALUES ($1, $2)
           ON CONFLICT (groupe_id, pseudo) DO NOTHING`,
          [groupeId, monPseudo]
        );
      }

      await pool.query(
        "DELETE FROM invitations_groupe WHERE groupe_id = $1 AND invite = $2",
        [groupeId, monPseudo]
      );

      envoyerMesGroupes();
    } catch (err) {
      console.error("Erreur réponse invitation :", err);
    }
  });

  // Historique des messages d'un groupe
  socket.on("demander_historique_groupe", async (data) => {
    const groupeId = parseInt(data.groupeId, 10);
    if (!groupeId) return;

    try {
      if (!(await estMembre(groupeId, monPseudo))) return;

      const resultat = await pool.query(
        "SELECT id, auteur, texte, image_url, date FROM messages_groupe WHERE groupe_id = $1 ORDER BY id DESC LIMIT 100",
        [groupeId]
      );

      const membres = await pool.query(
        "SELECT pseudo FROM membres_groupe WHERE groupe_id = $1 ORDER BY pseudo",
        [groupeId]
      );

      socket.emit("historique_groupe", {
        groupeId,
        messages: resultat.rows.reverse(),
        membres: membres.rows.map(m => m.pseudo)
      });
    } catch (err) {
      console.error("Erreur historique groupe :", err);
    }
  });

  // Envoyer un message dans un groupe
  socket.on("message_groupe", async (data) => {
    const groupeId = parseInt(data.groupeId, 10);
    const texte = (data.texte || "").trim();
    const imageUrl = data.imageUrl || null;

    if (!groupeId || (!texte && !imageUrl)) return;

    try {
      if (!(await estMembre(groupeId, monPseudo))) {
        socket.emit("erreur_envoi", { message: "Ce groupe n'est pas encore validé." });
        return;
      }

      const resultat = await pool.query(
        `INSERT INTO messages_groupe (groupe_id, auteur, texte, image_url)
         VALUES ($1, $2, $3, $4) RETURNING id, auteur, texte, image_url, date`,
        [groupeId, monPseudo, texte || null, imageUrl]
      );

      const message = resultat.rows[0];

      // Envoie uniquement aux membres connectés
      const membres = await pool.query(
        "SELECT pseudo FROM membres_groupe WHERE groupe_id = $1",
        [groupeId]
      );

      membres.rows.forEach(m => {
        const s = socketsParPseudo[m.pseudo];
        if (s) io.to(s).emit("message_groupe", { groupeId, message });
      });
    } catch (err) {
      console.error("Erreur message groupe :", err);
    }
  });

  // Quitter un groupe
  socket.on("quitter_groupe", async (data) => {
    const groupeId = parseInt(data.groupeId, 10);
    if (!groupeId) return;

    try {
      await pool.query(
        "DELETE FROM membres_groupe WHERE groupe_id = $1 AND pseudo = $2",
        [groupeId, monPseudo]
      );

      // Si le groupe n'a plus de membres, on le supprime
      const restants = await pool.query(
        "SELECT COUNT(*)::int AS n FROM membres_groupe WHERE groupe_id = $1",
        [groupeId]
      );

      if (restants.rows[0].n === 0) {
        await pool.query("DELETE FROM groupes WHERE id = $1", [groupeId]);
      }

      envoyerMesGroupes();
    } catch (err) {
      console.error("Erreur quitter groupe :", err);
    }
  });

  // ---------- FORUM (Radio 2) ----------

  // Charge la liste des publications avec leur score et nombre de commentaires
  socket.on("demander_publications", async (data) => {
    const salon = data.salon || "radio2";

    try {
      const resultat = await pool.query(`
        SELECT
          p.id, p.auteur, p.titre, p.contenu, p.image_url, p.date,
          COALESCE(SUM(v.valeur), 0)::int AS score,
          COALESCE(MAX(CASE WHEN v.pseudo = $2 THEN v.valeur END), 0)::int AS mon_vote,
          (SELECT COUNT(*) FROM commentaires c WHERE c.publication_id = p.id)::int AS nb_commentaires
        FROM publications p
        LEFT JOIN votes v ON v.publication_id = p.id
        WHERE p.salon = $1
        GROUP BY p.id
        ORDER BY p.id DESC
        LIMIT 50
      `, [salon, monPseudo]);

      socket.emit("liste_publications", { salon, publications: resultat.rows });
    } catch (err) {
      console.error("Erreur liste publications :", err);
    }
  });

  // Créer une nouvelle publication
  socket.on("creer_publication", async (data) => {
    const titre = (data.titre || "").trim();
    const contenu = (data.contenu || "").trim();
    const imageUrl = data.imageUrl || null;
    const salon = data.salon || "radio2";

    if (!titre) {
      socket.emit("erreur_envoi", { message: "Le titre est obligatoire." });
      return;
    }

    if (titre.length > 200) {
      socket.emit("erreur_envoi", { message: "Titre trop long (200 caractères maximum)." });
      return;
    }

    try {
      const resultat = await pool.query(
        `INSERT INTO publications (salon, auteur, titre, contenu, image_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, auteur, titre, contenu, image_url, date`,
        [salon, monPseudo, titre, contenu || null, imageUrl]
      );

      const publication = resultat.rows[0];
      publication.score = 0;
      publication.mon_vote = 0;
      publication.nb_commentaires = 0;

      io.emit("nouvelle_publication", { salon, publication });
    } catch (err) {
      console.error("Erreur création publication :", err);
    }
  });

  // Voter (1 = up, -1 = down, 0 = annuler)
  socket.on("voter", async (data) => {
    const publicationId = parseInt(data.publicationId, 10);
    const valeur = parseInt(data.valeur, 10);

    if (![1, -1, 0].includes(valeur) || !publicationId) return;

    try {
      if (valeur === 0) {
        await pool.query(
          "DELETE FROM votes WHERE publication_id = $1 AND pseudo = $2",
          [publicationId, monPseudo]
        );
      } else {
        await pool.query(
          `INSERT INTO votes (publication_id, pseudo, valeur)
           VALUES ($1, $2, $3)
           ON CONFLICT (publication_id, pseudo)
           DO UPDATE SET valeur = EXCLUDED.valeur`,
          [publicationId, monPseudo, valeur]
        );
      }

      const scoreResultat = await pool.query(
        "SELECT COALESCE(SUM(valeur), 0)::int AS score FROM votes WHERE publication_id = $1",
        [publicationId]
      );

      io.emit("score_maj", {
        publicationId,
        score: scoreResultat.rows[0].score
      });
    } catch (err) {
      console.error("Erreur vote :", err);
    }
  });

  // Charger les commentaires d'une publication
  socket.on("demander_commentaires", async (data) => {
    const publicationId = parseInt(data.publicationId, 10);
    if (!publicationId) return;

    try {
      const resultat = await pool.query(
        "SELECT id, auteur, texte, date FROM commentaires WHERE publication_id = $1 ORDER BY id ASC",
        [publicationId]
      );
      socket.emit("liste_commentaires", { publicationId, commentaires: resultat.rows });
    } catch (err) {
      console.error("Erreur commentaires :", err);
    }
  });

  // Ajouter un commentaire
  socket.on("ajouter_commentaire", async (data) => {
    const publicationId = parseInt(data.publicationId, 10);
    const texte = (data.texte || "").trim();

    if (!publicationId || !texte) return;

    try {
      const resultat = await pool.query(
        `INSERT INTO commentaires (publication_id, auteur, texte)
         VALUES ($1, $2, $3) RETURNING id, auteur, texte, date`,
        [publicationId, monPseudo, texte]
      );

      io.emit("nouveau_commentaire", {
        publicationId,
        commentaire: resultat.rows[0]
      });
    } catch (err) {
      console.error("Erreur ajout commentaire :", err);
    }
  });

  // ---------- Indicateur "est en train d'écrire" ----------

  socket.on("frappe", (data) => {
    const info = {
      pseudo: monPseudo,
      contexte: data.contexte,   // "salon", "prive" ou "groupe"
      id: data.id,
      actif: data.actif === true
    };

    if (data.contexte === "prive") {
      // Uniquement au destinataire
      const cible = socketsParPseudo[data.id];
      if (cible) io.to(cible).emit("frappe", { ...info, id: monPseudo });
    } else if (data.contexte === "groupe") {
      pool.query("SELECT pseudo FROM membres_groupe WHERE groupe_id = $1", [data.id])
        .then(r => {
          r.rows.forEach(m => {
            if (m.pseudo === monPseudo) return;
            const s = socketsParPseudo[m.pseudo];
            if (s) io.to(s).emit("frappe", info);
          });
        })
        .catch(err => console.error("Erreur frappe groupe :", err));
    } else {
      socket.broadcast.emit("frappe", info);
    }
  });

  socket.on("disconnect", () => {
    console.log(`${monPseudo} s'est déconnecté`);
    delete socketsParPseudo[monPseudo];
    diffuserPresence();
  });
});

// ---------- DÉMARRAGE ----------

// Supprime les groupes en attente depuis plus de 7 jours
async function nettoyerGroupesExpires() {
  try {
    const resultat = await pool.query(`
      DELETE FROM groupes
      WHERE statut = 'en_attente' AND cree_le < NOW() - INTERVAL '7 days'
      RETURNING id, titre
    `);

    if (resultat.rows.length > 0) {
      console.log(`${resultat.rows.length} groupe(s) expiré(s) supprimé(s).`);
      resultat.rows.forEach(g => io.emit("groupe_supprime", { id: g.id }));
    }
  } catch (err) {
    console.error("Erreur nettoyage groupes :", err);
  }
}

// Vérification au démarrage puis toutes les 6 heures
setInterval(nettoyerGroupesExpires, 6 * 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;

initialiserBase()
  .then(() => {
    nettoyerGroupesExpires();
    server.listen(PORT, () => {
      console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("Impossible d'initialiser la base de données :", err);
    process.exit(1);
  });