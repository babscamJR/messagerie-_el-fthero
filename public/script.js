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

// Groupes
const listeGroupes = document.getElementById("liste-groupes");
const listeInvitations = document.getElementById("liste-invitations");
const btnCreerGroupe = document.getElementById("btn-creer-groupe");
const btnInviter = document.getElementById("btn-inviter");
const btnQuitterGroupe = document.getElementById("btn-quitter-groupe");
const modalGroupe = document.getElementById("modal-groupe");
const groupeTitre = document.getElementById("groupe-titre");
const groupeErreur = document.getElementById("groupe-erreur");
const groupeCreer = document.getElementById("groupe-creer");
const groupeFermer = document.getElementById("groupe-fermer");
const modalInviter = document.getElementById("modal-inviter");
const inviterPseudo = document.getElementById("inviter-pseudo");
const inviterErreur = document.getElementById("inviter-erreur");
const inviterEnvoyer = document.getElementById("inviter-envoyer");
const inviterFermer = document.getElementById("inviter-fermer");
const modalGroupesAttente = document.getElementById("modal-groupes-attente");
const listeGroupesAttente = document.getElementById("liste-groupes-attente");
const btnGroupesAttente = document.getElementById("btn-groupes-attente");
const fermerGroupesAttente = document.getElementById("fermer-groupes-attente");

let mesGroupes = [];

// Recherche, présence et frappe
const rechercheUtilisateur = document.getElementById("recherche-utilisateur");
const indicateurFrappe = document.getElementById("indicateur-frappe");
const menuUtilisateur = document.getElementById("menu-utilisateur");
const menuPseudo = document.getElementById("menu-pseudo");
const menuMessage = document.getElementById("menu-message");
const menuBannir = document.getElementById("menu-bannir");
const menuSupprimer = document.getElementById("menu-supprimer");
const menuMotDePasse = document.getElementById("menu-motdepasse");

// Limites (doivent correspondre à celles du serveur)
const LIMITE_MESSAGE = 1500;
const LIMITE_PUBLICATION = 3000;

const compteurCaracteres = document.getElementById("compteur-caracteres");
const modalLimite = document.getElementById("modal-limite");
const limiteTitre = document.getElementById("limite-titre");
const limiteMessage = document.getElementById("limite-message");
const limiteCompteRebours = document.getElementById("limite-compte-rebours");
const limiteFermer = document.getElementById("limite-fermer");

let minuteurRebours = null;

// Gestion des mots de passe
const btnMonMdp = document.getElementById("btn-mon-mdp");
const modalMonMdp = document.getElementById("modal-mon-mdp");
const noteMdpTemporaire = document.getElementById("note-mdp-temporaire");
const mdpActuel = document.getElementById("mdp-actuel");
const mdpNouveau = document.getElementById("mdp-nouveau");
const mdpConfirmation = document.getElementById("mdp-confirmation");
const mdpErreur = document.getElementById("mdp-erreur");
const mdpValider = document.getElementById("mdp-valider");
const mdpFermer = document.getElementById("mdp-fermer");
const modalMdpGenere = document.getElementById("modal-mdp-genere");
const mdpGenerePseudo = document.getElementById("mdp-genere-pseudo");
const mdpGenereValeur = document.getElementById("mdp-genere-valeur");
const mdpGenereCopier = document.getElementById("mdp-genere-copier");
const mdpGenereFermer = document.getElementById("mdp-genere-fermer");

let tousLesUtilisateurs = [];      // [{ pseudo, is_banni }]
let personnesEnLigne = new Set();
let cibleMenu = null;               // pseudo visé par le menu contextuel

// Qui écrit, dans quelle conversation : { "prive:lino": timeout }
const enTrainDEcrire = {};
let minuteurFrappe = null;
let frappeEnvoyee = false;

// Compteurs de messages non lus, par conversation ("salon:radio1", "prive:lino"...)
const nonLus = {};

window.addEventListener("focus", () => {
  fenetreActive = true;
  // La conversation ouverte devient lue dès qu'on revient sur l'onglet
  if (typeof marquerCommeLu === "function") marquerCommeLu(conversationActuelle);
});
window.addEventListener("blur", () => { fenetreActive = false; });

// Forum : catégorie et tri courants
let categorieActuelle = "horreur";
let triActuel = "recent";
let categorieNouvellePub = "horreur";

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

    // Compte les demandes de groupe en attente pour la cloche
    fetch("/admin/groupes-en-attente")
      .then(r => r.json())
      .then(d => {
        groupesAValider = (d.groupes || []).length;
        if (typeof majNotifications === "function") majNotifications();
      })
      .catch(() => {});
  }

  // Mot de passe réinitialisé par un modérateur : changement obligatoire
  if (data.doitChangerMdp) {
    setTimeout(() => ouvrirChangementMdp(true), 300);
  }

  monPseudoAffiche.textContent = monPseudo;
  apercuMonAvatar.dataset.avatarDe = monPseudo;

  demarrerChat();
  chargerListeUtilisateurs();
  chargerAvatars();
  afficherConversations();
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

      // Pas de boutons pour soi-même ni pour les autres admins
      if (u.pseudo !== monPseudo && !u.is_admin) {
        const actions = document.createElement("div");
        actions.classList.add("actions-admin");

        const btnBannir = document.createElement("button");
        btnBannir.textContent = u.is_banni ? "Débannir" : "Bannir";
        btnBannir.classList.add(u.is_banni ? "secondaire" : "danger");
        btnBannir.addEventListener("click", () => basculerBannissement(u.pseudo, !u.is_banni));

        const btnSupprimer = document.createElement("button");
        btnSupprimer.textContent = "🗑 Supprimer";
        btnSupprimer.classList.add("danger-fort");
        btnSupprimer.addEventListener("click", () => supprimerCompte(u.pseudo));

        actions.append(btnBannir, btnSupprimer);
        ligne.appendChild(actions);
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

async function supprimerCompte(pseudo) {
  const avertissement =
    `⚠️ SUPPRESSION DÉFINITIVE\n\n` +
    `Le compte "${pseudo}" sera effacé, ainsi que :\n` +
    `• tous ses messages publics\n` +
    `• toutes ses conversations privées\n` +
    `• toutes ses publications et commentaires\n\n` +
    `Cette action est irréversible. Continuer ?`;

  if (!confirm(avertissement)) return;

  // Deuxième confirmation : il faut retaper le pseudo
  const saisie = prompt(`Pour confirmer, tape exactement le pseudo : ${pseudo}`);
  if (saisie !== pseudo) {
    if (saisie !== null) alert("Le pseudo ne correspond pas. Suppression annulée.");
    return;
  }

  const reponse = await fetch("/admin/supprimer-compte", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pseudo })
  });

  const data = await reponse.json();

  if (data.succes) {
    alert(`Le compte "${pseudo}" a été supprimé.`);
    ouvrirPanneauAdmin();
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
  try {
    // En tant qu'admin on récupère aussi le statut de bannissement
    const url = jeSuisAdmin ? "/admin/utilisateurs" : "/utilisateurs";
    const reponse = await fetch(url);
    const data = await reponse.json();

    if (jeSuisAdmin && data.utilisateurs) {
      tousLesUtilisateurs = data.utilisateurs
        .filter(u => u.pseudo !== monPseudo)
        .map(u => ({ pseudo: u.pseudo, banni: u.is_banni, admin: u.is_admin }));
    } else if (data.utilisateurs) {
      tousLesUtilisateurs = data.utilisateurs.map(p => ({ pseudo: p, banni: false, admin: false }));
    }

    afficherListeUtilisateurs();
  } catch (err) {
    console.error("Erreur chargement utilisateurs :", err);
  }
}

function afficherListeUtilisateurs() {
  const filtre = (rechercheUtilisateur.value || "").trim().toLowerCase();
  listeUtilisateursDiv.innerHTML = "";

  // Priorité aux pseudos qui commencent par la saisie, puis ceux qui la contiennent
  const resultats = tousLesUtilisateurs
    .filter(u => {
      if (!filtre) return true;
      return u.pseudo.toLowerCase().includes(filtre);
    })
    .sort((a, b) => {
      if (filtre) {
        const aDebut = a.pseudo.toLowerCase().startsWith(filtre) ? 0 : 1;
        const bDebut = b.pseudo.toLowerCase().startsWith(filtre) ? 0 : 1;
        if (aDebut !== bDebut) return aDebut - bDebut;
      }
      return 0;
    })
    .sort((a, b) => {
      // Les personnes en ligne apparaissent en premier
      const aEnLigne = personnesEnLigne.has(a.pseudo) ? 0 : 1;
      const bEnLigne = personnesEnLigne.has(b.pseudo) ? 0 : 1;
      if (aEnLigne !== bEnLigne) return aEnLigne - bEnLigne;
      return a.pseudo.localeCompare(b.pseudo);
    });

  if (resultats.length === 0) {
    const vide = document.createElement("div");
    vide.classList.add("groupe-vide");
    vide.textContent = filtre ? "Aucun résultat" : "Aucun utilisateur";
    listeUtilisateursDiv.appendChild(vide);
    return;
  }

  resultats.forEach(u => {
    const item = document.createElement("div");
    item.classList.add("salon-item", "item-utilisateur");
    item.dataset.pseudo = u.pseudo;

    const pastille = document.createElement("span");
    pastille.classList.add("pastille");
    if (personnesEnLigne.has(u.pseudo)) pastille.classList.add("en-ligne");
    pastille.title = personnesEnLigne.has(u.pseudo) ? "En ligne" : "Hors ligne";

    const nom = document.createElement("span");
    nom.classList.add("nom-utilisateur");
    nom.textContent = u.pseudo;

    item.append(pastille, nom);

    if (u.banni) {
      const badge = document.createElement("span");
      badge.classList.add("badge", "banni");
      badge.textContent = "banni";
      item.appendChild(badge);
      item.classList.add("est-banni");
    }

    // Clic simple : ouvrir la conversation
    item.addEventListener("click", () => ouvrirConversationPrivee(u.pseudo));

    // Admin : clic droit ou appui long ouvre le menu de modération
    if (jeSuisAdmin && !u.admin) {
      item.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        ouvrirMenuUtilisateur(u, e.clientX, e.clientY);
      });

      let minuteurAppui = null;
      item.addEventListener("touchstart", (e) => {
        minuteurAppui = setTimeout(() => {
          const t = e.touches[0];
          ouvrirMenuUtilisateur(u, t.clientX, t.clientY);
        }, 550);
      });
      const annuler = () => clearTimeout(minuteurAppui);
      item.addEventListener("touchend", annuler);
      item.addEventListener("touchmove", annuler);
    }

    listeUtilisateursDiv.appendChild(item);
  });

  rafraichirBadges();
}

