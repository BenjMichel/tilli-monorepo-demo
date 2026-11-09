# ADR 0006 : infrastructure sur Cloud Run, décrite avec OpenTofu

- **Statut** : accepté
- **Date** : 2026-11-09

## Contexte

L'API est une seule application Node (monolithe modulaire, [ADR 0002](0002-monolithe-modulaire.md)). Pour l'instant, **tout son état vit en mémoire** : le bus, les outbox, les timers des vagues. La démo doit montrer une infrastructure décrite en code, sécurisée et testée, sans engager de coût ni nécessiter de compte cloud.

## Décision

- **OpenTofu** décrit l'infrastructure. C'est le fork open source de Terraform, avec la même syntaxe HCL.
- **GCP Cloud Run** exécute le conteneur de l'API, avec un **maximum d'une instance** et un arrêt complet quand il n'est pas utilisé.
- Un module réutilisable par brique (`cloud-run-service`, `github-deployer`) et un dossier par environnement (`envs/demo`).
- **GitHub Actions s'authentifie par Workload Identity Federation**. Il n'existe aucune clé de compte de service : seul `main` de ce dépôt peut obtenir des identifiants.
- **Moindre privilège** : chaque service a sa propre identité, et chaque droit du compte de déploiement porte sur une seule ressource, jamais sur tout le projet.
- **Pas de déploiement réel** : la CI valide l'infrastructure contre le schéma du provider, la teste avec `tofu test` sur un **provider simulé**, puis la passe à tflint et à trivy.

## Conséquences

Ce qu'on gagne :

- L'invariant « une seule instance » est **testé** : passer `max_instances` à 2 fait échouer la CI avec un message métier.
- Les règles de sécurité (dépôt et branche autorisés, droits de chaque identité) sont vérifiées comme du code, sans identifiants.
- L'image est minimale : Node distroless, sans shell, un seul fichier JavaScript, un utilisateur non root.

Ce que ça coûte :

- Une seule instance ne tient pas la charge et constitue un point de panne unique. Passer à plusieurs instances exige d'abord de déplacer l'état dans une base de données (repositories et outbox dans Postgres), puis le bus dans un broker ou une table d'outbox partagée.
- Un `tofu plan` réel demande un projet GCP. Les tests sur provider simulé vérifient la configuration, pas le comportement de GCP.
- Quand Cloud Run arrête l'instance faute de trafic, **tout l'état disparaît** : les commandes, les missions, et les timers des vagues en cours. C'est assumé pour une démo, puisque l'arrêt complet ne coûte rien. Garder une instance allumée (`min_instances = 1`) limiterait la perte sans la supprimer, car un redéploiement remet aussi tout à zéro. La vraie réponse passe par la base de données, et par un ordonnanceur persistant (Cloud Tasks ou une table de jobs) pour les vagues.
