// server.js
// Le serveur : reçoit les messages d'un utilisateur et les renvoie à tout le monde

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sert les fichiers du dossier "public" (HTML, CSS, JS du client)
app.use(express.static("public"));

// Quand un nouvel utilisateur se connecte
io.on("connection", (socket) => {
  console.log("Un utilisateur s'est connecté :", socket.id);

  // Quand ce client envoie un message
  socket.on("message", (data) => {
    console.log("Message reçu :", data);

    // On renvoie le message à TOUS les clients connectés (y compris l'expéditeur)
    io.emit("message", data);
  });

  // Quand un utilisateur se déconnecte
  socket.on("disconnect", () => {
    console.log("Utilisateur déconnecté :", socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});