function ouvrirMenuUtilisateur(utilisateur, x, y) {
  cibleMenu = utilisateur;
  menuPseudo.textContent = utilisateur.pseudo;
  menuBannir.textContent = utilisateur.banni ? "✅ Débannir" : "🚫 Bannir";

  menuUtilisateur.classList.remove("cache");

  // Garde le menu dans l'écran
  const largeur = menuUtilisateur.offsetWidth;
  const hauteur = menuUtilisateur.offsetHeight;
  const posX = Math.min(x, window.innerWidth - largeur - 10);
  const posY = Math.min(y, window.innerHeight - hauteur - 10);

  menuUtilisateur.style.left = posX + "px";
  menuUtilisateur.style.top = posY + "px";
}

function fermerMenuUtilisateur() {
  menuUtilisateur.classList.add("cache");
  cibleMenu = null;
}

document.addEventListener("click", (e) => {
  if (!menuUtilisateur.contains(e.target)) fermerMenuUtilisateur();
});

menuMessage.addEventListener("click", () => {
  if (cibleMenu) ouvrirConversationPrivee(cibleMenu.pseudo);
  fermerMenuUtilisateur();
});

menuBannir.addEventListener("click", () => {
  if (cibleMenu) basculerBannissement(cibleMenu.pseudo, !cibleMenu.banni);
  fermerMenuUtilisateur();
});

menuMotDePasse.addEventListener("click", () => {
  if (cibleMenu) reinitialiserMotDePasse(cibleMenu.pseudo);
  fermerMenuUtilisateur();
});

menuSupprimer.addEventListener("click", () => {
  if (cibleMenu) supprimerCompte(cibleMenu.pseudo);
  fermerMenuUtilisateur();
});

rechercheUtilisateur.addEventListener("input", () => {
  afficherListeUtilisateurs();
  listeUtilisateursDiv.classList.remove("cache");
});

rechercheUtilisateur.addEventListener("focus", () => {
  fermerTousLesPanneaux(listeUtilisateursDiv);
  afficherListeUtilisateurs();
  listeUtilisateursDiv.classList.remove("cache");
});

