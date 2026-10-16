# Envoi des formulaires par e-mail (gratuit, sans serveur)

Le formulaire de devis et le formulaire de contact du site envoient leurs données à un petit script
Google (Google Apps Script). Le script envoie :

- **Devis** : un e-mail à **commande@leraccordement.com** (coordonnées, références, quantités ; « Répondre »
  écrit au client) et une **copie au client** (« Nous avons bien reçu votre demande n° DV-… » + la liste).
- **Contact** : un e-mail à **info@leraccordement.com** et un accusé de réception à l'expéditeur.

Gratuit : jusqu'à 100 e-mails par jour avec un compte Gmail (environ 50 demandes, car chaque demande envoie
2 e-mails). Aucun serveur, rien ne dépend de l'ancien hébergement.

Protections intégrées : champ piège anti-robots, temps de remplissage minimum, validation des champs,
3 demandes maximum par adresse e-mail et par heure, 40 par jour au total.

## 1. Compte Google (5 min)

Créer un compte Gmail dédié, par exemple `formulaires.leraccordement@gmail.com`
(ou utiliser un compte Google existant de l'entreprise). Les e-mails partiront de ce compte.

## 2. Envoyer depuis commande@leraccordement.com (recommandé, 10 min)

Pour que la copie envoyée au client parte de **commande@leraccordement.com** (et non de l'adresse Gmail) :

1. Demander à l'agence les **paramètres SMTP** de la boîte commande@ : serveur SMTP, port (587 ou 465),
   identifiant, mot de passe. Faire de même pour info@ si besoin.
2. Dans Gmail (compte de l'étape 1) : **⚙ → Voir tous les paramètres → Comptes et importation →
   Envoyer des e-mails en tant que → Ajouter une autre adresse e-mail**.
3. Nom : `Le Raccordement`, adresse : `commande@leraccordement.com`, **décocher** « Traiter comme un alias » → Suivant.
4. Saisir les paramètres SMTP de l'agence → Ajouter le compte.
5. Google envoie un code à commande@ : l'ouvrir dans la messagerie habituelle et valider.

Le script détecte cette adresse et l'utilise automatiquement. Sans cette étape, tout fonctionne quand même :
l'e-mail part du compte Gmail et la réponse du client va vers commande@.

## 3. Installer le script (5 min)

1. Ouvrir https://script.google.com avec le compte de l'étape 1 → **Nouveau projet**.
2. Effacer le contenu, coller tout le fichier `google-apps-script.gs`, nommer le projet « Formulaires Le Raccordement », enregistrer.
3. **Déployer → Nouveau déploiement** → icône ⚙ → **Application Web** :
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
4. **Déployer** → autoriser l'accès (Google affiche un avertissement « application non validée » :
   **Paramètres avancés → Accéder à Formulaires Le Raccordement**, c'est votre propre script).
5. Copier l'**URL de l'application Web** (elle se termine par `/exec`).

## 4. Brancher le site

Mettre cette URL dans `js/config.js` :

```js
appsScriptUrl: 'https://script.google.com/macros/s/……/exec',
```

puis publier. (Claude s'en charge si vous lui envoyez l'URL ; elle n'est pas secrète.)

## 5. Tester

Envoyer une demande de devis depuis le site avec votre propre adresse e-mail : vous devez recevoir la copie,
et commande@ la demande complète. En cas de souci : script.google.com → le projet → **Exécutions** affiche les erreurs.

## Modifier le script plus tard

Après chaque modification du script : **Déployer → Gérer les déploiements → ✏️ → Version : Nouvelle version → Déployer**.
L'URL reste la même.
