# ViralWorld_rdm — application web déployable (MVP full-stack)

Application web responsive en français, pensée pour mobile et ordinateur. Elle comprend :
- un studio de préparation de vidéos (accroche, structure, hashtags de départ, légende);
- une checklist avant publication;
- un historique de plans dans la session navigateur;
- un backend Express avec un début d'intégration officielle TikTok Login Kit + Display API;
- des statistiques cumulées des vidéos renvoyées par TikTok quand les scopes sont accordés.

## Important : ce qui est prêt et ce qui ne l'est pas
Le projet est une application web exécutable avec serveur et routes TikTok intégrées. La connexion TikTok réelle ne peut pas fonctionner avant que le propriétaire crée une application dans TikTok for Developers, ajoute les clés secrètes et obtienne les autorisations nécessaires. Le code ne peut pas demander l’approbation à la place du propriétaire. Les suggestions sont générées localement (aucune clé IA externe n’est requise). Aucun système ne peut garantir la viralité.

Cette première intégration utilise `user.info.basic` et `video.list`. La publication automatique n'est volontairement pas activée : elle demande l'ajout de Content Posting API, une configuration spécifique et une revue TikTok. Il ne faut pas stocker les secrets dans le navigateur.

## 1. Tester sur ton ordinateur
Prérequis : Node.js 20 ou plus récent.
1. Décompresse le ZIP.
2. Dans le dossier, copie `.env.example` vers `.env`.
3. Dans un terminal, lance `npm install`, puis `npm start`.
4. Ouvre `http://localhost:3000`.
5. Sans clés développeur, le studio de création, la checklist et l’historique local fonctionnent; les fonctions TikTok restent désactivées.

## 2. Préparer la connexion TikTok
1. Ouvre https://developers.tiktok.com/ et connecte-toi à ton compte développeur.
2. Dans Manage apps / Connect an app, crée une application et complète les informations demandées.
3. Ajoute Login Kit et Display API. Demande seulement les scopes nécessaires : `user.info.basic` et `video.list`.
4. Pour un test local, configure le Redirect URI exactement comme ceci :
   `http://localhost:3000/auth/tiktok/callback`
5. Copie le Client Key et le Client Secret dans `.env`. Ne partage jamais le Client Secret.
6. Relance le serveur, puis clique sur « Connecter TikTok ».
7. Pour rendre la connexion accessible au public, utilise une URL HTTPS de production et enregistre le Redirect URI HTTPS exact dans le portail. Soumets l'application à la revue TikTok et attends l'approbation avant de compter sur un accès public.

Documentation officielle :
- https://developers.tiktok.com/docs/en/getting-started-create-an-app
- https://developers.tiktok.com/docs/en/display-api-get-started

## 3. Publier le site sur internet
Tu peux utiliser un hébergeur d'applications Node.js (par exemple Replit ou un autre fournisseur). Étapes générales :
1. Crée un compte sur la plateforme d'hébergement.
2. Importe ce projet (ou charge les fichiers du ZIP).
3. Configure la commande de démarrage : `npm start`.
4. Ajoute les variables d'environnement du fichier `.env.example` dans le panneau Secrets / Environment Variables de l'hébergeur. Ne téléverse pas `.env`.
5. Déploie et récupère l'URL HTTPS publique.
6. Remplace `APP_BASE_URL` et `TIKTOK_REDIRECT_URI` par les URL de production, puis reporte le Redirect URI exact dans TikTok for Developers.
7. Re-teste le parcours de connexion.

Pour conserver les sessions entre redémarrages, configure une base PostgreSQL via `DATABASE_URL` (par exemple un service de base de données compatible). Sans elle, le site utilise la mémoire du serveur et les sessions TikTok peuvent disparaître lorsque l’hébergement redémarre ou se met en veille. Les pages de confidentialité et de conditions incluses sont des modèles à relire et adapter avant toute revue publique TikTok. N’utilise pas de données personnelles réelles tant que les pages et les règles de conservation n’ont pas été vérifiées.

## 4. Paiement / coût
Ne paie pas avant d'avoir testé la version gratuite et vérifié le prix affiché dans ton compte. Le prix dépend de l'hébergeur, de la consommation, du domaine et des options. Si tu es mineur, fais valider tout abonnement et tout paiement par un parent/tuteur. Aucun compte ni paiement n'est créé par ce projet.

## 5. Fonctions à ajouter avant un lancement commercial
- Remplir les coordonnées réelles dans les pages de confidentialité et de conditions; les modèles inclus ne doivent pas être publiés tels quels.
- Configurer une base PostgreSQL durable pour conserver les sessions si l’hébergement redémarre.
- Tester les parcours OAuth, la gestion d’expiration et les erreurs avec une application TikTok approuvée.
- Faire vérifier la sécurité, la confidentialité et les obligations légales avant d’accueillir des utilisateurs publics.

## 6. Limites actuelles
- Pas de base de données ni de comptes utilisateurs pour les utilisateurs de ton site.
- Les plans d'idées et la checklist sont locaux au navigateur.
- Les tendances et hashtags ne sont pas récupérés en temps réel.
- Pas de publication automatique, de gestion publicitaire, de likes artificiels ou de bots.
- Les champs de statistiques TikTok disponibles dépendent de la version API, des scopes, de l'approbation et de l'éligibilité du compte.
- Le score éditorial est indicatif, pas un modèle prédictif.
