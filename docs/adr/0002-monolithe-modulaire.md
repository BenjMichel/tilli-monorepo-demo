# ADR 0002 : monolithe modulaire plutôt que microservices

- **Statut** : accepté
- **Date** : 2026-10-30

## Contexte

Les trois bounded contexts pourraient chacun devenir un service. Mais la démo est maintenue par une seule personne et doit pouvoir être lancée en une commande. Des microservices ajouteraient du coût opérationnel (déploiements, réseau, observabilité distribuée) sans rien prouver de plus sur le modèle.

## Décision

Une seule API déployable (`apps/api`) sert de **composition root**. Chaque contexte est un module isolé (`contexts/<nom>`) qui expose des use cases (couche application) et des handlers d'événements d'intégration.

L'isolation repose sur trois mécanismes :

- l'interdiction d'importer un autre contexte, vérifiée en CI ;
- un schéma (ou préfixe de tables) par contexte en base, sans jointure entre contextes ;
- une communication entre contextes uniquement par événements, via un bus en mémoire puis un outbox.

## Conséquences

Ce qu'on gagne :

- Une seule commande pour lancer, tester et déployer.
- On peut extraire un contexte en service plus tard sans réécrire le domaine, en remplaçant l'adapter du bus.

Ce que ça coûte :

- L'isolation dépend de l'outillage CI. Sans lui, le monolithe modulaire dérive en monolithe tout court.
