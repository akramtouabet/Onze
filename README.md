# Onze — Nouvel onglet

Extension Chrome (Manifest V3) qui remplace la page « Nouvel onglet » : photo du jour, horloge, objectif, tâches, météo, mode Focus, sons d'ambiance, musique et radios, notes, habitudes, synchronisation avec le compte Chrome. Interface en français ou en anglais.

HTML, CSS et JavaScript sans framework ni étape de build. Tout est gratuit et débloqué.

## Arborescence

```
onze/
├── manifest.json          Déclaration de l'extension (permissions, page de nouvel onglet)
├── newtab.html            Structure de la page : widgets, panneaux, réglages
├── popup.html             Fenêtre de l'icône de l'extension : lecteur de musique
├── offscreen.html         Page cachée qui joue la musique, onglet fermé
├── service-worker.js      Notification de fin de session Focus, pilotage de la musique
├── fonts/                 Polices embarquées (10 fichiers .woff2)
├── audio/                 Musique embarquée (lullaby.mp3)
├── css/
│   ├── fonts.css          Déclaration des polices embarquées
│   ├── base.css           Variables, fond, mise en page, boutons, animations
│   ├── widgets.css        Horloge, salutation, objectif, citation, météo, crédit photo
│   ├── panels.css         Panneaux, listes, tâches, réglages
│   └── popup.css          Fenêtre de l'icône
├── js/
│   ├── main.js            Point d'entrée : initialise chaque module
│   ├── storage.js         chrome.storage (sync pour les réglages, local pour les données)
│   ├── utils.js           Utilitaires : DOM, dates, listes réordonnables
│   ├── panels.js          Ouverture et fermeture des panneaux
│   ├── visibility.js      Affichage des widgets (réglages, Focus, Équilibre)
│   ├── settings.js        Réglages, police, couleur d'accent
│   ├── photos.js          Fond d'écran : Unsplash, Picsum, dégradé, favorites, import
│   ├── idb.js             IndexedDB pour les images importées
│   ├── clock.js           Horloge et salutation
│   ├── focus.js           Objectif du jour et mantras
│   ├── quotes.js          Citation du jour, favorites, citations personnelles
│   ├── quotes-data.js     120 citations et proverbes en français
│   ├── quotes-data-en.js  79 citations et proverbes en anglais
│   ├── weather.js         Météo Open-Meteo : actuelle, heure par heure, 7 jours, plusieurs villes
│   ├── search.js          Recherche Google, Bing ou DuckDuckGo
│   ├── todo.js            Tâches : listes, échéances, glisser-déposer, vue agrandie
│   ├── links.js           Liens favoris
│   ├── pomodoro.js        Mode Focus (Pomodoro)
│   ├── sounds.js          Sons d'ambiance générés (Web Audio), choix de la musique
│   ├── music.js           Commande de la musique (nouvel onglet et fenêtre de l'icône)
│   ├── tracks.js          Morceau et radios proposés, par pays
│   ├── music-ui.js        Sélecteur Musique / Radio
│   ├── offscreen.js       Lecteur de la page cachée
│   ├── popup.js           Fenêtre de l'icône
│   ├── i18n.js            Langue de l'interface (traduction de la page)
│   ├── i18n-en.js         Dictionnaire anglais
│   ├── notes.js           Bloc-notes
│   ├── habits.js          Suivi d'habitudes
│   ├── worldclocks.js     Horloges du monde
│   ├── countdowns.js      Comptes à rebours
│   ├── balance.js         Mode Équilibre (horaires de travail)
│   ├── backup.js          Export et import JSON
│   ├── chromesync.js      Synchronisation des données avec le compte Chrome (sans configuration)
│   └── cloud.js           Connexion Google et synchronisation Google Drive (option avancée)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Installation

1. Ouvrez `chrome://extensions` dans Chrome.
2. Activez le **Mode développeur** (en haut à droite).
3. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier de l'extension (celui qui contient `manifest.json`).
4. Ouvrez un nouvel onglet. Chrome demande une fois s'il doit conserver ce changement : choisissez **Conserver**.
5. Saisissez votre prénom sur l'écran d'accueil.

Si une autre extension de nouvel onglet est active, désactivez-la : Chrome n'en accepte qu'une à la fois.

## Prise en main

| Où | Quoi |
|---|---|
| En haut à gauche | Liens, Focus, Outils (sons, notes, habitudes, horloges, échéances), Chercher |
| En haut à droite | Météo |
| Au centre | Horloge, salutation (cliquez sur le prénom pour le modifier), objectif du jour |
| En bas à gauche | Réglages ; au survol : crédit photo, favorite, écarter, changer de photo |
| En bas au centre | Citation ; au survol : auteur, favorite, autre citation |
| En bas à droite | Tâches |

Dans les tâches : double-clic (ou Entrée) pour modifier, glisser-déposer ou Alt + flèches pour réordonner, icône calendrier au survol pour l'échéance, double flèche pour la vue agrandie.

La police, la graisse et la taille de l'horloge, la couleur d'accent et le thème des panneaux se règlent dans **Réglages → Apparence**.

## Musique

**Outils → Sons → Musique et radio** : deux onglets. « Musique » propose « Lullaby » en boucle ; « Radio » propose les stations en direct classées par pays (France : FIP, FIP Jazz, FIP Groove, France Musique ; Autriche : LoungeFM ; Royaume-Uni : Classic FM ; États-Unis : Radio Paradise, Paradise Mellow, KEXP). Une seule source joue à la fois.