rechercheUtilisateur.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    listeUtilisateursDiv.classList.add("cache");
    rechercheUtilisateur.blur();
  }
  // Entrée ouvre directement la première suggestion
  if (e.key === "Enter") {
    const premier = listeUtilisateursDiv.querySelector(".item-utilisateur");
    if (premier) premier.click();
  }
});

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

  if (typeof rafraichirBadges === "function") rafraichirBadges();

  rafraichirBadges();

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

  if (typeof fermerTousLesPanneaux === "function") fermerTousLesPanneaux();

  conversationActuelle = { type: "salon", id };
  marquerCommeLu(conversationActuelle);
  titreConversation.textContent = salonsDisponibles[id].nom;

  const item = listeSalonsDiv.querySelector(`[data-salon-id="${id}"]`);
  if (item) marquerActif(item);

  arreterFrappe();
  majIndicateurFrappe();
  majFondCubes();
  masquerActionsGroupe();

  const estForum = salonsDisponibles[id].type === "forum";

  if (estForum) {
    chatBox.classList.add("cache");
    forumBox.classList.remove("cache");
    listePublications.innerHTML = "<p class=\"info-vide\">Chargement...</p>";
    socket.emit("demander_publications", {
      salon: id,
      categorie: categorieActuelle,
      tri: triActuel
    });
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
  if (typeof fermerTousLesPanneaux === "function") fermerTousLesPanneaux();
  rechercheUtilisateur.value = "";
  conversationsOuvertes.add(pseudo);
  if (typeof afficherConversations === "function") afficherConversations();
  arreterFrappe();
  conversationActuelle = { type: "prive", id: pseudo };
  marquerCommeLu(conversationActuelle);
  titreConversation.textContent = "👤 " + pseudo;
  majIndicateurFrappe();

  const item = listeConversations
    ? [...listeConversations.querySelectorAll(".item-conversation")].find(el => el.dataset.pseudo === pseudo)
    : null;
  if (item) marquerActif(item);

  arreterFrappe();
  majIndicateurFrappe();
  majFondCubes();
  masquerActionsGroupe();
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

// Adapte les libellés du formulaire selon la catégorie choisie
function majFormulairePublication() {
  const modalTitre = document.getElementById("pub-modal-titre");
  const estHorreur = categorieNouvellePub === "horreur";

  if (modalTitre) {
    modalTitre.textContent = estHorreur ? "✍️ Nouvelle histoire" : "💬 Nouveau post";
  }

  pubTitre.placeholder = estHorreur
    ? "Titre de ton histoire"
    : "Titre (facultatif)";

  pubContenu.placeholder = estHorreur
    ? "Raconte ton histoire..."
    : "Quoi de neuf ?";

  pubContenu.rows = estHorreur ? 9 : 5;
}

function reinitialiserImagePub() {
  pubFichierSelectionne = null;
  pubImage.value = "";
  pubApercu.classList.add("cache");
  pubApercuImg.src = "";
}

// ---------- Personnalisation ----------

const COULEURS = [
  { id: "vert",    nom: "Vert néon",   accent: "#2ecc71", hover: "#27ae60", bulle: "#1a4d2e" },
  { id: "bleu",    nom: "Bleu océan",  accent: "#3b9eff", hover: "#2d7fd4", bulle: "#173553" },
  { id: "violet",  nom: "Violet",      accent: "#a855f7", hover: "#8b3fd4", bulle: "#3b1d5c" },
  { id: "rose",    nom: "Rose",        accent: "#f472b6", hover: "#db5a9c", bulle: "#54203c" },
  { id: "orange",  nom: "Orange",      accent: "#fb923c", hover: "#e07b2c", bulle: "#5a3418" },
  { id: "rouge",   nom: "Rouge sang",  accent: "#ef4444", hover: "#cc3838", bulle: "#5c1f1f" },
  { id: "cyan",    nom: "Cyan",        accent: "#22d3ee", hover: "#1bb0c7", bulle: "#154c57" },
  { id: "or",      nom: "Or",          accent: "#eab308", hover: "#c99a06", bulle: "#4d3d0a" }
];

const FONDS = [
  { id: "sombre",   nom: "Sombre",       page: "#0d1117", carte: "#161b22", autre: "#21262d", bordure: "#30363d", texte: "#e6edf3", texte2: "#8b949e" },
  { id: "noir",     nom: "Noir profond", page: "#000000", carte: "#0a0a0a", autre: "#161616", bordure: "#262626", texte: "#f0f0f0", texte2: "#888888" },
  { id: "ardoise",  nom: "Ardoise",      page: "#1a1d23", carte: "#22262e", autre: "#2d323c", bordure: "#3a404c", texte: "#e8eaed", texte2: "#9aa0a6" },
  { id: "marine",   nom: "Bleu nuit",    page: "#0f172a", carte: "#1e293b", autre: "#334155", bordure: "#475569", texte: "#e2e8f0", texte2: "#94a3b8" },
  { id: "clair",    nom: "Clair",        page: "#f5f5f7", carte: "#ffffff", autre: "#ebebef", bordure: "#d6d6dc", texte: "#1a1a1e", texte2: "#6b6b76" }
];

const POLICES = [
  { id: "systeme",  nom: "Système",      valeur: "'Segoe UI', Arial, sans-serif" },
  { id: "serif",    nom: "Serif",         valeur: "Georgia, 'Times New Roman', serif" },
  { id: "mono",     nom: "Monospace",     valeur: "'Consolas', 'Courier New', monospace" },
  { id: "arrondie", nom: "Arrondie",      valeur: "'Trebuchet MS', 'Verdana', sans-serif" },
  { id: "compacte", nom: "Compacte",      valeur: "'Tahoma', 'Geneva', sans-serif" },
  { id: "large",    nom: "Large",         valeur: "'Verdana', 'Geneva', sans-serif" }
];

const TAILLES = [
  { id: "petite", nom: "Petite",  valeur: "13px" },
  { id: "normale", nom: "Normale", valeur: "14px" },
  { id: "grande", nom: "Grande",  valeur: "16px" },
  { id: "xgrande", nom: "Très grande", valeur: "18px" }
];

const MOTIFS = [
  { id: "aucun",     nom: "Aucun",          icone: "∅" },
  { id: "cubes",     nom: "Cubes 3D",       icone: "⬛" },
  { id: "grille",    nom: "Grille",          icone: "▦" },
  { id: "points",    nom: "Points",          icone: "⋯" },
  { id: "vagues",    nom: "Vagues",          icone: "〰" },
  { id: "etoiles",   nom: "Étoiles",         icone: "✦" },
  { id: "pluie",     nom: "Pluie de code",   icone: "⋮" },
  { id: "bulles",    nom: "Bulles",          icone: "○" },
  { id: "hexagones", nom: "Hexagones",       icone: "⬡" },
  { id: "diagonales", nom: "Diagonales",     icone: "╱" },
  { id: "cercles",   nom: "Ondes",           icone: "◎" },
  { id: "particules", nom: "Particules",     icone: "✧" }
];

const INTENSITES = [
  { id: "discret", nom: "Discret", valeur: 0.12 },
  { id: "moyen",   nom: "Moyen",   valeur: 0.22 },
  { id: "marque",  nom: "Marqué",  valeur: 0.38 }
];

const PERSO_DEFAUT = {
  couleur: "vert",
  fond: "sombre",
  police: "systeme",
  taille: "normale",
  motif: "cubes",
  intensite: "moyen"
};

let perso = { ...PERSO_DEFAUT };

function chargerPreferences() {
  try {
    const brut = localStorage.getItem("perso");
    if (brut) perso = { ...PERSO_DEFAUT, ...JSON.parse(brut) };
  } catch (err) {
    perso = { ...PERSO_DEFAUT };
  }
  appliquerPreferences();
}

function sauvegarderPreferences() {
  try {
    localStorage.setItem("perso", JSON.stringify(perso));
  } catch (err) {
    // Stockage indisponible : les réglages resteront le temps de la session
  }
}

function appliquerPreferences() {
  const racine = document.documentElement;

  const couleur = COULEURS.find(c => c.id === perso.couleur) || COULEURS[0];
  racine.style.setProperty("--accent", couleur.accent);
  racine.style.setProperty("--accent-hover", couleur.hover);
  racine.style.setProperty("--bg-message-mine", couleur.bulle);

  const fond = FONDS.find(f => f.id === perso.fond) || FONDS[0];
  racine.style.setProperty("--bg-page", fond.page);
  racine.style.setProperty("--bg-card", fond.carte);
  racine.style.setProperty("--bg-sidebar", fond.page);
  racine.style.setProperty("--bg-message-other", fond.autre);
  racine.style.setProperty("--border-color", fond.bordure);
  racine.style.setProperty("--text-primary", fond.texte);
  racine.style.setProperty("--text-secondary", fond.texte2);

  const police = POLICES.find(p => p.id === perso.police) || POLICES[0];
  racine.style.setProperty("--police", police.valeur);

  const taille = TAILLES.find(t => t.id === perso.taille) || TAILLES[1];
  racine.style.setProperty("--taille-texte", taille.valeur);

  const intensite = INTENSITES.find(i => i.id === perso.intensite) || INTENSITES[1];
  racine.style.setProperty("--intensite-motif", intensite.valeur);
}

function construireListesPerso() {
  // Couleurs : pastille + nom
  const listeCouleurs = document.getElementById("liste-couleurs");
  listeCouleurs.innerHTML = "";
  COULEURS.forEach(c => {
    const bouton = document.createElement("button");
    bouton.classList.add("choix");
    if (perso.couleur === c.id) bouton.classList.add("actif");

    const pastille = document.createElement("span");
    pastille.classList.add("apercu-couleur");
    pastille.style.background = c.accent;

    const nom = document.createElement("span");
    nom.textContent = c.nom;

    bouton.append(pastille, nom);
    bouton.addEventListener("click", () => {
      perso.couleur = c.id;
      appliquerPreferences();
      sauvegarderPreferences();
      construireListesPerso();
    });
    listeCouleurs.appendChild(bouton);
  });

  // Fonds : carré d'aperçu + nom
  const listeFonds = document.getElementById("liste-fonds");
  listeFonds.innerHTML = "";
  FONDS.forEach(f => {
    const bouton = document.createElement("button");
    bouton.classList.add("choix");
    if (perso.fond === f.id) bouton.classList.add("actif");

    const apercu = document.createElement("span");
    apercu.classList.add("apercu-fond");
    apercu.style.background = f.page;
    apercu.style.borderColor = f.bordure;

    const nom = document.createElement("span");
    nom.textContent = f.nom;

    bouton.append(apercu, nom);
    bouton.addEventListener("click", () => {
      perso.fond = f.id;
      appliquerPreferences();
      sauvegarderPreferences();
      construireListesPerso();
    });
    listeFonds.appendChild(bouton);
  });

  // Polices : nom écrit dans la police elle-même
  const listePolices = document.getElementById("liste-polices");
  listePolices.innerHTML = "";
  POLICES.forEach(p => {
    const bouton = document.createElement("button");
    bouton.classList.add("choix");
    if (perso.police === p.id) bouton.classList.add("actif");

    const nom = document.createElement("span");
    nom.textContent = p.nom;
    nom.style.fontFamily = p.valeur;

    const exemple = document.createElement("span");
    exemple.classList.add("apercu-police");
    exemple.textContent = "Aa";
    exemple.style.fontFamily = p.valeur;

    bouton.append(exemple, nom);
    bouton.addEventListener("click", () => {
      perso.police = p.id;
      appliquerPreferences();
      sauvegarderPreferences();
      construireListesPerso();
    });
    listePolices.appendChild(bouton);
  });

  // Motifs
  const listeMotifs = document.getElementById("liste-motifs");
  if (listeMotifs) {
    listeMotifs.innerHTML = "";
    MOTIFS.forEach(m => {
      const bouton = document.createElement("button");
      bouton.classList.add("choix");
      if (perso.motif === m.id) bouton.classList.add("actif");

      const icone = document.createElement("span");
      icone.classList.add("apercu-motif");
      icone.textContent = m.icone;

      const nom = document.createElement("span");
      nom.textContent = m.nom;

      bouton.append(icone, nom);
      bouton.addEventListener("click", () => {
        perso.motif = m.id;
        appliquerPreferences();
        sauvegarderPreferences();
        construireListesPerso();
        if (fondCubes) fondCubes.dataset.motif = "";
        majFondCubes();
      });
      listeMotifs.appendChild(bouton);
    });
  }

  // Intensité du motif
  const listeIntensites = document.getElementById("liste-intensites");
  if (listeIntensites) {
    listeIntensites.innerHTML = "";
    INTENSITES.forEach(i => {
      const bouton = document.createElement("button");
      bouton.classList.add("choix");
      if (perso.intensite === i.id) bouton.classList.add("actif");
      bouton.textContent = i.nom;
      bouton.addEventListener("click", () => {
        perso.intensite = i.id;
        appliquerPreferences();
        sauvegarderPreferences();
        construireListesPerso();
      });
      listeIntensites.appendChild(bouton);
    });
  }

  // Tailles
  const listeTailles = document.getElementById("liste-tailles");
  listeTailles.innerHTML = "";
  TAILLES.forEach(t => {
    const bouton = document.createElement("button");
    bouton.classList.add("choix");
    if (perso.taille === t.id) bouton.classList.add("actif");

    const exemple = document.createElement("span");
    exemple.classList.add("apercu-police");
    exemple.textContent = "Aa";
    exemple.style.fontSize = t.valeur;

    const nom = document.createElement("span");
    nom.textContent = t.nom;

    bouton.append(exemple, nom);
    bouton.addEventListener("click", () => {
      perso.taille = t.id;
      appliquerPreferences();
      sauvegarderPreferences();
      construireListesPerso();
    });
    listeTailles.appendChild(bouton);
  });
}

const btnPersonnalisation = document.getElementById("btn-personnalisation");
const modalPersonnalisation = document.getElementById("modal-personnalisation");
const persoFermer = document.getElementById("perso-fermer");
const persoReinitialiser = document.getElementById("perso-reinitialiser");

btnPersonnalisation.addEventListener("click", () => {
  construireListesPerso();
  modalPersonnalisation.classList.remove("cache");
});

persoFermer.addEventListener("click", () => {
  modalPersonnalisation.classList.add("cache");
});

persoReinitialiser.addEventListener("click", () => {
  perso = { ...PERSO_DEFAUT };
  appliquerPreferences();
  sauvegarderPreferences();
  construireListesPerso();
});

chargerPreferences();

// ---------- Avatars géométriques ----------

const FORMES_FOND = [
  { id: "cercle",  nom: "Cercle" },
  { id: "carre",   nom: "Carré" },
  { id: "arrondi", nom: "Arrondi" },
  { id: "hexa",    nom: "Hexagone" },
  { id: "bouclier", nom: "Bouclier" }
];

const FORMES_PRINCIPALES = [
  { id: "triangle", nom: "Triangle" },
  { id: "cercle",   nom: "Cercle" },
  { id: "carre",    nom: "Carré" },
  { id: "losange",  nom: "Losange" },
  { id: "etoile",   nom: "Étoile" },
  { id: "anneau",   nom: "Anneau" },
  { id: "croix",    nom: "Croix" },
  { id: "eclair",   nom: "Éclair" },
  { id: "chevrons", nom: "Chevrons" },
  { id: "lune",     nom: "Lune" },
  { id: "goutte",   nom: "Goutte" },
  { id: "aucune",   nom: "Aucune" }
];

const FORMES_ACCENT = [
  { id: "aucun",    nom: "Aucun" },
  { id: "point",    nom: "Point" },
  { id: "trois",    nom: "Trois points" },
  { id: "barre",    nom: "Barre" },
  { id: "orbite",   nom: "Orbite" },
  { id: "etincelle", nom: "Étincelle" }
];

const PALETTE = [
  "#2ecc71", "#27ae60", "#3b9eff", "#2d7fd4", "#a855f7", "#7c3aed",
  "#f472b6", "#db2777", "#fb923c", "#ea580c", "#ef4444", "#b91c1c",
  "#22d3ee", "#0891b2", "#eab308", "#ca8a04", "#e6edf3", "#8b949e",
  "#30363d", "#0d1117"
];

const AVATAR_DEFAUT = {
  fond: "cercle",
  cFond: "#1a4d2e",
  forme: "triangle",
  cForme: "#2ecc71",
  accent: "aucun",
  cAccent: "#e6edf3",
  rotation: 0
};

// Avatars de tout le monde, indexés par pseudo
const avatarsConnus = {};

// Construit le SVG d'un avatar à partir de sa configuration
function dessinerAvatar(config, taille) {
  const a = { ...AVATAR_DEFAUT, ...(config || {}) };
  const t = taille || 34;

  let fond = "";
  switch (a.fond) {
    case "carre":
      fond = `<rect x="0" y="0" width="100" height="100" fill="${a.cFond}"/>`;
      break;
    case "arrondi":
      fond = `<rect x="0" y="0" width="100" height="100" rx="24" fill="${a.cFond}"/>`;
      break;
    case "hexa":
      fond = `<polygon points="50,2 93,26 93,74 50,98 7,74 7,26" fill="${a.cFond}"/>`;
      break;
    case "bouclier":
      fond = `<path d="M50 2 L94 20 V56 Q94 84 50 98 Q6 84 6 56 V20 Z" fill="${a.cFond}"/>`;
      break;
    default:
      fond = `<circle cx="50" cy="50" r="49" fill="${a.cFond}"/>`;
  }

  let forme = "";
  switch (a.forme) {
    case "triangle":
      forme = `<polygon points="50,22 76,70 24,70" fill="${a.cForme}"/>`;
      break;
    case "cercle":
      forme = `<circle cx="50" cy="50" r="25" fill="${a.cForme}"/>`;
      break;
    case "carre":
      forme = `<rect x="27" y="27" width="46" height="46" rx="5" fill="${a.cForme}"/>`;
      break;
    case "losange":
      forme = `<polygon points="50,20 78,50 50,80 22,50" fill="${a.cForme}"/>`;
      break;
    case "etoile":
      forme = `<path d="M50 18 L58 42 L83 42 L63 57 L70 81 L50 66 L30 81 L37 57 L17 42 L42 42 Z" fill="${a.cForme}"/>`;
      break;
    case "anneau":
      forme = `<circle cx="50" cy="50" r="25" fill="none" stroke="${a.cForme}" stroke-width="11"/>`;
      break;
    case "croix":
      forme = `<path d="M42 20 h16 v22 h22 v16 h-22 v22 h-16 v-22 h-22 v-16 h22 Z" fill="${a.cForme}"/>`;
      break;
    case "eclair":
      forme = `<path d="M58 16 L30 55 H46 L40 84 L70 44 H54 Z" fill="${a.cForme}"/>`;
      break;
    case "chevrons":
      forme = `<path d="M28 30 L50 50 L28 70 M52 30 L74 50 L52 70" fill="none" stroke="${a.cForme}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`;
      break;
    case "lune":
      forme = `<path d="M62 20 A32 32 0 1 0 62 80 A26 26 0 1 1 62 20 Z" fill="${a.cForme}"/>`;
      break;
    case "goutte":
      forme = `<path d="M50 18 Q74 46 74 60 A24 24 0 0 1 26 60 Q26 46 50 18 Z" fill="${a.cForme}"/>`;
      break;
  }

  let accent = "";
  switch (a.accent) {
    case "point":
      accent = `<circle cx="76" cy="26" r="9" fill="${a.cAccent}"/>`;
      break;
    case "trois":
      accent = `<circle cx="26" cy="80" r="5" fill="${a.cAccent}"/>` +
               `<circle cx="42" cy="86" r="5" fill="${a.cAccent}"/>` +
               `<circle cx="58" cy="80" r="5" fill="${a.cAccent}"/>`;
      break;
    case "barre":
      accent = `<rect x="18" y="82" width="64" height="7" rx="3.5" fill="${a.cAccent}"/>`;
      break;
    case "orbite":
      accent = `<ellipse cx="50" cy="50" rx="42" ry="17" fill="none" stroke="${a.cAccent}" stroke-width="5" transform="rotate(-28 50 50)"/>`;
      break;
    case "etincelle":
      accent = `<path d="M78 14 L81 25 L92 28 L81 31 L78 42 L75 31 L64 28 L75 25 Z" fill="${a.cAccent}"/>`;
      break;
  }

  const pivot = a.rotation ? ` transform="rotate(${a.rotation} 50 50)"` : "";

  return `<svg class="avatar" width="${t}" height="${t}" viewBox="0 0 100 100" aria-hidden="true">` +
         fond + `<g${pivot}>` + forme + `</g>` + accent + `</svg>`;
}

// Crée un élément avatar prêt à insérer
function creerAvatar(pseudo, taille) {
  const conteneur = document.createElement("span");
  conteneur.classList.add("avatar-conteneur");
  conteneur.innerHTML = dessinerAvatar(avatarsConnus[pseudo], taille);
  return conteneur;
}

async function chargerAvatars() {
  try {
    const reponse = await fetch("/avatars");
    const data = await reponse.json();
    Object.assign(avatarsConnus, data.avatars || {});
    rafraichirAvatarsAffiches();
  } catch (err) {
    console.error("Erreur chargement avatars :", err);
  }
}

// Remet à jour tous les avatars déjà affichés à l'écran
function rafraichirAvatarsAffiches() {
  document.querySelectorAll("[data-avatar-de]").forEach(el => {
    const pseudo = el.dataset.avatarDe;
    const taille = parseInt(el.dataset.avatarTaille, 10) || 34;
    el.innerHTML = dessinerAvatar(avatarsConnus[pseudo], taille);
  });
}

// ---------- Barre latérale : conversations privées ----------

const listeConversations = document.getElementById("liste-conversations");
const monPseudoAffiche = document.getElementById("mon-pseudo-affiche");
const apercuMonAvatar = document.getElementById("apercu-mon-avatar");

// Pseudos avec qui une conversation est déjà engagée
const conversationsOuvertes = new Set();

function afficherConversations() {
  if (!listeConversations) return;

  listeConversations.innerHTML = "";

  // On liste ceux avec qui on a échangé, plus ceux qui ont des non-lus
  const pseudos = new Set(conversationsOuvertes);
  Object.keys(nonLus).forEach(cle => {
    if (cle.startsWith("prive:")) pseudos.add(cle.slice(6));
  });

  const tries = [...pseudos].sort((a, b) => {
    const aEnLigne = personnesEnLigne.has(a) ? 0 : 1;
    const bEnLigne = personnesEnLigne.has(b) ? 0 : 1;
    if (aEnLigne !== bEnLigne) return aEnLigne - bEnLigne;
    return a.localeCompare(b);
  });

  if (tries.length === 0) {
    listeConversations.innerHTML =
      "<p class=\"info-vide\">Utilise la recherche en haut pour démarrer une conversation.</p>";
    return;
  }

  tries.forEach(pseudo => {
    const item = document.createElement("div");
    item.classList.add("salon-item", "item-conversation");
    item.dataset.pseudo = pseudo;

    const avatar = document.createElement("span");
    avatar.classList.add("avatar-conteneur");
    avatar.dataset.avatarDe = pseudo;
    avatar.dataset.avatarTaille = "30";
    avatar.innerHTML = dessinerAvatar(avatarsConnus[pseudo], 30);

    const bloc = document.createElement("span");
    bloc.classList.add("conv-infos");

    const nom = document.createElement("span");
    nom.classList.add("nom-utilisateur");
    nom.textContent = pseudo;

    const etat = document.createElement("span");
    etat.classList.add("conv-etat");
    etat.textContent = personnesEnLigne.has(pseudo) ? "En ligne" : "Hors ligne";
    if (personnesEnLigne.has(pseudo)) etat.classList.add("actif");

    bloc.append(nom, etat);
    item.append(avatar, bloc);

    item.addEventListener("click", () => ouvrirConversationPrivee(pseudo));

    if (jeSuisAdmin) {
      const infos = tousLesUtilisateurs.find(u => u.pseudo === pseudo);
      if (infos && !infos.admin) {
        item.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          ouvrirMenuUtilisateur(infos, e.clientX, e.clientY);
        });
      }
    }

    listeConversations.appendChild(item);
  });

  if (typeof rafraichirBadges === "function") rafraichirBadges();
}

