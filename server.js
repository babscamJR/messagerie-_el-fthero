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

// Charge les utilisateurs depuis le fichier (ou crée une liste vide)
function chargerUtilisateurs() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]");
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}

function sauvegarderUtilisateurs(utilisateurs) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(utilisateurs, null, 2));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gestion des sessions (garde l'utilisateur connecté)
const sessionMiddleware = session({
  secret: "change-cette-phrase-secrete-plus-tard",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24h
});
app.use(sessionMiddleware);

app.use(express.static("public"));

// ---------- ROUTES D'AUTHENTIFICATION ----------

// Inscription
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

// Connexion
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

// Déconnexion
app.post("/deconnexion", (req, res) => {
  req.session.destroy(() => {
    res.json({ succes: true });
  });
});

// Vérifier si connecté
app.get("/moi", (req, res) => {
  if (req.session.pseudo) {
    res.json({ connecte: true, pseudo: req.session.pseudo });
  } else {
    res.json({ connecte: false });
  }
});

// ---------- SOCKET.IO (chat en temps réel) ----------

// Permet à Socket.IO d'accéder aux sessions
io.engine.use(sessionMiddleware);

io.on("connection", (socket) => {
  const session = socket.request.session;

  // Refuse la connexion si pas de compte connecté
  if (!session || !session.pseudo) {
    socket.disconnect();
    return;
  }

  console.log(`${session.pseudo} s'est connecté au chat`);

  socket.on("message", (data) => {
    io.emit("message", {
      auteur: session.pseudo,
      texte: data.texte
    });
  });

  socket.on("disconnect", () => {
    console.log(`${session.pseudo} s'est déconnecté`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});