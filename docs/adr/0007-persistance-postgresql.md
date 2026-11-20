# ADR 0007 : persistance dans PostgreSQL, un schéma par contexte

- **Statut** : accepté
- **Date** : 2026-11-20

## Contexte

Tout l'état de la démo vit en mémoire : commandes, missions, interventions, outbox, minuteurs de vagues et suivi admin. Un redémarrage efface tout, et une mission en attente de réponse n'expire jamais si son minuteur `setTimeout` est perdu.

Les ports existent déjà dans chaque contexte (`OrderRepository`, `MissionRepository`, `InterventionRepository`, les outbox, `WaveTimer`) et leurs adapters en mémoire imitent déjà une transaction : l'agrégat et ses événements sont écrits ensemble, avec un contrôle de version.

## Décision

- **PostgreSQL**, un **schéma par contexte** (`ordering`, `dispatch`, `fulfillment`), sans clé étrangère ni jointure entre schémas (ADR 0002). Le suivi admin a son propre schéma `admin` : c'est une projection, on peut la vider et la reconstruire.
- **Chaque contexte possède ses adapters et ses migrations** dans `src/infrastructure/postgres/`. Il déclare lui-même le peu qu'il attend d'un driver (`query`, `transaction`) : aucun paquet technique partagé, les contextes ne partagent que `contracts` (ADR 0003).
- **Agrégat stocké en snapshot `jsonb`**, avec une colonne `version` pour le verrouillage optimiste. Des colonnes ou index n'existent que pour ce qui est requêté : `tailor_id` des interventions, index GIN sur les offres des missions. Les dates sont encodées `{"$date": "…"}` pour revenir en `Date`.
- **Outbox transactionnel réel** : une table `outbox` par schéma, écrite dans la même transaction que l'agrégat. Le relais marque une entrée traitée après publication : livraison au moins une fois, consommateurs idempotents (ADR 0003).
- **Minuteurs de vagues en table** (`dispatch.wave_timers`), interrogée toutes les 2 s par l'API. Un minuteur n'est supprimé qu'après succès ; `ExpireWave` ignore déjà les vagues périmées, donc un double déclenchement est sans effet.
- **Migrations SQL versionnées**, appliquées au démarrage de l'API dans une transaction, sous verrou consultatif (`pg_advisory_xact_lock`), et tracées dans `public.schema_migrations`. On n'édite jamais une migration livrée.
- **Driver `pg`** (node-postgres) en production. Les tests utilisent **PGlite**, PostgreSQL compilé en WebAssembly : même SQL, même `jsonb`, sans serveur ni Docker.
- **La mémoire reste le mode par défaut** : sans `DATABASE_URL`, la démo se lance comme avant. Les mêmes tests de contrat valident les deux implémentations de chaque repository.

## Conséquences

Ce qu'on gagne :

- Un redémarrage ne perd plus rien : commandes, propositions en cours, minuteurs, interventions, suivi admin. Les événements non relayés partent au redémarrage.
- Un contexte peut changer de base ou être extrait sans toucher aux autres : son schéma n'est lu par personne d'autre.
- Les tests n'ont besoin ni de Docker ni d'un service en CI.

Ce que ça coûte :

- **Toujours une seule instance** : le relais lit l'outbox sans verrou. Deux instances publieraient certaines entrées en double (sans dégât, puisque les consommateurs sont idempotents) et se gêneraient. Pour en lancer plusieurs, il faudra `FOR UPDATE SKIP LOCKED` sur l'outbox et les minuteurs.
- PGlite n'a qu'une connexion : les tests valident le SQL et le contrôle de version, pas des transactions réellement parallèles. Un test contre un vrai serveur PostgreSQL reste à ajouter en CI.
- Le snapshot `jsonb` évolue avec l'agrégat : renommer un champ demande une migration des données, ou un snapshot versionné.
- Le schéma `fulfillment` contient les coordonnées des clients : ses droits d'accès et sa durée de conservation sont à définir avant la production.
- Les couturiers restent en mémoire, alimentés par le seed (ADR 0005).
