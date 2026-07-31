// script.js - logique côté client

let monPseudo = "";
let socket = null;

// Conversation active : { type: "salon", id: "radio1" } ou { type: "prive", id: "pseudo" }
let conversationActuelle = { type: "salon", id: "radio1" };

// Liste des salons reçue du serveur
let salonsDisponibles = {};

const messagesDiv = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const deconnexionBtn = document.getElementById("deconnexion-btn");
const listeUtilisateursDiv = document.getElementById("liste-utilisateurs");
const listeSalonsDiv = document.getElementById("liste-salons");

// Forum
const forumBox = document.getElementById("forum-box");
const chatBox = document.getElementById("chat-box");
const listePublications = document.getElementById("liste-publications");
const btnNouvellePub = document.getElementById("btn-nouvelle-pub");
const modalPublication = document.getElementById("modal-publication");
const pubTitre = document.getElementById("pub-titre");
const pubContenu = document.getElementById("pub-contenu");
const pubImage = document.getElementById("pub-image");
const pubBtnImage = document.getElementById("pub-btn-image");
const pubApercu = document.getElementById("pub-apercu");
const pubApercuImg = document.getElementById("pub-apercu-img");
const pubAnnulerImage = document.getElementById("pub-annuler-image");
const pubErreur = document.getElementById("pub-erreur");
const pubPublier = document.getElementById("pub-publier");
const pubFermer = document.getElementById("pub-fermer");
const modalDetail = document.getElementById("modal-detail");
const detailContenu = document.getElementById("detail-contenu");
const detailCommentaires = document.getElementById("detail-commentaires");
const inputCommentaire = document.getElementById("input-commentaire");
const envoyerCommentaire = document.getElementById("envoyer-commentaire");
const detailFermer = document.getElementById("detail-fermer");

let publicationOuverte = null;
let publicationsCache = [];
let pubFichierSelectionne = null;
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
const cacheMessages = {};

// Construit une clé de cache unique par conversation
function cleCache(conv) {
  return conv.type + ":" + conv.id;
}

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
    construireListeSalons();   // retire les cadenas
    mettreAJourZoneSaisie();    // débloque la saisie
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

function construireListeSalons() {
  listeSalonsDiv.innerHTML = "";

  Object.keys(salonsDisponibles).forEach(id => {
    const salon = salonsDisponibles[id];
    const item = document.createElement("div");
    item.classList.add("salon-item");
    item.dataset.salonId = id;
    item.textContent = salon.nom;

    // Petit cadenas sur les salons en lecture seule pour les non-admins
    if (salon.adminSeul && !jeSuisAdmin) {
      const cadenas = document.createElement("span");
      cadenas.classList.add("cadenas");
      cadenas.textContent = "🔒";
      cadenas.title = "Lecture seule";
      item.appendChild(cadenas);
    }

    item.addEventListener("click", () => ouvrirSalon(id));
    listeSalonsDiv.appendChild(item);
  });

  // Marque le salon actif
  if (conversationActuelle.type === "salon") {
    const actif = listeSalonsDiv.querySelector(`[data-salon-id="${conversationActuelle.id}"]`);
    if (actif) actif.classList.add("actif");
  }
}

function marquerActif(element) {
  document.querySelectorAll(".salon-item").forEach(el => el.classList.remove("actif"));
  element.classList.add("actif");
}

function ouvrirSalon(id) {
  if (!salonsDisponibles[id]) return;

  conversationActuelle = { type: "salon", id };
  titreConversation.textContent = salonsDisponibles[id].nom;

  const item = listeSalonsDiv.querySelector(`[data-salon-id="${id}"]`);
  if (item) marquerActif(item);

  appContainer.classList.add("mobile-vue-chat");

  const estForum = salonsDisponibles[id].type === "forum";

  if (estForum) {
    chatBox.classList.add("cache");
    forumBox.classList.remove("cache");
    listePublications.innerHTML = "<p class=\"info-vide\">Chargement...</p>";
    socket.emit("demander_publications", { salon: id });
  } else {
    forumBox.classList.add("cache");
    chatBox.classList.remove("cache");
    mettreAJourZoneSaisie();

    const cle = cleCache(conversationActuelle);
    if (cacheMessages[cle]) {
      afficherMessages(cacheMessages[cle]);
    } else {
      messagesDiv.innerHTML = "";
      socket.emit("demander_historique_salon", { salon: id });
    }
  }
}

