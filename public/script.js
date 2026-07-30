// script.js - logique côté client

let monPseudo = "";
let socket = null;

// "public" ou le pseudo de la personne avec qui on discute en privé
let conversationActuelle = "public";

const messagesDiv = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const deconnexionBtn = document.getElementById("deconnexion-btn");
const listeUtilisateursDiv = document.getElementById("liste-utilisateurs");
const btnRadio1 = document.getElementById("btn-radio1");
const titreConversation = document.getElementById("titre-conversation");
const appContainer = document.querySelector(".app-container");
const retourBtn = document.getElementById("retour-btn");

// Stocke les messages déjà reçus pour chaque conversation, pour ne pas les recharger à chaque clic
const cacheMessages = {
  public: []
};

async function verifierConnexion() {
  const reponse = await fetch("/moi");
  const data = await reponse.json();

  if (!data.connecte) {
    window.location.href = "/connexion.html";
    return;
  }

  monPseudo = data.pseudo;
  demarrerChat();
  chargerListeUtilisateurs();
}

async function chargerListeUtilisateurs() {
  const reponse = await fetch("/utilisateurs");
  const data = await reponse.json();

  listeUtilisateursDiv.innerHTML = "";
  data.utilisateurs.forEach(pseudo => {
    const item = document.createElement("div");
    item.classList.add("salon-item");
    item.textContent = "👤 " + pseudo;
    item.dataset.pseudo = pseudo;
    item.addEventListener("click", () => ouvrirConversationPrivee(pseudo));
    listeUtilisateursDiv.appendChild(item);
  });
}

function marquerActif(element) {
  document.querySelectorAll(".salon-item").forEach(el => el.classList.remove("actif"));
  element.classList.add("actif");
}

function ouvrirConversationPublique() {
  conversationActuelle = "public";
  titreConversation.textContent = "📻 Radio 1";
  marquerActif(btnRadio1);
  afficherMessages(cacheMessages.public);
  appContainer.classList.add("mobile-vue-chat");
}

function ouvrirConversationPrivee(pseudo) {
  conversationActuelle = pseudo;
  titreConversation.textContent = "👤 " + pseudo;

  const item = [...document.querySelectorAll("#liste-utilisateurs .salon-item")]
    .find(el => el.dataset.pseudo === pseudo);
  if (item) marquerActif(item);

  appContainer.classList.add("mobile-vue-chat");

  if (cacheMessages[pseudo]) {
    afficherMessages(cacheMessages[pseudo]);
  } else {
    messagesDiv.innerHTML = "";
    socket.emit("demander_historique_prive", { destinataire: pseudo });
  }
}

function afficherMessages(liste) {
  messagesDiv.innerHTML = "";
  liste.forEach(ajouterMessageAffiche);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function ajouterMessageAffiche(data, anime = false) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("message");
  messageEl.classList.add(data.auteur === monPseudo ? "mine" : "other");
  if (anime) messageEl.classList.add("message-entree");
  messageEl.innerHTML = `<span class="auteur">${data.auteur}</span>${data.texte}`;
  messagesDiv.appendChild(messageEl);
}

function demarrerChat() {
  socket = io();

  btnRadio1.addEventListener("click", ouvrirConversationPublique);
  retourBtn.addEventListener("click", () => {
    appContainer.classList.remove("mobile-vue-chat");
  });

  const boutonEnvoyer = messageForm.querySelector("button");

  messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const texte = messageInput.value.trim();
    if (texte === "") return;

    if (conversationActuelle === "public") {
      socket.emit("message_public", { texte });
    } else {
      socket.emit("message_prive", { destinataire: conversationActuelle, texte });
    }

    messageInput.value = "";

    if (boutonEnvoyer) {
      boutonEnvoyer.classList.remove("envoi-anim");
      void boutonEnvoyer.offsetWidth;
      boutonEnvoyer.classList.add("envoi-anim");
      setTimeout(() => boutonEnvoyer.classList.remove("envoi-anim"), 150);
    }
  });

  // Historique du salon public à la connexion
  socket.on("historique_public", (messages) => {
    cacheMessages.public = messages;
    if (conversationActuelle === "public") {
      afficherMessages(messages);
    }
  });

  // Nouveau message dans le salon public
  socket.on("message_public", (message) => {
    cacheMessages.public.push(message);
    if (conversationActuelle === "public") {
      ajouterMessageAffiche(message, true);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  });

  // Historique reçu pour une conversation privée
  socket.on("historique_prive", (data) => {
    cacheMessages[data.avec] = data.messages;
    if (conversationActuelle === data.avec) {
      afficherMessages(data.messages);
    }
  });

  // Nouveau message privé reçu
  socket.on("message_prive", (data) => {
    if (!cacheMessages[data.avec]) {
      cacheMessages[data.avec] = [];
    }
    cacheMessages[data.avec].push(data.message);

    if (conversationActuelle === data.avec) {
      ajouterMessageAffiche(data.message, true);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  });
}

deconnexionBtn.addEventListener("click", async () => {
  await fetch("/deconnexion", { method: "POST" });
  window.location.href = "/connexion.html";
});

verifierConnexion();