La musique est jouée en arrière-plan : elle continue quand vous fermez l'onglet Onze. Pour la changer, régler son volume ou l'arrêter, cliquez sur l'icône Onze dans la barre de Chrome (épinglez-la depuis le menu des extensions, l'icône en forme de pièce de puzzle). Les sons d'ambiance, eux, s'arrêtent avec l'onglet.

## Langue

**Réglages → Général → Langue** : français ou anglais. L'interface et les citations intégrées suivent la langue. Vos propres textes (tâches, notes, citations personnelles) ne sont pas traduits.

Pour ajouter une langue : copiez `js/i18n-en.js` en `js/i18n-xx.js`, traduisez les valeurs, ajoutez `xx` à `LANGS` dans `js/i18n.js` et une option dans le menu Langue de `newtab.html`.

## Synchronisation avec le compte Chrome

Sans rien configurer, vos tâches, notes, habitudes, liens, échéances, horloges, citations et mantras suivent le compte Google connecté à Chrome (**Réglages → Compte et sauvegarde → Synchronisation Chrome**).

Sur un autre ordinateur :

1. Connectez Chrome au même compte Google et activez la synchronisation de Chrome (extensions comprises).
2. Copiez le dossier de l'extension et chargez-le depuis `chrome://extensions`. L'identifiant de l'extension est fixé par le champ `key` du manifest : il est le même partout, ce qui permet à Chrome de partager les données.
3. Les données arrivent en quelques secondes à quelques minutes.

Limites : Chrome accorde environ 100 Ko au total. C'est large pour des tâches et des liens ; de très longues notes peuvent le remplir (les réglages l'indiquent alors). Pour chaque type de donnée, la version modifiée le plus récemment l'emporte.

## Clé Unsplash gratuite (photos par thème)

Sans clé, Onze affiche les « images remarquables » de Wikimedia Commons (photos primées, sous licence libre), selon vos thèmes, avec Lorem Picsum en secours. Une clé Unsplash donne accès à un choix bien plus vaste.

1. Créez un compte sur [unsplash.com/developers](https://unsplash.com/developers) et cliquez sur **Register as a developer**.
2. Ouvrez **Your apps → New Application**, acceptez les conditions d'utilisation de l'API.
3. Donnez un nom et une description à l'application (par exemple « Onze, usage personnel »).
4. Dans la page de l'application, copiez la valeur **Access Key** (pas la Secret Key).
5. Dans Onze : **Réglages → Photos → Clé d'accès Unsplash**, collez la clé.

Une application en mode « Demo » a droit à 50 requêtes par heure, ce qui suffit pour un usage personnel. Avec « À chaque nouvel onglet », chaque onglet consomme une requête.

## Google Drive (option avancée)

Si la synchronisation Chrome ne suffit pas (données volumineuses), Onze peut enregistrer vos données dans l'espace privé de l'application sur votre Google Drive. Ce fichier n'apparaît pas dans vos documents. Google exige un identifiant client OAuth, gratuit, que vous créez une fois.

1. Dans Onze, ouvrez **Réglages → Compte et sauvegarde → Google Drive (avancé)** et copiez l'**URI de redirection** affichée (de la forme `https://xxxxxxxx.chromiumapp.org/`).
2. Ouvrez [console.cloud.google.com](https://console.cloud.google.com) et créez un projet (par exemple « Onze »).
3. **API et services → Bibliothèque** : cherchez **Google Drive API** et cliquez sur **Activer**.
4. **API et services → Écran de consentement OAuth** : type **Externe**, renseignez le nom de l'application et votre adresse e-mail, puis ajoutez votre adresse dans **Utilisateurs tests**.
5. **API et services → Identifiants → Créer des identifiants → ID client OAuth** :
   - Type d'application : **Application Web**.
   - **URI de redirection autorisés** : collez l'URI copiée à l'étape 1.
6. Copiez l'**ID client** (il se termine par `.apps.googleusercontent.com`).
7. Dans Onze, collez-le dans **Identifiant client OAuth**, puis cliquez sur **Se connecter avec Google**.

À savoir :

- L'URI de redirection est la même sur tous vos ordinateurs (identifiant d'extension fixe) : réutilisez simplement le même ID client.
- Fusion : pour chaque type de donnée (les tâches, les notes…), la version modifiée le plus récemment l'emporte. Si vous modifiez vos tâches sur deux appareils sans synchroniser entre-temps, les modifications les plus anciennes sont remplacées.
- Les images importées restent sur l'appareil.

## Sauvegarde manuelle

**Réglages → Compte et sauvegarde → Exporter (JSON)** enregistre réglages et données dans un fichier. **Importer** le recharge sur n'importe quel appareil.

## Remarques techniques

- Aucun script en ligne : la page respecte la politique de sécurité de Manifest V3.
- Les polices (Inter, DM Sans, Plus Jakarta Sans, Outfit, Figtree) sont embarquées dans le dossier `fonts/` et déclarées dans `css/fonts.css` : elles s'affichent hors ligne. Elles sont publiées sous licence SIL Open Font License.
- Musique : « Lullaby » de _ghost ([ccMixter](https://ccmixter.org/files/_ghost/3631)), licence Creative Commons BY-NC 2.5 (usage non commercial, avec mention de l'auteur).
- Services appelés : Unsplash, Wikimedia Commons ou Lorem Picsum (photos), Open-Meteo (météo et recherche de ville), Radio France, LoungeFM, Radio Paradise, Classic FM ou KEXP (radios en direct, seulement si vous en lancez une), Google (connexion et Drive, seulement si vous l'activez).
- Le mode Focus notifie la fin d'une session même si aucun nouvel onglet n'est ouvert, grâce au service worker.

## Crédits

Conçu et développé par **Akram TOUABET** — [www.akramtouabet.com](https://www.akramtouabet.com)