// ---------- Atelier de création d'icône ----------

const btnMonAvatar = document.getElementById("btn-mon-avatar");
const lienModifierAvatar = document.getElementById("lien-modifier-avatar");
const modalAvatar = document.getElementById("modal-avatar");
const avatarApercuGrand = document.getElementById("avatar-apercu-grand");
const avatarAleatoire = document.getElementById("avatar-aleatoire");
const avatarRotation = document.getElementById("avatar-rotation");
const avatarEnregistrer = document.getElementById("avatar-enregistrer");
const avatarFermer = document.getElementById("avatar-fermer");

let avatarEnCours = { ...AVATAR_DEFAUT };

function majApercuAvatar() {
  avatarApercuGrand.innerHTML = dessinerAvatar(avatarEnCours, 110);
}

// Construit une rangée de formes cliquables
function construireFormes(conteneurId, formes, champ) {
  const conteneur = document.getElementById(conteneurId);
  if (!conteneur) return;

  conteneur.innerHTML = "";
  formes.forEach(f => {
    const bouton = document.createElement("button");
    bouton.classList.add("choix-forme");
    bouton.title = f.nom;
    if (avatarEnCours[champ] === f.id) bouton.classList.add("actif");

    // Aperçu miniature de la forme seule
    const apercu = { ...avatarEnCours };
    apercu[champ] = f.id;
    if (champ === "fond") {
      apercu.forme = "aucune";
      apercu.accent = "aucun";
    }
    bouton.innerHTML = dessinerAvatar(apercu, 34);

    bouton.addEventListener("click", () => {
      avatarEnCours[champ] = f.id;
      majApercuAvatar();
      construireAtelierAvatar();
    });

    conteneur.appendChild(bouton);
  });
}

// Construit une palette de couleurs cliquables
function construirePalette(conteneurId, champ) {
  const conteneur = document.getElementById(conteneurId);
  if (!conteneur) return;

  conteneur.innerHTML = "";
  PALETTE.forEach(couleur => {
    const bouton = document.createElement("button");
    bouton.classList.add("pastille-couleur");
    bouton.style.background = couleur;
    if (avatarEnCours[champ] === couleur) bouton.classList.add("actif");

    bouton.addEventListener("click", () => {
      avatarEnCours[champ] = couleur;
      majApercuAvatar();
      construireAtelierAvatar();
    });

    conteneur.appendChild(bouton);
  });
}

function construireAtelierAvatar() {
  construireFormes("avatar-formes-fond", FORMES_FOND, "fond");
  construirePalette("avatar-couleurs-fond", "cFond");
  construireFormes("avatar-formes-principales", FORMES_PRINCIPALES, "forme");
  construirePalette("avatar-couleurs-forme", "cForme");
  construireFormes("avatar-formes-accent", FORMES_ACCENT, "accent");
  construirePalette("avatar-couleurs-accent", "cAccent");
  avatarRotation.value = avatarEnCours.rotation || 0;
}

function ouvrirAtelierAvatar() {
  avatarEnCours = { ...AVATAR_DEFAUT, ...(avatarsConnus[monPseudo] || {}) };
  majApercuAvatar();
  construireAtelierAvatar();
  modalAvatar.classList.remove("cache");
}

btnMonAvatar.addEventListener("click", ouvrirAtelierAvatar);
lienModifierAvatar.addEventListener("click", ouvrirAtelierAvatar);
avatarFermer.addEventListener("click", () => modalAvatar.classList.add("cache"));

avatarRotation.addEventListener("input", () => {
  avatarEnCours.rotation = parseInt(avatarRotation.value, 10);
  majApercuAvatar();
});

avatarAleatoire.addEventListener("click", () => {
  const auHasard = liste => liste[Math.floor(Math.random() * liste.length)];

  avatarEnCours = {
    fond: auHasard(FORMES_FOND).id,
    cFond: auHasard(PALETTE),
    forme: auHasard(FORMES_PRINCIPALES.filter(f => f.id !== "aucune")).id,
    cForme: auHasard(PALETTE),
    accent: auHasard(FORMES_ACCENT).id,
    cAccent: auHasard(PALETTE),
    rotation: Math.floor(Math.random() * 24) * 15
  };

  majApercuAvatar();
  construireAtelierAvatar();
});

avatarEnregistrer.addEventListener("click", async () => {
  const reponse = await fetch("/mon-avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avatar: avatarEnCours })
  });

  const data = await reponse.json();

  if (data.succes) {
    avatarsConnus[monPseudo] = { ...avatarEnCours };
    rafraichirAvatarsAffiches();
    modalAvatar.classList.add("cache");
  } else {
    alert(data.erreur || "Erreur lors de l'enregistrement.");
  }
});

// ---------- Centre de notifications ----------

const btnNotifications = document.getElementById("btn-notifications");
const badgeNotifications = document.getElementById("badge-notifications");
const panneauNotifications = document.getElementById("panneau-notifications");
const listeNotifications = document.getElementById("liste-notifications");
const toutMarquerLu = document.getElementById("tout-marquer-lu");

