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
const inputFichier = document.getElementById("input-fichier");
const btnImage = document.getElementById("btn-image");
const apercuImage = document.getElementById("apercu-image");
const apercuImg = document.getElementById("apercu-img");
const annulerImage = document.getElementById("annuler-image");
const btnEnvoyer = document.getElementById("btn-envoyer");

// Fichier image sélectionné, en attente d'envoi
let fichierSelectionne = null;

// Statut administrateur
let jeSuisAdmin = false;

const titreApp = document.getElementById("titre-app");
const adminBtn = document.getElementById("admin-btn");
const modalCle = document.getElementById("modal-cle");
const inputCle = document.getElementById("input-cle");
const erreurCle = document.getElementById("erreur-cle");
const validerCle = document.getElementById("valider-cle");
const fermerCle = document.getElementById("fermer-cle");
const modalAdmin = document.getElementById("modal-admin");
const listeAdmin = document.getElementById("liste-admin");
const fermerAdmin = document.getElementById("fermer-admin");

// Compte les clics rapides sur le titre pour ouvrir le menu caché
let compteurClics = 0;
let minuteurClics = null;

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
  jeSuisAdmin = data.isAdmin === true;

  if (jeSuisAdmin) {
    adminBtn.classList.remove("cache");
  }

  demarrerChat();
  chargerListeUtilisateurs();
}

// ---------- MODÉRATION ----------

// 5 clics rapides sur le titre ouvrent la saisie de clé
titreApp.addEventListener("click", () => {
  if (jeSuisAdmin) return; // déjà admin, inutile

  compteurClics++;
  clearTimeout(minuteurClics);
  minuteurClics = setTimeout(() => { compteurClics = 0; }, 1500);

  if (compteurClics >= 5) {
    compteurClics = 0;
    erreurCle.textContent = "";
    inputCle.value = "";
    modalCle.classList.remove("cache");
    inputCle.focus();
  }
});

fermerCle.addEventListener("click", () => modalCle.classList.add("cache"));

validerCle.addEventListener("click", async () => {
  const cle = inputCle.value;
  if (!cle) return;

  const reponse = await fetch("/devenir-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cle })
  });

  const data = await reponse.json();

  if (data.succes) {
    jeSuisAdmin = true;
    adminBtn.classList.remove("cache");
    modalCle.classList.add("cache");
    alert("Vous êtes maintenant administrateur.");
  } else {
    erreurCle.textContent = data.erreur || "Erreur.";
  }
});

inputCle.addEventListener("keydown", (e) => {
  if (e.key === "Enter") validerCle.click();
});

adminBtn.addEventListener("click", ouvrirPanneauAdmin);
fermerAdmin.addEventListener("click", () => modalAdmin.classList.add("cache"));

async function ouvrirPanneauAdmin() {
  modalAdmin.classList.remove("cache");
  listeAdmin.innerHTML = "<p>Chargement...</p>";

  try {
    const reponse = await fetch("/admin/utilisateurs");
    const data = await reponse.json();

    if (!data.utilisateurs) {
      listeAdmin.innerHTML = "<p>Erreur de chargement.</p>";
      return;
    }

    listeAdmin.innerHTML = "";
    data.utilisateurs.forEach(u => {
      const ligne = document.createElement("div");
      ligne.classList.add("ligne-admin");

      const infos = document.createElement("div");
      let badge = "";
      if (u.is_admin) badge = ' <span class="badge admin">admin</span>';
      else if (u.is_banni) badge = ' <span class="badge banni">banni</span>';
      infos.innerHTML = `<strong>${u.pseudo}</strong>${badge}`;
      ligne.appendChild(infos);

      // Pas de bouton pour soi-même ni pour les autres admins
      if (u.pseudo !== monPseudo && !u.is_admin) {
        const bouton = document.createElement("button");
        bouton.textContent = u.is_banni ? "Débannir" : "Bannir";
        bouton.classList.add(u.is_banni ? "secondaire" : "danger");
        bouton.addEventListener("click", () => basculerBannissement(u.pseudo, !u.is_banni));
        ligne.appendChild(bouton);
      }

      listeAdmin.appendChild(ligne);
    });
  } catch (err) {
    listeAdmin.innerHTML = "<p>Erreur de chargement.</p>";
  }
}

async function basculerBannissement(pseudo, bannir) {
  const action = bannir ? "bannir" : "débannir";
  if (!confirm(`Voulez-vous vraiment ${action} ${pseudo} ?`)) return;

  const reponse = await fetch("/admin/bannir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pseudo, bannir })
  });

  const data = await reponse.json();

  if (data.succes) {
    ouvrirPanneauAdmin(); // recharge la liste
    chargerListeUtilisateurs();
  } else {
    alert(data.erreur || "Erreur.");
  }
}

async function supprimerMessage(id, type) {
  if (!confirm("Supprimer ce message ?")) return;

  const reponse = await fetch("/admin/supprimer-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, type })
  });

  const data = await reponse.json();
  if (!data.succes) {
    alert(data.erreur || "Erreur.");
  }
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