// Désactive la zone de saisie si le salon est en lecture seule
function mettreAJourZoneSaisie() {
  const estSalon = conversationActuelle.type === "salon";
  const salon = estSalon ? salonsDisponibles[conversationActuelle.id] : null;
  const lectureSeule = salon && salon.adminSeul && !jeSuisAdmin;

  messageInput.disabled = lectureSeule;
  btnEnvoyer.disabled = lectureSeule;
  btnImage.disabled = lectureSeule;
  btnEmoji.disabled = lectureSeule;

  messageInput.placeholder = lectureSeule
    ? "Salon en lecture seule"
    : "Écris un message...";
}

function ouvrirConversationPrivee(pseudo) {
  conversationActuelle = { type: "prive", id: pseudo };
  titreConversation.textContent = "👤 " + pseudo;

  const item = [...document.querySelectorAll("#liste-utilisateurs .salon-item")]
    .find(el => el.dataset.pseudo === pseudo);
  if (item) marquerActif(item);

  appContainer.classList.add("mobile-vue-chat");
  forumBox.classList.add("cache");
  chatBox.classList.remove("cache");
  mettreAJourZoneSaisie();

  const cle = cleCache(conversationActuelle);
  if (cacheMessages[cle]) {
    afficherMessages(cacheMessages[cle]);
  } else {
    messagesDiv.innerHTML = "";
    socket.emit("demander_historique_prive", { destinataire: pseudo });
  }
}

function reinitialiserImagePub() {
  pubFichierSelectionne = null;
  pubImage.value = "";
  pubApercu.classList.add("cache");
  pubApercuImg.src = "";
}

// ---------- FORUM ----------

function afficherPublications(publications) {
  publicationsCache = publications;
  listePublications.innerHTML = "";

  if (publications.length === 0) {
    listePublications.innerHTML = "<p class=\"info-vide\">Aucune histoire pour le moment. Sois le premier !</p>";
    return;
  }

  publications.forEach(pub => listePublications.appendChild(creerCartePublication(pub)));
}

function creerCartePublication(pub) {
  const carte = document.createElement("div");
  carte.classList.add("publication");
  carte.dataset.pubId = pub.id;

  // Colonne de vote
  const votes = document.createElement("div");
  votes.classList.add("votes");

  const btnUp = document.createElement("button");
  btnUp.textContent = "▲";
  btnUp.classList.add("btn-vote");
  if (pub.mon_vote === 1) btnUp.classList.add("actif-up");
  btnUp.addEventListener("click", (e) => {
    e.stopPropagation();
    voter(pub.id, pub.mon_vote === 1 ? 0 : 1);
  });

  const scoreEl = document.createElement("div");
  scoreEl.classList.add("score");
  scoreEl.textContent = pub.score;

  const btnDown = document.createElement("button");
  btnDown.textContent = "▼";
  btnDown.classList.add("btn-vote");
  if (pub.mon_vote === -1) btnDown.classList.add("actif-down");
  btnDown.addEventListener("click", (e) => {
    e.stopPropagation();
    voter(pub.id, pub.mon_vote === -1 ? 0 : -1);
  });

  votes.append(btnUp, scoreEl, btnDown);

  // Contenu de la carte
  const corps = document.createElement("div");
  corps.classList.add("pub-corps");

  const titre = document.createElement("div");
  titre.classList.add("pub-titre");
  titre.textContent = pub.titre;

  const meta = document.createElement("div");
  meta.classList.add("pub-meta");
  meta.textContent = `par ${pub.auteur} · 💬 ${pub.nb_commentaires}`;

  corps.append(titre, meta);

  if (pub.image_url) {
    const vignette = document.createElement("img");
    vignette.src = pub.image_url;
    vignette.classList.add("pub-vignette");
    corps.appendChild(vignette);
  }

  carte.append(votes, corps);

  // Bouton de suppression pour les admins
  if (jeSuisAdmin) {
    const btnSuppr = document.createElement("button");
    btnSuppr.classList.add("btn-supprimer-pub");
    btnSuppr.textContent = "🗑";
    btnSuppr.addEventListener("click", (e) => {
      e.stopPropagation();
      supprimerPublication(pub.id);
    });
    carte.appendChild(btnSuppr);
  }

  corps.addEventListener("click", () => ouvrirDetail(pub.id));

  return carte;
}