// Invitations et demandes en attente, alimentées par les événements socket
let invitationsEnAttente = [];
let groupesAValider = 0;

// Rassemble toutes les sources de notification
function collecterNotifications() {
  const liste = [];

  // Invitations de groupe
  invitationsEnAttente.forEach(inv => {
    liste.push({
      type: "invitation",
      icone: "👥",
      titre: "Invitation à un groupe",
      texte: `${inv.invite_par} t'invite dans « ${inv.titre} »`,
      action: () => {
        fermerTousLesPanneaux();
        panneauGroupes.classList.remove("cache");
      }
    });
  });

  // Demandes de validation, réservées aux administrateurs
  if (jeSuisAdmin && groupesAValider > 0) {
    liste.push({
      type: "moderation",
      icone: "⏳",
      titre: "Groupes à valider",
      texte: `${groupesAValider} groupe(s) en attente de ta validation`,
      action: () => {
        fermerTousLesPanneaux();
        modalGroupesAttente.classList.remove("cache");
        chargerGroupesEnAttente();
      }
    });
  }

  // Messages non lus
  Object.keys(nonLus).forEach(cle => {
    const nombre = nonLus[cle];
    if (!nombre) return;

    const separateur = cle.indexOf(":");
    const type = cle.slice(0, separateur);
    const id = cle.slice(separateur + 1);

    let icone = "💬";
    let titre = id;

    if (type === "salon") {
      const salon = salonsDisponibles[id];
      icone = "📻";
      titre = salon ? salon.nom : id;
    } else if (type === "groupe") {
      const groupe = mesGroupes.find(g => String(g.id) === String(id));
      icone = "👥";
      titre = groupe ? groupe.titre : "Groupe";
    } else {
      icone = "✉️";
      titre = id;
    }

    liste.push({
      type: "message",
      icone,
      titre,
      texte: `${nombre} nouveau${nombre > 1 ? "x" : ""} message${nombre > 1 ? "s" : ""}`,
      nombre,
      action: () => {
        fermerTousLesPanneaux();
        if (type === "salon") ouvrirSalon(id);
        else if (type === "groupe") ouvrirGroupe(parseInt(id, 10));
        else ouvrirConversationPrivee(id);
      }
    });
  });

  return liste;
}

function majNotifications() {
  const liste = collecterNotifications();
  const total = liste.reduce((somme, n) => somme + (n.nombre || 1), 0);

  // Pastille sur la cloche
  if (total > 0) {
    badgeNotifications.textContent = total > 99 ? "99+" : total;
    badgeNotifications.classList.remove("cache");
    btnNotifications.classList.add("a-des-notifs");
  } else {
    badgeNotifications.classList.add("cache");
    btnNotifications.classList.remove("a-des-notifs");
  }

  // Contenu du panneau
  listeNotifications.innerHTML = "";

  if (liste.length === 0) {
    listeNotifications.innerHTML = "<p class=\"info-vide\">Aucune notification</p>";
    return;
  }

  liste.forEach(n => {
    const item = document.createElement("button");
    item.classList.add("notification", "notif-" + n.type);

    const icone = document.createElement("span");
    icone.classList.add("notif-icone");
    icone.textContent = n.icone;

    const corps = document.createElement("span");
    corps.classList.add("notif-corps");

    const titre = document.createElement("span");
    titre.classList.add("notif-titre");
    titre.textContent = n.titre;

    const texte = document.createElement("span");
    texte.classList.add("notif-texte");
    texte.textContent = n.texte;

    corps.append(titre, texte);
    item.append(icone, corps);

    if (n.nombre) {
      const compteur = document.createElement("span");
      compteur.classList.add("notif-compteur");
      compteur.textContent = n.nombre;
      item.appendChild(compteur);
    }

    item.addEventListener("click", () => {
      panneauNotifications.classList.add("cache");
      n.action();
    });

    listeNotifications.appendChild(item);
  });
}

// ---------- Menus déroulants de la barre supérieure ----------

const btnMenuGroupes = document.getElementById("btn-menu-groupes");
const panneauGroupes = document.getElementById("panneau-groupes");
const btnMenuCompte = document.getElementById("btn-menu-compte");
const panneauCompte = document.getElementById("panneau-compte");

function fermerTousLesPanneaux(sauf) {
  [panneauGroupes, panneauCompte, panneauNotifications, listeUtilisateursDiv].forEach(p => {
    if (p && p !== sauf) p.classList.add("cache");
  });
}

btnMenuGroupes.addEventListener("click", (e) => {
  e.stopPropagation();
  const ouvert = !panneauGroupes.classList.contains("cache");
  fermerTousLesPanneaux();
  panneauGroupes.classList.toggle("cache", ouvert);
});

btnNotifications.addEventListener("click", (e) => {
  e.stopPropagation();
  const ouvert = !panneauNotifications.classList.contains("cache");
  fermerTousLesPanneaux();
  if (!ouvert) {
    majNotifications();
    panneauNotifications.classList.remove("cache");
  }
});

toutMarquerLu.addEventListener("click", (e) => {
  e.stopPropagation();
  Object.keys(nonLus).forEach(cle => delete nonLus[cle]);
  rafraichirBadges();
  majTitreOnglet();
  majNotifications();
});

btnMenuCompte.addEventListener("click", (e) => {
  e.stopPropagation();
  const ouvert = !panneauCompte.classList.contains("cache");
  fermerTousLesPanneaux();
  panneauCompte.classList.toggle("cache", ouvert);
});

// Un clic ailleurs referme tout
document.addEventListener("click", (e) => {
  const dansTopbar = e.target.closest(".topbar");
  if (!dansTopbar) fermerTousLesPanneaux();
});

// Échap referme aussi
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fermerTousLesPanneaux();
});

// ---------- Limites anti-spam ----------

function afficherLimite(titre, message, secondes) {
  clearInterval(minuteurRebours);

  limiteTitre.textContent = titre;
  limiteMessage.textContent = message;

  if (secondes && secondes > 0) {
    limiteCompteRebours.classList.remove("cache");
    let restant = secondes;

    const majRebours = () => {
      if (restant <= 0) {
        clearInterval(minuteurRebours);
        limiteCompteRebours.textContent = "Tu peux réessayer";
        limiteCompteRebours.classList.add("pret");
        return;
      }

      const minutes = Math.floor(restant / 60);
      const sec = restant % 60;
      limiteCompteRebours.textContent = minutes > 0
        ? `${minutes} min ${String(sec).padStart(2, "0")} s`
        : `${sec} s`;
      restant--;
    };

    limiteCompteRebours.classList.remove("pret");
    majRebours();
    minuteurRebours = setInterval(majRebours, 1000);
  } else {
    limiteCompteRebours.classList.add("cache");
  }

  modalLimite.classList.remove("cache");
}

limiteFermer.addEventListener("click", () => {
  modalLimite.classList.add("cache");
  clearInterval(minuteurRebours);
});

// Compteur de caractères, visible seulement quand on approche de la limite
function majCompteurCaracteres() {
  const longueur = messageInput.value.length;
  const restant = LIMITE_MESSAGE - longueur;

  if (restant > 200) {
    compteurCaracteres.classList.add("cache");
    return;
  }

  compteurCaracteres.classList.remove("cache");
  compteurCaracteres.textContent = `${longueur} / ${LIMITE_MESSAGE}`;
  compteurCaracteres.classList.toggle("depasse", restant < 0);

  btnEnvoyer.disabled = restant < 0;
}

// ---------- Gestion des mots de passe ----------

function ouvrirChangementMdp(force) {
  mdpActuel.value = "";
  mdpNouveau.value = "";
  mdpConfirmation.value = "";
  mdpErreur.textContent = "";

  noteMdpTemporaire.classList.toggle("cache", !force);
  mdpFermer.classList.toggle("cache", force === true);

  modalMonMdp.classList.remove("cache");
  mdpActuel.focus();
}

btnMonMdp.addEventListener("click", () => ouvrirChangementMdp(false));
mdpFermer.addEventListener("click", () => modalMonMdp.classList.add("cache"));

mdpValider.addEventListener("click", async () => {
  const actuel = mdpActuel.value;
  const nouveau = mdpNouveau.value;

  if (!actuel || !nouveau) {
    mdpErreur.textContent = "Tous les champs sont requis.";
    return;
  }

  if (nouveau.length < 4) {
    mdpErreur.textContent = "Le nouveau mot de passe doit faire au moins 4 caractères.";
    return;
  }

  if (nouveau !== mdpConfirmation.value) {
    mdpErreur.textContent = "Les deux mots de passe ne correspondent pas.";
    return;
  }

  const reponse = await fetch("/changer-motdepasse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actuel, nouveau })
  });

  const data = await reponse.json();

  if (data.succes) {
    modalMonMdp.classList.add("cache");
    mdpFermer.classList.remove("cache");
    alert("Mot de passe changé.");
  } else {
    mdpErreur.textContent = data.erreur || "Erreur.";
  }
});

mdpConfirmation.addEventListener("keydown", (e) => {
  if (e.key === "Enter") mdpValider.click();
});

// Réinitialisation par un administrateur
async function reinitialiserMotDePasse(pseudo) {
  if (!confirm(`Réinitialiser le mot de passe de ${pseudo} ?\n\nUn mot de passe temporaire sera généré et la personne sera déconnectée.`)) return;

  const reponse = await fetch("/admin/reinitialiser-motdepasse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pseudo })
  });

  const data = await reponse.json();

  if (data.succes) {
    mdpGenerePseudo.textContent = pseudo;
    mdpGenereValeur.textContent = data.motdepasse;
    modalMdpGenere.classList.remove("cache");
  } else {
    alert(data.erreur || "Erreur.");
  }
}

mdpGenereCopier.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(mdpGenereValeur.textContent);
    mdpGenereCopier.textContent = "Copié ✓";
    setTimeout(() => { mdpGenereCopier.textContent = "Copier"; }, 1800);
  } catch (err) {
    alert("Copie impossible, note-le manuellement.");
  }
});

mdpGenereFermer.addEventListener("click", () => {
  modalMdpGenere.classList.add("cache");
  mdpGenereValeur.textContent = "";
});

// ---------- Messages non lus ----------

// Faut-il compter ce message comme non lu ?
function estConversationOuverte(cle) {
  return fenetreActive && cleCache(conversationActuelle) === cle;
}

function incrementerNonLus(cle) {
  if (estConversationOuverte(cle)) return;
  nonLus[cle] = (nonLus[cle] || 0) + 1;
  rafraichirBadges();
  majTitreOnglet();
}

