// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const USERS_FILE = path.join(__dirname, "users.json");

function chargerUtilisateurs() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]");
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}

function sauvegarderUtilisateurs(utilisateurs) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(utilisateurs, null, 2));
}

// Donne toujours le même identifiant pour une conversation privée entre 2 pseudos,
// peu importe qui a démarré la conversation (ordre alphabétique)
function idConversation(pseudoA, pseudoB) {
  return [pseudoA, pseudoB].sort().join("|");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: "change-cette-phrase-secrete-plus-tard",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
});
app.use(sessionMiddleware);

app.use(express.static("public"));

// ---------- ROUTES D'AUTHENTIFICATION ----------

app.post("/inscription", (req, res) => {
  const { pseudo, motdepasse } = req.body;

  if (!pseudo || !motdepasse) {
    return res.status(400).json({ erreur: "Pseudo et mot de passe requis." });
  }

  const utilisateurs = chargerUtilisateurs();

  const dejaExistant = utilisateurs.find(u => u.pseudo.toLowerCase() === pseudo.toLowerCase());
  if (dejaExistant) {
    return res.status(400).json({ erreur: "Ce pseudo est déjà pris." });
  }

  const motdepasseCrypte = bcrypt.hashSync(motdepasse, 10);
  utilisateurs.push({ pseudo, motdepasse: motdepasseCrypte });
  sauvegarderUtilisateurs(utilisateurs);

  req.session.pseudo = pseudo;
  res.json({ succes: true });
});

app.post("/connexion", (req, res) => {
  const { pseudo, motdepasse } = req.body;
  const utilisateurs = chargerUtilisateurs();

  const utilisateur = utilisateurs.find(u => u.pseudo.toLowerCase() === pseudo.toLowerCase());
  if (!utilisateur) {
    return res.status(400).json({ erreur: "Pseudo ou mot de passe incorrect." });
  }

  const motdepasseValide = bcrypt.compareSync(motdepasse, utilisateur.motdepasse);
  if (!motdepasseValide) {
    return res.status(400).json({ erreur: "Pseudo ou mot de passe incorrect." });
  }

  req.session.pseudo = utilisateur.pseudo;
  res.json({ succes: true });
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

// Liste de tous les comptes inscrits (pour choisir avec qui discuter en privé)
app.get("/utilisateurs", (req, res) => {
  if (!req.session.pseudo) {
    return res.status(401).json({ erreur: "Non connecté." });
  }
  const utilisateurs = chargerUtilisateurs();
  const pseudos = utilisateurs
    .map(u => u.pseudo)
    .filter(p => p !== req.session.pseudo); // on s'exclut soi-même
  res.json({ utilisateurs: pseudos });
});

// ---------- SOCKET.IO (chat en temps réel) ----------

io.engine.use(sessionMiddleware);

// Messages stockés en mémoire (perdus si le serveur redémarre)
const messagesPublics = [];      // { auteur, texte, date }
const messagesPrives = {};        // { "pseudoA|pseudoB": [ { auteur, texte, date } ] }

// Associe chaque pseudo connecté à son socket (pour lui envoyer un message privé)
const socketsParPseudo = {};

io.on("connection", (socket) => {
  const session = socket.request.session;

  if (!session || !session.pseudo) {
    socket.disconnect();
    return;
  }

  const monPseudo = session.pseudo;
  socketsParPseudo[monPseudo] = socket.id;

  console.log(`${monPseudo} s'est connecté`);

  // Envoie l'historique du salon public à la connexion
  socket.emit("historique_public", messagesPublics);

  // --- Salon public "Radio 1" ---
  socket.on("message_public", (data) => {
    const message = {
      auteur: monPseudo,
      texte: data.texte,
      date: new Date().toISOString()
    };
    messagesPublics.push(message);
    io.emit("message_public", message);
  });

  // --- Messages privés ---
  socket.on("demander_historique_prive", (data) => {
    const conversationId = idConversation(monPseudo, data.destinataire);
    const historique = messagesPrives[conversationId] || [];
    socket.emit("historique_prive", {
      avec: data.destinataire,
      messages: historique
    });
  });

  socket.on("message_prive", (data) => {
    const conversationId = idConversation(monPseudo, data.destinataire);

    const message = {
      auteur: monPseudo,
      texte: data.texte,
      date: new Date().toISOString()
    };

    if (!messagesPrives[conversationId]) {
      messagesPrives[conversationId] = [];
    }
    messagesPrives[conversationId].push(message);

    // Envoie au destinataire (s'il est connecté)
    const socketDestinataire = socketsParPseudo[data.destinataire];
    if (socketDestinataire) {
      io.to(socketDestinataire).emit("message_prive", {
        avec: monPseudo,
        message
      });
    }

    // Renvoie aussi à l'expéditeur (pour afficher son propre message)
    socket.emit("message_prive", {
      avec: data.destinataire,
      message
    });
  });

  socket.on("disconnect", () => {
    console.log(`${monPseudo} s'est déconnecté`);
    delete socketsParPseudo[monPseudo];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});