function voter(publicationId, valeur) {
  const pub = publicationsCache.find(p => p.id === publicationId);
  if (pub) pub.mon_vote = valeur;
  socket.emit("voter", { publicationId, valeur });
}

async function supprimerPublication(id) {
  if (!confirm("Supprimer cette publication et tous ses commentaires ?")) return;

  const reponse = await fetch("/admin/supprimer-publication", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });

  const data = await reponse.json();
  if (!data.succes) alert(data.erreur || "Erreur.");
}

function ouvrirDetail(publicationId) {
  const pub = publicationsCache.find(p => p.id === publicationId);
  if (!pub) return;

  publicationOuverte = publicationId;
  modalDetail.classList.remove("cache");

  detailContenu.innerHTML = "";

  const titre = document.createElement("h2");
  titre.textContent = pub.titre;

  const meta = document.createElement("div");
  meta.classList.add("pub-meta");
  meta.textContent = "par " + pub.auteur;

  detailContenu.append(titre, meta);

  if (pub.image_url) {
    const img = document.createElement("img");
    img.src = pub.image_url;
    img.classList.add("detail-image");
    img.addEventListener("click", () => window.open(pub.image_url, "_blank"));
    detailContenu.appendChild(img);
  }

  if (pub.contenu) {
    const contenu = document.createElement("p");
    contenu.classList.add("detail-texte");
    contenu.textContent = pub.contenu;
    detailContenu.appendChild(contenu);
  }

  detailCommentaires.innerHTML = "<p class=\"info-vide\">Chargement des commentaires...</p>";
  socket.emit("demander_commentaires", { publicationId });
}

function afficherCommentaires(commentaires) {
  detailCommentaires.innerHTML = "";

  if (commentaires.length === 0) {
    detailCommentaires.innerHTML = "<p class=\"info-vide\">Aucun commentaire.</p>";
    return;
  }

  commentaires.forEach(c => detailCommentaires.appendChild(creerCommentaire(c)));
}

function creerCommentaire(c) {
  const el = document.createElement("div");
  el.classList.add("commentaire");
  el.dataset.commentaireId = c.id;

  const auteur = document.createElement("span");
  auteur.classList.add("auteur");
  auteur.textContent = c.auteur;

  const texte = document.createElement("div");
  texte.textContent = c.texte;

  el.append(auteur, texte);

  if (jeSuisAdmin) {
    const btnSuppr = document.createElement("button");
    btnSuppr.classList.add("btn-supprimer");
    btnSuppr.textContent = "🗑";
    btnSuppr.addEventListener("click", async () => {
      if (!confirm("Supprimer ce commentaire ?")) return;
      await fetch("/admin/supprimer-commentaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id })
      });
    });
    el.appendChild(btnSuppr);
  }

  return el;
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

    // Si le message ne contient que des emojis (max 3), on l'affiche en grand
    if (estUniquementEmojis(data.texte)) {
      texteEl.classList.add("emoji-seul");
    }

    messageEl.appendChild(texteEl);
  }

  // Bouton de suppression visible uniquement pour les admins
  if (jeSuisAdmin && data.id) {
    const btnSuppr = document.createElement("button");
    btnSuppr.classList.add("btn-supprimer");
    btnSuppr.textContent = "🗑";
    btnSuppr.title = "Supprimer ce message";
    const type = conversationActuelle.type === "salon" ? "public" : "prive";
    btnSuppr.addEventListener("click", () => supprimerMessage(data.id, type));
    messageEl.appendChild(btnSuppr);
  }

  if (data.id) {
    messageEl.dataset.messageId = data.id;
  }

  messagesDiv.appendChild(messageEl);
}