function marquerCommeLu(conv) {
  const cle = cleCache(conv);
  if (nonLus[cle]) {
    delete nonLus[cle];
    rafraichirBadges();
    majTitreOnglet();
  }
}

// Place ou retire les pastilles de compteur dans la barre latérale
function rafraichirBadges() {
  // Salons
  listeSalonsDiv.querySelectorAll("[data-salon-id]").forEach(el => {
    poserBadge(el, nonLus["salon:" + el.dataset.salonId]);
  });

  // Groupes
  listeGroupes.querySelectorAll("[data-groupe-id]").forEach(el => {
    poserBadge(el, nonLus["groupe:" + Number(el.dataset.groupeId)]);
  });

  // Messages privés
  listeUtilisateursDiv.querySelectorAll("[data-pseudo]").forEach(el => {
    poserBadge(el, nonLus["prive:" + el.dataset.pseudo]);
  });
}

function poserBadge(element, nombre) {
  const existant = element.querySelector(".badge-nonlus");
  if (existant) existant.remove();

  if (!nombre) {
    element.classList.remove("a-des-nonlus");
    return;
  }

  element.classList.add("a-des-nonlus");
  const badge = document.createElement("span");
  badge.classList.add("badge-nonlus");
  badge.textContent = nombre > 99 ? "99+" : nombre;
  element.appendChild(badge);
}

// Affiche le total dans le titre de l'onglet
function majTitreOnglet() {
  if (typeof majNotifications === "function") majNotifications();
  const total = Object.values(nonLus).reduce((a, b) => a + b, 0);
  document.title = total > 0
    ? `(${total}) Ma Messagerie`
    : "Elfthero Message - Messagerie instantanée gratuite";
}

// ---------- Indicateur "est en train d'écrire" ----------

// Prévient les autres qu'on écrit, sans spammer le serveur
function signalerFrappe() {
  if (!socket || conversationActuelle.type === "salon" && conversationActuelle.id === "radio2") return;

  const contexte = conversationActuelle.type === "salon" ? "salon" : conversationActuelle.type;

  if (!frappeEnvoyee) {
    socket.emit("frappe", { contexte, id: conversationActuelle.id, actif: true });
    frappeEnvoyee = true;
  }

  clearTimeout(minuteurFrappe);
  minuteurFrappe = setTimeout(() => {
    socket.emit("frappe", { contexte, id: conversationActuelle.id, actif: false });
    frappeEnvoyee = false;
  }, 2500);
}

function arreterFrappe() {
  if (!socket || !frappeEnvoyee) return;
  const contexte = conversationActuelle.type === "salon" ? "salon" : conversationActuelle.type;
  socket.emit("frappe", { contexte, id: conversationActuelle.id, actif: false });
  frappeEnvoyee = false;
  clearTimeout(minuteurFrappe);
}

function cleFrappe(contexte, id) {
  return contexte + ":" + id;
}

function majIndicateurFrappe() {
  const cle = cleFrappe(
    conversationActuelle.type === "salon" ? "salon" : conversationActuelle.type,
    conversationActuelle.id
  );

  const liste = enTrainDEcrire[cle] ? Object.keys(enTrainDEcrire[cle]) : [];

  if (liste.length === 0) {
    indicateurFrappe.classList.add("cache");
    indicateurFrappe.textContent = "";
    return;
  }

  let texte;
  if (liste.length === 1) {
    texte = `${liste[0]} est en train d'écrire`;
  } else if (liste.length === 2) {
    texte = `${liste[0]} et ${liste[1]} sont en train d'écrire`;
  } else {
    texte = `${liste.length} personnes sont en train d'écrire`;
  }

  indicateurFrappe.innerHTML =
    `<span class="points-frappe"><i></i><i></i><i></i></span> ${texte}`;
  indicateurFrappe.classList.remove("cache");
}

// ---------- Zone de saisie extensible ----------

// Recalcule la hauteur pour coller au contenu
function ajusterHauteurSaisie() {
  messageInput.style.height = "auto";
  messageInput.style.height = messageInput.scrollHeight + "px";
}

messageInput.addEventListener("input", () => {
  ajusterHauteurSaisie();
  signalerFrappe();
  majCompteurCaracteres();
});

// Entrée passe simplement à la ligne : l'envoi se fait uniquement
// via le bouton "Envoyer" (comportement natif du textarea, rien à intercepter)

// ---------- GROUPES ----------

function afficherMesGroupes(donnees) {
  mesGroupes = donnees.groupes;
  invitationsEnAttente = donnees.invitations || [];
  if (typeof majNotifications === "function") majNotifications();

  // Invitations en attente
  listeInvitations.innerHTML = "";
  donnees.invitations.forEach(inv => {
    const bloc = document.createElement("div");
    bloc.classList.add("invitation");

    const texte = document.createElement("div");
    texte.classList.add("invitation-texte");
    texte.textContent = `${inv.invite_par} t'invite dans "${inv.titre}"`;

    const actions = document.createElement("div");
    actions.classList.add("invitation-actions");

    const oui = document.createElement("button");
    oui.textContent = "Accepter";
    oui.addEventListener("click", () => {
      socket.emit("repondre_invitation", { groupeId: inv.groupe_id, accepter: true });
    });

    const non = document.createElement("button");
    non.textContent = "Refuser";
    non.classList.add("secondaire");
    non.addEventListener("click", () => {
      socket.emit("repondre_invitation", { groupeId: inv.groupe_id, accepter: false });
    });

    actions.append(oui, non);
    bloc.append(texte, actions);
    listeInvitations.appendChild(bloc);
  });

  // Liste des groupes
  listeGroupes.innerHTML = "";

  if (donnees.groupes.length === 0) {
    const vide = document.createElement("div");
    vide.classList.add("groupe-vide");
    vide.textContent = "Aucun groupe";
    listeGroupes.appendChild(vide);
    return;
  }

  donnees.groupes.forEach(g => {
    const item = document.createElement("div");
    item.classList.add("salon-item");
    item.dataset.groupeId = g.id;

    const nom = document.createElement("span");
    nom.textContent = "👥 " + g.titre;
    item.appendChild(nom);

    if (g.statut === "en_attente") {
      item.classList.add("en-attente");
      const badge = document.createElement("span");
      badge.classList.add("badge-attente");
      badge.textContent = "en attente";
      item.appendChild(badge);
    }

    item.addEventListener("click", () => ouvrirGroupe(g.id));
    listeGroupes.appendChild(item);
  });

  if (typeof rafraichirBadges === "function") rafraichirBadges();

  rafraichirBadges();

  // Rétablit le marquage si un groupe est ouvert
  if (conversationActuelle.type === "groupe") {
    const actif = listeGroupes.querySelector(`[data-groupe-id="${conversationActuelle.id}"]`);
    if (actif) actif.classList.add("actif");
  }
}

function ouvrirGroupe(id) {
  const groupe = mesGroupes.find(g => g.id === id);
  if (!groupe) return;

  if (typeof fermerTousLesPanneaux === "function") fermerTousLesPanneaux();

  arreterFrappe();
  conversationActuelle = { type: "groupe", id };
  marquerCommeLu(conversationActuelle);
  titreConversation.textContent = "👥 " + groupe.titre;
  majIndicateurFrappe();

  const item = listeGroupes.querySelector(`[data-groupe-id="${id}"]`);
  if (item) marquerActif(item);

  majFondCubes();
  forumBox.classList.add("cache");
  chatBox.classList.remove("cache");

  const enAttente = groupe.statut === "en_attente";

  btnInviter.classList.toggle("cache", enAttente);
  btnQuitterGroupe.classList.remove("cache");

  messageInput.disabled = enAttente;
  btnEnvoyer.disabled = enAttente;
  btnImage.disabled = enAttente;
  btnEmoji.disabled = enAttente;
  messageInput.placeholder = enAttente
    ? "En attente de validation par un modérateur"
    : "Écris un message...";

  if (enAttente) {
    messagesDiv.innerHTML = "<p class=\"info-vide\">Ce groupe attend la validation d'un modérateur. Il sera supprimé automatiquement après 7 jours sans réponse.</p>";
    return;
  }

  const cle = "groupe:" + id;
  if (cacheMessages[cle]) {
    afficherMessages(cacheMessages[cle]);
  } else {
    messagesDiv.innerHTML = "";
    socket.emit("demander_historique_groupe", { groupeId: id });
  }
}

// Cache les boutons de groupe quand on quitte un groupe
function masquerActionsGroupe() {
  btnInviter.classList.add("cache");
  btnQuitterGroupe.classList.add("cache");
}

async function chargerGroupesEnAttente() {
  listeGroupesAttente.innerHTML = "<p class=\"info-vide\">Chargement...</p>";

  try {
    const reponse = await fetch("/admin/groupes-en-attente");
    const data = await reponse.json();

    listeGroupesAttente.innerHTML = "";

    if (!data.groupes || data.groupes.length === 0) {
      listeGroupesAttente.innerHTML = "<p class=\"info-vide\">Aucun groupe en attente.</p>";
      return;
    }

    data.groupes.forEach(g => {
      const ligne = document.createElement("div");
      ligne.classList.add("ligne-admin");

      const infos = document.createElement("div");
      const restant = 7 - g.jours_ecoules;
      infos.innerHTML = `<strong>${g.titre}</strong><br>` +
        `<span class="pub-meta">par ${g.createur} · expire dans ${restant} jour(s)</span>`;

      const actions = document.createElement("div");
      actions.classList.add("actions-admin");

      const valider = document.createElement("button");
      valider.textContent = "Valider";
      valider.addEventListener("click", () => repondreGroupe(g.id, true, g.titre));

      const refuser = document.createElement("button");
      refuser.textContent = "Refuser";
      refuser.classList.add("danger");
      refuser.addEventListener("click", () => repondreGroupe(g.id, false, g.titre));

      actions.append(valider, refuser);
      ligne.append(infos, actions);
      listeGroupesAttente.appendChild(ligne);
    });
  } catch (err) {
    listeGroupesAttente.innerHTML = "<p class=\"info-vide\">Erreur de chargement.</p>";
  }
}

async function repondreGroupe(id, accepter, titre) {
  if (!accepter && !confirm(`Refuser et supprimer le groupe "${titre}" ?`)) return;

  const reponse = await fetch("/admin/valider-groupe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, accepter })
  });

  const data = await reponse.json();
  if (data.succes) {
    groupesAValider = Math.max(0, groupesAValider - 1);
    majNotifications();
    chargerGroupesEnAttente();
  } else {
    alert(data.erreur || "Erreur.");
  }
}

// ---------- Fond animé (motifs) ----------

const fondCubes = document.getElementById("fond-cubes");