function ajouterMessageAffiche(data) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("message");
  messageEl.classList.add(data.auteur === monPseudo ? "mine" : "other");

  // Nom de l'auteur
  const auteurEl = document.createElement("span");
  auteurEl.classList.add("auteur");
  auteurEl.textContent = data.auteur;
  messageEl.appendChild(auteurEl);

  // Image éventuelle
  if (data.image_url) {
    const img = document.createElement("img");
    img.src = data.image_url;
    img.classList.add("message-image");
    img.addEventListener("click", () => window.open(data.image_url, "_blank"));
    messageEl.appendChild(img);
  }

  // Texte éventuel (textContent évite les injections de code)
  if (data.texte) {
    const texteEl = document.createElement("div");
    texteEl.textContent = data.texte;
    messageEl.appendChild(texteEl);
  }

  // Bouton de suppression visible uniquement pour les admins
  if (jeSuisAdmin && data.id) {
    const btnSuppr = document.createElement("button");
    btnSuppr.classList.add("btn-supprimer");
    btnSuppr.textContent = "🗑";
    btnSuppr.title = "Supprimer ce message";
    const type = conversationActuelle === "public" ? "public" : "prive";
    btnSuppr.addEventListener("click", () => supprimerMessage(data.id, type));
    messageEl.appendChild(btnSuppr);
  }

  if (data.id) {
    messageEl.dataset.messageId = data.id;
  }

  messagesDiv.appendChild(messageEl);
}

// ---------- Gestion des images ----------

function reinitialiserImage() {
  fichierSelectionne = null;
  inputFichier.value = "";
  apercuImage.classList.add("apercu-cache");
  apercuImg.src = "";
}

btnImage.addEventListener("click", () => inputFichier.click());

inputFichier.addEventListener("change", () => {
  const fichier = inputFichier.files[0];
  if (!fichier) return;

  if (!fichier.type.startsWith("image/")) {
    alert("Seules les images sont autorisées.");
    reinitialiserImage();
    return;
  }

  if (fichier.size > 5 * 1024 * 1024) {
    alert("Image trop lourde (5 Mo maximum).");
    reinitialiserImage();
    return;
  }

  fichierSelectionne = fichier;
  apercuImg.src = URL.createObjectURL(fichier);
  apercuImage.classList.remove("apercu-cache");
});

annulerImage.addEventListener("click", reinitialiserImage);

// Envoie l'image à Cloudinary via notre serveur, et récupère son URL
async function envoyerImage(fichier) {
  const formData = new FormData();
  formData.append("image", fichier);

  const reponse = await fetch("/upload-image", {
    method: "POST",
    body: formData
  });

  const data = await reponse.json();
  if (!data.succes) {
    throw new Error(data.erreur || "Erreur lors de l'envoi.");
  }
  return data.url;
}

function demarrerChat() {
  socket = io();

  btnRadio1.addEventListener("click", ouvrirConversationPublique);
  retourBtn.addEventListener("click", () => {
    appContainer.classList.remove("mobile-vue-chat");
  });

  messageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const texte = messageInput.value.trim();

    // Il faut au moins un texte ou une image
    if (texte === "" && !fichierSelectionne) return;

    let imageUrl = null;

    // S'il y a une image, on l'envoie d'abord et on attend son URL
    if (fichierSelectionne) {
      btnEnvoyer.disabled = true;
      btnEnvoyer.textContent = "Envoi...";

      try {
        imageUrl = await envoyerImage(fichierSelectionne);
      } catch (err) {
        alert(err.message);
        btnEnvoyer.disabled = false;
        btnEnvoyer.textContent = "Envoyer";
        return;
      }

      btnEnvoyer.disabled = false;
      btnEnvoyer.textContent = "Envoyer";
    }

    if (conversationActuelle === "public") {
      socket.emit("message_public", { texte, imageUrl });
    } else {
      socket.emit("message_prive", { destinataire: conversationActuelle, texte, imageUrl });
    }

    messageInput.value = "";
    reinitialiserImage();
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
      ajouterMessageAffiche(message);
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

  // Un message a été supprimé par un admin
  socket.on("message_supprime", (data) => {
    const el = messagesDiv.querySelector(`[data-message-id="${data.id}"]`);
    if (el) el.remove();

    // Retire aussi du cache
    Object.keys(cacheMessages).forEach(cle => {
      cacheMessages[cle] = cacheMessages[cle].filter(m => m.id !== data.id);
    });
  });

  // On vient d'être banni
  socket.on("banni", () => {
    alert("Votre compte a été banni.");
    window.location.href = "/connexion.html";
  });

  // Nouveau message privé reçu
  socket.on("message_prive", (data) => {
    if (!cacheMessages[data.avec]) {
      cacheMessages[data.avec] = [];
    }
    cacheMessages[data.avec].push(data.message);

    if (conversationActuelle === data.avec) {
      ajouterMessageAffiche(data.message);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  });
}

deconnexionBtn.addEventListener("click", async () => {
  await fetch("/deconnexion", { method: "POST" });
  window.location.href = "/connexion.html";
});

verifierConnexion();