// Détecte si un texte ne contient que des emojis (3 maximum)
function estUniquementEmojis(texte) {
  const sansEspaces = texte.replace(/\s/g, "");
  if (!sansEspaces) return false;

  const regexEmoji = /^(\p{Extended_Pictographic}|\p{Emoji_Component})+$/u;
  if (!regexEmoji.test(sansEspaces)) return false;

  // Compte approximativement le nombre d'emojis
  const nombre = [...new Intl.Segmenter().segment(sansEspaces)].length;
  return nombre <= 3;
}

// ---------- Sélecteur d'emojis ----------

const EMOJIS = {
  "😀": ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤗","🤭","🤫","🤔","🤐","😐","😑","😶","😏","😒","🙄","😬","😔","😪","🤤","😴","😷","🤒","🤕","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","💀","💩","🤡","👻","👽","🤖"],
  "👍": ["👍","👎","👌","🤌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤝","🙏","✍️","💪","🦵","👏","🙌","👐","🤲","🫶","💅","👀","👁️","👅","👄","🧠","🦷"],
  "❤️": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","🔥","✨","⭐","🌟","💫","💥","💯","💢","💤","🎉","🎊","🎁","🎈","🏆","🥇","🥈","🥉"],
  "🐶": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐢","🐍","🐙","🦑","🦀","🐠","🐟","🐬","🐳","🦈","🐊","🐅","🦓","🦍","🐘","🦒","🐄","🐎","🐖","🐑","🦙"],
  "🍕": ["🍕","🍔","🍟","🌭","🥪","🌮","🌯","🥙","🧆","🥚","🍳","🥘","🍲","🥗","🍿","🧈","🍞","🥐","🥖","🥨","🧀","🥞","🧇","🥓","🍗","🍖","🍤","🍣","🍱","🍜","🍝","🍛","🍚","🍘","🍥","🥟","🍦","🍰","🎂","🧁","🍫","🍬","🍭","🍩","🍪","☕","🍵","🥤","🧃","🍺","🍻","🥂","🍷","🥃","🍾"],
  "⚽": ["⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥅","⛳","🏹","🎣","🥊","🥋","🎿","⛷️","🏂","🏋️","🤸","⛹️","🤾","🏌️","🏇","🧘","🏃","🚴","🎮","🕹️","🎲","🎯","🎰","🎳","🎸","🎹","🥁","🎺","🎷","🎤","🎧","🎬","🎨"],
  "🚗": ["🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🚚","🚛","🚜","🛴","🚲","🛵","🏍️","✈️","🚀","🛸","🚁","⛵","🚤","🛳️","🚂","🚊","🏠","🏡","🏢","🏥","🏦","🏨","🏫","⛪","🗼","🗽","🌍","🌙","☀️","⛅","🌧️","⛈️","❄️","🌈","🔥","💧","🌊"]
};

const panneauEmoji = document.getElementById("panneau-emoji");
const btnEmoji = document.getElementById("btn-emoji");
const ongletsEmoji = document.getElementById("onglets-emoji");
const grilleEmoji = document.getElementById("grille-emoji");

function construireSelecteurEmoji() {
  const categories = Object.keys(EMOJIS);

  categories.forEach((cat, index) => {
    const onglet = document.createElement("button");
    onglet.type = "button";
    onglet.textContent = cat;
    onglet.classList.add("onglet-emoji");
    if (index === 0) onglet.classList.add("actif");

    onglet.addEventListener("click", () => {
      document.querySelectorAll(".onglet-emoji").forEach(o => o.classList.remove("actif"));
      onglet.classList.add("actif");
      afficherCategorie(cat);
    });

    ongletsEmoji.appendChild(onglet);
  });

  afficherCategorie(categories[0]);
}

