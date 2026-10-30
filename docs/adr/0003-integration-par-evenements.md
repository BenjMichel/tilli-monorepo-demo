# ADR 0003 : intégration entre contextes par événements

- **Statut** : accepté
- **Date** : 2026-10-30

## Contexte

Les contextes doivent réagir aux faits des autres : une commande passée ouvre une mission, une mission attribuée crée une intervention. Des appels synchrones coupleraient la disponibilité et le modèle des contextes entre eux.

## Décision

- Les contextes communiquent **uniquement** par événements d'intégration asynchrones.
- Ces événements sont définis dans `contracts/`, sous forme de schémas versionnés (`OrderPlaced.v1`). C'est le seul code partagé.
- Chaque contexte distingue ses **événements de domaine** (internes, libres d'évoluer) de ses **événements d'intégration** (publics, stables).
- La publication passe par un **transactional outbox** : l'événement est écrit dans la même transaction que l'agrégat, puis relayé. Un événement ne peut donc être ni perdu ni publié pour une écriture annulée.
- Les consommateurs sont **idempotents**, avec déduplication par identifiant d'événement.
- **Minimisation des données personnelles** : chaque consommateur ne stocke que celles dont il a besoin. Dispatch ne garde pas le contact client, Fulfillment si.

## Conséquences

Ce qu'on gagne :

- Les contextes ne se connaissent pas entre eux et évoluent séparément.
- Le suivi admin se construit en écoutant tous les événements, sans code supplémentaire dans les contextes.

Ce que ça coûte :

- La cohérence est à terme : juste après une commande, la mission peut ne pas encore exister. L'UI doit afficher cet état (« recherche d'un couturier en cours »).
- Il faut tester les contrats (consumer-driven contract tests sur les schémas de `contracts/`).