// Génère le motif choisi dans le conteneur d'arrière-plan
function construireMotif() {
  if (!fondCubes) return;

  fondCubes.innerHTML = "";
  fondCubes.className = fondCubes.classList.contains("cache") ? "cache" : "";
  fondCubes.classList.add("motif-" + perso.motif);

  const petitEcran = window.innerWidth < 700;

  switch (perso.motif) {
    case "cubes": {
      const taille = petitEcran ? 5 : 7;
      const scene = document.createElement("div");
      scene.classList.add("cubes-scene");
      scene.style.gridTemplateColumns = `repeat(${taille}, 1fr)`;
      scene.style.gridTemplateRows = `repeat(${taille}, 1fr)`;

      const faces = ["top", "bottom", "left", "right", "front", "back"];

      for (let l = 0; l < taille; l++) {
        for (let c = 0; c < taille; c++) {
          const cube = document.createElement("div");
          cube.classList.add("cube");
          cube.style.setProperty("--taille", "100%");
          cube.style.animationDelay = ((l + c) * 0.18) + "s";
          faces.forEach(nom => {
            const face = document.createElement("div");
            face.classList.add("cube-face", "cube-face--" + nom);
            cube.appendChild(face);
          });
          scene.appendChild(cube);
        }
      }
      fondCubes.appendChild(scene);
      break;
    }

    case "points":
    case "grille":
    case "diagonales":
    case "hexagones":
      // Ces motifs sont entièrement gérés en CSS
      break;

    case "vagues": {
      for (let i = 0; i < 4; i++) {
        const vague = document.createElement("div");
        vague.classList.add("vague");
        vague.style.animationDelay = (i * 1.6) + "s";
        vague.style.top = (18 + i * 20) + "%";
        fondCubes.appendChild(vague);
      }
      break;
    }

    case "etoiles": {
      const nombre = petitEcran ? 26 : 44;
      for (let i = 0; i < nombre; i++) {
        const etoile = document.createElement("div");
        etoile.classList.add("etoile");
        etoile.style.left = Math.random() * 100 + "%";
        etoile.style.top = Math.random() * 100 + "%";
        etoile.style.animationDelay = (Math.random() * 4) + "s";
        etoile.style.animationDuration = (2.5 + Math.random() * 2.5) + "s";
        const taille = 2 + Math.random() * 3;
        etoile.style.width = taille + "px";
        etoile.style.height = taille + "px";
        fondCubes.appendChild(etoile);
      }
      break;
    }

    case "pluie": {
      const colonnes = petitEcran ? 12 : 22;
      for (let i = 0; i < colonnes; i++) {
        const trainee = document.createElement("div");
        trainee.classList.add("trainee");
        trainee.style.left = (i / colonnes) * 100 + "%";
        trainee.style.animationDelay = (Math.random() * 5) + "s";
        trainee.style.animationDuration = (3.5 + Math.random() * 4) + "s";
        fondCubes.appendChild(trainee);
      }
      break;
    }

    case "bulles": {
      const nombre = petitEcran ? 10 : 18;
      for (let i = 0; i < nombre; i++) {
        const bulle = document.createElement("div");
        bulle.classList.add("bulle-fond");
        const taille = 14 + Math.random() * 46;
        bulle.style.width = taille + "px";
        bulle.style.height = taille + "px";
        bulle.style.left = Math.random() * 100 + "%";
        bulle.style.animationDelay = (Math.random() * 9) + "s";
        bulle.style.animationDuration = (9 + Math.random() * 9) + "s";
        fondCubes.appendChild(bulle);
      }
      break;
    }

    case "cercles": {
      for (let i = 0; i < 5; i++) {
        const onde = document.createElement("div");
        onde.classList.add("onde");
        onde.style.animationDelay = (i * 1.5) + "s";
        fondCubes.appendChild(onde);
      }
      break;
    }

    case "particules": {
      const nombre = petitEcran ? 16 : 30;
      for (let i = 0; i < nombre; i++) {
        const p = document.createElement("div");
        p.classList.add("particule");
        p.style.left = Math.random() * 100 + "%";
        p.style.top = Math.random() * 100 + "%";
        p.style.animationDelay = (Math.random() * 8) + "s";
        p.style.animationDuration = (7 + Math.random() * 8) + "s";
        fondCubes.appendChild(p);
      }
      break;
    }
  }
}

