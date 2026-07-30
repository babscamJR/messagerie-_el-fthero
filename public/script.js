// script.js - logique côté client (dans le navigateur)

let monPseudo = "";

const messagesDiv = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const deconnexionBtn = document.getElementById("deconnexion-btn");

async function verifierConnexion() {
  const reponse = await fetch("/moi");
  const data = await reponse.json();

  if (!data.connecte) {
    // Pas connecté -> redirection vers la page de connexion
    window.location.href = "/connexion.html";
    return;
  }

  monPseudo = data.pseudo;
  demarrerChat();
}

function demarrerChat() {
  const socket = io();

  messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const texte = messageInput.value.trim();
    if (texte === "") return;

    socket.emit("message", { texte });
    messageInput.value = "";
  });

  socket.on("message", (data) => {
    const messageEl = document.createElement("div");
    messageEl.classList.add("message");
    messageEl.classList.add(data.auteur === monPseudo ? "mine" : "other");
    messageEl.innerHTML = `<span class="auteur">${data.auteur}</span>${data.texte}`;
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

deconnexionBtn.addEventListener("click", async () => {
  await fetch("/deconnexion", { method: "POST" });
  window.location.href = "/connexion.html";
});

verifierConnexion();