function afficherCategorie(categorie) {
  grilleEmoji.innerHTML = "";
  EMOJIS[categorie].forEach(emoji => {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.textContent = emoji;
    bouton.classList.add("bouton-emoji");
    bouton.addEventListener("click", () => insererEmoji(emoji));
    grilleEmoji.appendChild(bouton);
  });
}

// Insère l'emoji à la position du curseur dans le champ de texte
function insererEmoji(emoji) {
  const debut = messageInput.selectionStart;
  const fin = messageInput.selectionEnd;
  const texte = messageInput.value;

  messageInput.value = texte.slice(0, debut) + emoji + texte.slice(fin);
  messageInput.focus();
  messageInput.selectionStart = messageInput.selectionEnd = debut + emoji.length;
}

btnEmoji.addEventListener("click", (event) => {
  event.stopPropagation();
  panneauEmoji.classList.toggle("cache");
});

// Ferme le panneau si on clique ailleurs
document.addEventListener("click", (event) => {
  if (!panneauEmoji.contains(event.target) && event.target !== btnEmoji) {
    panneauEmoji.classList.add("cache");
  }
});

construireSelecteurEmoji();

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

    if (conversationActuelle.type === "salon") {
      socket.emit("message_public", { texte, imageUrl, salon: conversationActuelle.id });
    } else {
      socket.emit("message_prive", { destinataire: conversationActuelle.id, texte, imageUrl });
    }

    messageInput.value = "";
    reinitialiserImage();
  });

  // Liste des salons envoyée par le serveur à la connexion
  socket.on("liste_salons", (salons) => {
    salonsDisponibles = salons;
    construireListeSalons();
    ouvrirSalon("radio1");
  });

  // Historique d'un salon
  socket.on("historique_salon", (data) => {
    const cle = "salon:" + data.salon;
    cacheMessages[cle] = data.messages;

    if (conversationActuelle.type === "salon" && conversationActuelle.id === data.salon) {
      afficherMessages(data.messages);
    }
  });

  // Nouveau message dans un salon
  socket.on("message_public", (message) => {
    const salon = message.salon || "radio1";
    const cle = "salon:" + salon;

    if (!cacheMessages[cle]) cacheMessages[cle] = [];
    cacheMessages[cle].push(message);

    if (conversationActuelle.type === "salon" && conversationActuelle.id === salon) {
      ajouterMessageAffiche(message);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  });

  // Erreur d'envoi (ex : salon réservé aux admins)
  socket.on("erreur_envoi", (data) => {
    alert(data.message);
    pubErreur.textContent = data.message;
  });

  // ----- Événements du forum -----

  socket.on("liste_publications", (data) => {
    if (conversationActuelle.type === "salon" && conversationActuelle.id === data.salon) {
      afficherPublications(data.publications);
    }
  });

  socket.on("nouvelle_publication", (data) => {
    if (conversationActuelle.type === "salon" && conversationActuelle.id === data.salon) {
      publicationsCache.unshift(data.publication);

      const vide = listePublications.querySelector(".info-vide");
      if (vide) listePublications.innerHTML = "";

      listePublications.prepend(creerCartePublication(data.publication));
    }
  });

  socket.on("score_maj", (data) => {
    const pub = publicationsCache.find(p => p.id === data.publicationId);
    if (pub) pub.score = data.score;

    const carte = listePublications.querySelector(`[data-pub-id="${data.publicationId}"]`);
    if (carte) {
      const scoreEl = carte.querySelector(".score");
      if (scoreEl) scoreEl.textContent = data.score;
    }
  });

  socket.on("liste_commentaires", (data) => {
    if (publicationOuverte === data.publicationId) {
      afficherCommentaires(data.commentaires);
    }
  });

  socket.on("nouveau_commentaire", (data) => {
    // Met à jour le compteur sur la carte
    const pub = publicationsCache.find(p => p.id === data.publicationId);
    if (pub) {
      pub.nb_commentaires = (pub.nb_commentaires || 0) + 1;
      const carte = listePublications.querySelector(`[data-pub-id="${data.publicationId}"]`);
      if (carte) {
        const meta = carte.querySelector(".pub-meta");
        if (meta) meta.textContent = `par ${pub.auteur} · 💬 ${pub.nb_commentaires}`;
      }
    }

    // Ajoute le commentaire si la publication est ouverte
    if (publicationOuverte === data.publicationId) {
      const vide = detailCommentaires.querySelector(".info-vide");
      if (vide) detailCommentaires.innerHTML = "";
      detailCommentaires.appendChild(creerCommentaire(data.commentaire));
    }
  });

  socket.on("publication_supprimee", (data) => {
    publicationsCache = publicationsCache.filter(p => p.id !== data.id);
    const carte = listePublications.querySelector(`[data-pub-id="${data.id}"]`);
    if (carte) carte.remove();

    if (publicationOuverte === data.id) {
      modalDetail.classList.add("cache");
      publicationOuverte = null;
    }
  });

  socket.on("commentaire_supprime", (data) => {
    const el = detailCommentaires.querySelector(`[data-commentaire-id="${data.id}"]`);
    if (el) el.remove();
  });

  // ----- Interactions du forum -----

  btnNouvellePub.addEventListener("click", () => {
    pubTitre.value = "";
    pubContenu.value = "";
    pubErreur.textContent = "";
    reinitialiserImagePub();
    modalPublication.classList.remove("cache");
    pubTitre.focus();
  });

  pubFermer.addEventListener("click", () => modalPublication.classList.add("cache"));
  detailFermer.addEventListener("click", () => {
    modalDetail.classList.add("cache");
    publicationOuverte = null;
  });

  pubBtnImage.addEventListener("click", () => pubImage.click());
  pubAnnulerImage.addEventListener("click", reinitialiserImagePub);

  pubImage.addEventListener("change", () => {
    const fichier = pubImage.files[0];
    if (!fichier) return;

    if (fichier.size > 5 * 1024 * 1024) {
      alert("Image trop lourde (5 Mo maximum).");
      reinitialiserImagePub();
      return;
    }

    pubFichierSelectionne = fichier;
    pubApercuImg.src = URL.createObjectURL(fichier);
    pubApercu.classList.remove("cache");
  });

  pubPublier.addEventListener("click", async () => {
    const titre = pubTitre.value.trim();
    if (!titre) {
      pubErreur.textContent = "Le titre est obligatoire.";
      return;
    }

    let imageUrl = null;
    pubPublier.disabled = true;
    pubPublier.textContent = "Publication...";

    if (pubFichierSelectionne) {
      try {
        imageUrl = await envoyerImage(pubFichierSelectionne);
      } catch (err) {
        pubErreur.textContent = err.message;
        pubPublier.disabled = false;
        pubPublier.textContent = "Publier";
        return;
      }
    }

    socket.emit("creer_publication", {
      salon: conversationActuelle.id,
      titre,
      contenu: pubContenu.value.trim(),
      imageUrl
    });

    pubPublier.disabled = false;
    pubPublier.textContent = "Publier";
    modalPublication.classList.add("cache");
  });

  envoyerCommentaire.addEventListener("click", () => {
    const texte = inputCommentaire.value.trim();
    if (!texte || !publicationOuverte) return;

    socket.emit("ajouter_commentaire", {
      publicationId: publicationOuverte,
      texte
    });

    inputCommentaire.value = "";
  });

  inputCommentaire.addEventListener("keydown", (e) => {
    if (e.key === "Enter") envoyerCommentaire.click();
  });

  // Historique reçu pour une conversation privée
  socket.on("historique_prive", (data) => {
    const cle = "prive:" + data.avec;
    cacheMessages[cle] = data.messages;

    if (conversationActuelle.type === "prive" && conversationActuelle.id === data.avec) {
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
    const cle = "prive:" + data.avec;
    if (!cacheMessages[cle]) cacheMessages[cle] = [];
    cacheMessages[cle].push(data.message);

    if (conversationActuelle.type === "prive" && conversationActuelle.id === data.avec) {
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