// Affiche le fond uniquement dans Radio 1
function majFondCubes() {
  if (!fondCubes) return;

  const actif =
    perso.motif !== "aucun" &&
    conversationActuelle.type === "salon" &&
    conversationActuelle.id === "radio1";

  if (actif) {
    if (!fondCubes.firstChild || fondCubes.dataset.motif !== perso.motif) {
      construireMotif();
      fondCubes.dataset.motif = perso.motif;
    }
    fondCubes.classList.remove("cache");
  } else {
    fondCubes.classList.add("cache");
  }
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
  carte.classList.add("cat-" + (pub.categorie || "horreur"));
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

  if (pub.titre) {
    const titre = document.createElement("div");
    titre.classList.add("pub-titre");
    titre.textContent = pub.titre;
    corps.appendChild(titre);
  }

  // Pour les posts, on montre un aperçu du contenu directement dans la carte
  if ((pub.categorie === "post") && pub.contenu) {
    const apercu = document.createElement("div");
    apercu.classList.add("pub-apercu-texte");
    apercu.textContent = pub.contenu.length > 260
      ? pub.contenu.slice(0, 260) + "…"
      : pub.contenu;
    corps.appendChild(apercu);
  }

  const meta = document.createElement("div");
  meta.classList.add("pub-meta");
  const quand = typeof formaterDate === "function" ? formaterDate(pub.date) : "";
  meta.textContent = `par ${pub.auteur}${quand ? " · " + quand : ""} · 💬 ${pub.nb_commentaires}`;

  corps.appendChild(meta);

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

// Met en forme la date d'un message selon son ancienneté
function formaterDate(iso) {
  if (!iso) return "";

  const date = new Date(iso);
  const maintenant = new Date();

  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const memeJour = date.toDateString() === maintenant.toDateString();
  if (memeJour) return heure;

  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  if (date.toDateString() === hier.toDateString()) return "Hier " + heure;

  // Moins d'une semaine : on affiche le jour
  const joursEcoules = (maintenant - date) / (1000 * 60 * 60 * 24);
  if (joursEcoules < 7) {
    const jour = date.toLocaleDateString("fr-FR", { weekday: "long" });
    return jour.charAt(0).toUpperCase() + jour.slice(1) + " " + heure;
  }

  // Au-delà : date complète
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " + heure;
}

// Formate une date : heure seule si aujourd'hui, sinon date + heure
function formaterDate(iso) {
  if (!iso) return "";

  const date = new Date(iso);
  const maintenant = new Date();

  const heure = date.toLocaleTimeString("fr-BE", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const memeJour =
    date.getDate() === maintenant.getDate() &&
    date.getMonth() === maintenant.getMonth() &&
    date.getFullYear() === maintenant.getFullYear();

  if (memeJour) return heure;

  const hier = new Date(maintenant);
  hier.setDate(hier.getDate() - 1);
  const estHier =
    date.getDate() === hier.getDate() &&
    date.getMonth() === hier.getMonth() &&
    date.getFullYear() === hier.getFullYear();

  if (estHier) return "Hier " + heure;

  return date.toLocaleDateString("fr-BE", {
    day: "2-digit",
    month: "2-digit"
  }) + " " + heure;
}

function ajouterMessageAffiche(data) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("message");
  messageEl.classList.add(data.auteur === monPseudo ? "mine" : "other");

  // Icône et nom de l'auteur
  const entete = document.createElement("span");
  entete.classList.add("message-entete");

  const avatar = document.createElement("span");
  avatar.classList.add("avatar-conteneur");
  avatar.dataset.avatarDe = data.auteur;
  avatar.dataset.avatarTaille = "22";
  avatar.innerHTML = dessinerAvatar(avatarsConnus[data.auteur], 22);

  const auteurEl = document.createElement("span");
  auteurEl.classList.add("auteur");
  auteurEl.textContent = data.auteur;

  entete.append(avatar, auteurEl);
  messageEl.appendChild(entete);

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

  // Heure du message
  if (data.date) {
    const heureEl = document.createElement("span");
    heureEl.classList.add("heure-message");
    heureEl.textContent = formaterDate(data.date);
    heureEl.title = new Date(data.date).toLocaleString("fr-FR");
    messageEl.appendChild(heureEl);
  }

  // Heure du message
  if (data.date) {
    const heure = document.createElement("span");
    heure.classList.add("heure-message");
    heure.textContent = formaterDate(data.date);
    heure.title = new Date(data.date).toLocaleString("fr-BE");
    messageEl.appendChild(heure);
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
    // Quota d'images épuisé : on affiche le compte à rebours
    if (data.limiteImages) {
      afficherLimite(
        "🖼️ Limite d'images atteinte",
        "Tu peux envoyer 3 images par tranche de 30 minutes. Prochaine image possible dans :",
        data.secondes
      );
      throw new Error("__limite_images__");
    }
    throw new Error(data.erreur || "Erreur lors de l'envoi.");
  }

  return data.url;
}

function demarrerChat() {
  socket = io();

  if (retourBtn) retourBtn.classList.add("cache");

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
        if (err.message !== "__limite_images__") alert(err.message);
        btnEnvoyer.disabled = false;
        btnEnvoyer.textContent = "Envoyer";
        return;
      }

      btnEnvoyer.disabled = false;
      btnEnvoyer.textContent = "Envoyer";
    }

    if (conversationActuelle.type === "salon") {
      socket.emit("message_public", { texte, imageUrl, salon: conversationActuelle.id });
    } else if (conversationActuelle.type === "groupe") {
      socket.emit("message_groupe", { groupeId: conversationActuelle.id, texte, imageUrl });
    } else {
      socket.emit("message_prive", { destinataire: conversationActuelle.id, texte, imageUrl });
    }

    messageInput.value = "";
    ajusterHauteurSaisie();
    majCompteurCaracteres();
    arreterFrappe();
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

    // On ne se notifie pas soi-même
    if (message.auteur !== monPseudo) incrementerNonLus(cle);
  });

  // Erreur d'envoi (ex : salon réservé aux admins)
  socket.on("erreur_envoi", (data) => {
    alert(data.message);
    pubErreur.textContent = data.message;
  });

  // Limite atteinte, signalée par le serveur
  socket.on("limite_atteinte", (data) => {
    if (data.type === "longueur") {
      afficherLimite("✂️ Message trop long", data.message, 0);
    } else {
      afficherLimite("⏳ Doucement", data.message, data.secondes);
    }
  });

  // ----- Présence et frappe -----

  socket.on("presence", (data) => {
    personnesEnLigne = new Set(data.enLigne);
    afficherListeUtilisateurs();
    if (typeof afficherConversations === "function") afficherConversations();
  });

  // Quelqu'un a modifié son icône
  socket.on("avatar_maj", (data) => {
    avatarsConnus[data.pseudo] = data.avatar;
    rafraichirAvatarsAffiches();
  });

  socket.on("frappe", (data) => {
    const cle = cleFrappe(data.contexte, data.id);

    if (!enTrainDEcrire[cle]) enTrainDEcrire[cle] = {};

    if (data.actif) {
      // Filet de sécurité : on efface au bout de 5s même sans signal d'arrêt
      clearTimeout(enTrainDEcrire[cle][data.pseudo]);
      enTrainDEcrire[cle][data.pseudo] = setTimeout(() => {
        delete enTrainDEcrire[cle][data.pseudo];
        majIndicateurFrappe();
      }, 5000);
    } else {
      clearTimeout(enTrainDEcrire[cle][data.pseudo]);
      delete enTrainDEcrire[cle][data.pseudo];
    }

    majIndicateurFrappe();
  });

  // ----- Événements des groupes -----

  socket.on("mes_groupes", afficherMesGroupes);

  socket.on("historique_groupe", (data) => {
    cacheMessages["groupe:" + data.groupeId] = data.messages;
    if (conversationActuelle.type === "groupe" && conversationActuelle.id === data.groupeId) {
      afficherMessages(data.messages);
    }
  });

  socket.on("message_groupe", (data) => {
    const cle = "groupe:" + data.groupeId;
    if (!cacheMessages[cle]) cacheMessages[cle] = [];
    cacheMessages[cle].push(data.message);

    if (conversationActuelle.type === "groupe" && conversationActuelle.id === data.groupeId) {
      ajouterMessageAffiche(data.message);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    if (data.message.auteur !== monPseudo) incrementerNonLus(cle);
  });

  socket.on("groupe_cree", () => {
    modalGroupe.classList.add("cache");
    alert("Groupe créé. Un modérateur doit valider sa création avant qu'il soit utilisable.");
  });

  socket.on("nouvelle_invitation", () => {
    socket.emit("demander_mes_groupes");
  });

  socket.on("groupe_valide", () => {
    socket.emit("demander_mes_groupes");
  });

  socket.on("groupe_supprime", (data) => {
    socket.emit("demander_mes_groupes");
    if (conversationActuelle.type === "groupe" && conversationActuelle.id === data.id) {
      ouvrirSalon("radio1");
    }
  });

  socket.on("demande_groupe_en_attente", () => {
    if (jeSuisAdmin) {
      fetch("/admin/groupes-en-attente")
        .then(r => r.json())
        .then(d => {
          groupesAValider = (d.groupes || []).length;
          majNotifications();
        })
        .catch(() => {});
    }
    if (jeSuisAdmin && !modalGroupesAttente.classList.contains("cache")) {
      chargerGroupesEnAttente();
    }
  });

  // ----- Interactions des groupes -----

  btnCreerGroupe.addEventListener("click", () => {
    groupeTitre.value = "";
    groupeErreur.textContent = "";
    modalGroupe.classList.remove("cache");
    groupeTitre.focus();
  });

  groupeFermer.addEventListener("click", () => modalGroupe.classList.add("cache"));

  groupeCreer.addEventListener("click", () => {
    const titre = groupeTitre.value.trim();
    if (!titre) {
      groupeErreur.textContent = "Le nom du groupe est obligatoire.";
      return;
    }
    socket.emit("creer_groupe", { titre });
  });

  groupeTitre.addEventListener("keydown", (e) => {
    if (e.key === "Enter") groupeCreer.click();
  });

  btnInviter.addEventListener("click", () => {
    inviterPseudo.value = "";
    inviterErreur.textContent = "";
    modalInviter.classList.remove("cache");
    inviterPseudo.focus();
  });

  inviterFermer.addEventListener("click", () => modalInviter.classList.add("cache"));

  inviterEnvoyer.addEventListener("click", () => {
    const pseudo = inviterPseudo.value.trim();
    if (!pseudo || conversationActuelle.type !== "groupe") return;

    socket.emit("inviter_groupe", {
      groupeId: conversationActuelle.id,
      pseudo
    });

    inviterPseudo.value = "";
  });

  inviterPseudo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") inviterEnvoyer.click();
  });

  btnQuitterGroupe.addEventListener("click", () => {
    if (conversationActuelle.type !== "groupe") return;
    if (!confirm("Quitter ce groupe ?")) return;

    socket.emit("quitter_groupe", { groupeId: conversationActuelle.id });
    ouvrirSalon("radio1");
  });

  btnGroupesAttente.addEventListener("click", () => {
    modalGroupesAttente.classList.remove("cache");
    chargerGroupesEnAttente();
  });

  fermerGroupesAttente.addEventListener("click", () => {
    modalGroupesAttente.classList.add("cache");
  });

  // Charge les groupes au démarrage
  socket.emit("demander_mes_groupes");

  // ----- Événements du forum -----

  socket.on("liste_publications", (data) => {
    if (conversationActuelle.type === "salon" && conversationActuelle.id === data.salon) {
      afficherPublications(data.publications);
    }
  });

  socket.on("nouvelle_publication", (data) => {
    // On n'ajoute que si la catégorie affichée correspond
    if (data.categorie && data.categorie !== categorieActuelle) return;

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

  // Onglets de catégorie
  document.querySelectorAll(".onglet-cat").forEach(onglet => {
    onglet.addEventListener("click", () => {
      document.querySelectorAll(".onglet-cat").forEach(o => o.classList.remove("actif"));
      onglet.classList.add("actif");

      categorieActuelle = onglet.dataset.cat;
      categorieNouvellePub = categorieActuelle;

      btnNouvellePub.textContent = categorieActuelle === "horreur"
        ? "✍️ Écrire une histoire"
        : "💬 Publier un post";

      listePublications.innerHTML = "<p class=\"info-vide\">Chargement...</p>";
      socket.emit("demander_publications", {
        salon: "radio2",
        categorie: categorieActuelle,
        tri: triActuel
      });
    });
  });

  // Boutons de tri
  document.querySelectorAll(".btn-tri").forEach(bouton => {
    bouton.addEventListener("click", () => {
      document.querySelectorAll(".btn-tri").forEach(b => b.classList.remove("actif"));
      bouton.classList.add("actif");

      triActuel = bouton.dataset.tri;

      listePublications.innerHTML = "<p class=\"info-vide\">Chargement...</p>";
      socket.emit("demander_publications", {
        salon: "radio2",
        categorie: categorieActuelle,
        tri: triActuel
      });
    });
  });

  // Choix de la catégorie dans la fenêtre de création
  document.querySelectorAll(".choix-cat").forEach(bouton => {
    bouton.addEventListener("click", () => {
      document.querySelectorAll(".choix-cat").forEach(b => b.classList.remove("actif"));
      bouton.classList.add("actif");
      categorieNouvellePub = bouton.dataset.cat;
      majFormulairePublication();
    });
  });

  btnNouvellePub.addEventListener("click", () => {
    pubTitre.value = "";
    pubContenu.value = "";
    pubErreur.textContent = "";
    reinitialiserImagePub();

    // La catégorie du formulaire suit l'onglet actif
    categorieNouvellePub = categorieActuelle;
    document.querySelectorAll(".choix-cat").forEach(b => {
      b.classList.toggle("actif", b.dataset.cat === categorieNouvellePub);
    });
    majFormulairePublication();

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

  pubContenu.addEventListener("input", () => {
    const longueur = pubContenu.value.length;
    if (longueur > LIMITE_PUBLICATION - 300) {
      pubErreur.textContent = longueur > LIMITE_PUBLICATION
        ? `Trop long : ${longueur} / ${LIMITE_PUBLICATION} caractères`
        : `${longueur} / ${LIMITE_PUBLICATION} caractères`;
      pubErreur.classList.toggle("depasse", longueur > LIMITE_PUBLICATION);
    } else {
      pubErreur.textContent = "";
      pubErreur.classList.remove("depasse");
    }
  });

  pubPublier.addEventListener("click", async () => {
    const titre = pubTitre.value.trim();

    if (categorieNouvellePub === "horreur" && !titre) {
      pubErreur.textContent = "Le titre est obligatoire pour une histoire.";
      return;
    }

    if (categorieNouvellePub === "post" && !titre && !pubContenu.value.trim() && !pubFichierSelectionne) {
      pubErreur.textContent = "Ton post est vide.";
      return;
    }

    if (pubContenu.value.length > LIMITE_PUBLICATION) {
      pubErreur.textContent = `Histoire trop longue : ${pubContenu.value.length} / ${LIMITE_PUBLICATION} caractères.`;
      return;
    }

    let imageUrl = null;
    pubPublier.disabled = true;
    pubPublier.textContent = "Publication...";

    if (pubFichierSelectionne) {
      try {
        imageUrl = await envoyerImage(pubFichierSelectionne);
      } catch (err) {
        if (err.message !== "__limite_images__") pubErreur.textContent = err.message;
        pubPublier.disabled = false;
        pubPublier.textContent = "Publier";
        return;
      }
    }

    socket.emit("creer_publication", {
      salon: conversationActuelle.id,
      categorie: categorieNouvellePub,
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

  // Un compte a été supprimé : on rafraîchit la liste des contacts
  socket.on("compte_supprime", (data) => {
    if (data.pseudo === monPseudo) {
      alert("Votre compte a été supprimé.");
      window.location.href = "/connexion.html";
      return;
    }

    chargerListeUtilisateurs();

    // Si on discutait avec cette personne, on revient sur Radio 1
    if (conversationActuelle.type === "prive" && conversationActuelle.id === data.pseudo) {
      ouvrirSalon("radio1");
    }

    delete cacheMessages["prive:" + data.pseudo];
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

    if (data.message.auteur !== monPseudo) {
      incrementerNonLus(cle);

      conversationsOuvertes.add(data.avec);
      afficherConversations();

      // Si la personne n'est pas encore dans la liste, on la recharge
      const connu = tousLesUtilisateurs.some(u => u.pseudo === data.avec);
      if (!connu) chargerListeUtilisateurs();
    }
  });
}

deconnexionBtn.addEventListener("click", async () => {
  await fetch("/deconnexion", { method: "POST" });
  window.location.href = "/connexion.html";
});

verifierConnexion();