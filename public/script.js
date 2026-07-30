// script.js - logique côté client (dans le navigateur)

const socket = io(); // connexion automatique au serveur

let monPseudo = "";

const pseudoForm = document.getElementById("pseudo-form");
const pseudoInput = document.getElementById("pseudo-input");
const pseudoBtn = document.getElementById("pseudo-btn");

const chatBox = document.getElementById("chat-box");
const messagesDiv = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");

// Étape 1 : choisir son pseudo
pseudoBtn.addEventListener("click", () => {
  const valeur = pseudoInput.value.trim();
  if (valeur === "") return; // on ignore si vide

  monPseudo = valeur;
  pseudoForm.style.display = "none";
  chatBox.style.display = "flex";
});

// Étape 2 : envoyer un message
messageForm.addEventListener("submit", (event) => {
  event.preventDefault(); // empêche la page de se recharger
  const texte = messageInput.value.trim();
  if (texte === "") return;

  // On envoie le message au serveur
  socket.emit("message", {
    auteur: monPseudo,
    texte: texte
  });

  messageInput.value = "";
});

// Étape 3 : recevoir un message (envoyé par n'importe qui, y compris soi-même)
socket.on("message", (data) => {
  const messageEl = document.createElement("div");
  messageEl.classList.add("message");

  // Si c'est moi qui ai envoyé le message, style différent
  if (data.auteur === monPseudo) {
    messageEl.classList.add("mine");
  } else {
    messageEl.classList.add("other");
  }

  messageEl.innerHTML = `<span class="auteur">${data.auteur}</span>${data.texte}`;
  messagesDiv.appendChild(messageEl);

  // Défilement automatique vers le bas
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});