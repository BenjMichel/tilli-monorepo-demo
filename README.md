# Tilli : monorepo de démonstration

Refonte partielle de la plateforme Tilli (retouches de vêtements à domicile par des couturiers indépendants) pour illustrer :

- le **DDD stratégique** : sous-domaines, bounded contexts, context map
- le **DDD tactique** et la **Clean Architecture** : agrégats, ports/adapters, inversion de dépendances
- une **stratégie de tests** par couche
- l'**infrastructure as code**

Le dépôt ne réimplémente qu'un parcours de bout en bout :

1. Sur le **site**, un client passe commande en 2 étapes (vêtements et retouches, puis coordonnées).
2. Dans l'**app couturier**, plusieurs couturiers reçoivent la proposition de mission. Le premier qui accepte la suit jusqu'au bout.
3. Dans l'**admin**, l'équipe ops suit l'avancement des commandes.
4. L'**API** relie l'ensemble.

## Pourquoi cette refonte

Dans le système d'origine, une seule entité `Order` porte plus de 40 états : `ACTIVATION`, `WAITING_COUTURIER_ANSWER`, `RDV_1`, `PACKAGE_*`, `RETAIL_*`… Le mot « commande » y désigne à la fois la demande du client, la mission proposée aux couturiers et le travail réalisé. Ce dépôt sépare ces trois sens en trois bounded contexts.

## Documentation

| Étape | Document |
|---|---|
| Vision | [docs/00-vision.md](docs/00-vision.md) |
| Event Storming | [docs/01-event-storming.md](docs/01-event-storming.md) |
| Sous-domaines | [docs/02-subdomains.md](docs/02-subdomains.md) |
| Bounded contexts | [Ordering](docs/03-bounded-contexts/ordering.md) · [Dispatch](docs/03-bounded-contexts/dispatch.md) · [Fulfillment](docs/03-bounded-contexts/fulfillment.md) |
| Context map | [docs/04-context-map.md](docs/04-context-map.md) |
| Décisions | [docs/adr/](docs/adr/) |

## Structure et commandes

| Dossier | Contenu |
|---|---|
| `apps/api` | **Composition root** et API HTTP : branche les contextes sur le bus, vide les outbox, projection « Suivi admin » |
| `contexts/ordering` | Bounded context **Ordering** : grille tarifaire, devis, agrégat `Order` |
| `contexts/dispatch` | Bounded context **Dispatch** (core domain) : domaine, application, infrastructure |
| `contexts/fulfillment` | Bounded context **Fulfillment** : agrégat `Intervention`, seul contexte qui voit les coordonnées du client |
| `tests/journeys` | Parcours **de bout en bout** entre contextes, reliés uniquement par le bus |
| `packages/contracts` | **Published language** : schémas versionnés des événements d'intégration, seul code partagé entre contextes |
| `packages/event-bus` | Bus d'événements en mémoire pour le monolithe modulaire |

Prérequis : Node 24 et pnpm.

```bash
pnpm install
pnpm test
pnpm typecheck
```

## Lancer l'API

```bash
pnpm --filter @tilli/api start
```

L'API écoute sur `http://127.0.0.1:3000`. Tout est en mémoire et quatre couturiers de démo sont créés au démarrage (`marie`, `karim`, `sofia`, `lucas`). Il n'y a pas d'authentification : l'identifiant du couturier passe dans la requête.

| Interface | Route | Rôle |
|---|---|---|
| Site | `GET /catalog/alterations?garmentType=pants&fabric=dressy` | Retouches proposées et leur prix |
| Site | `POST /quotes` | Étape 1 : devis d'une sélection |
| Site | `POST /orders` | Étape 2 : passer la commande au prix du devis |
| Site | `POST /orders/:orderId/cancel` | Annuler, tant que le travail n'a pas démarré |
| App couturier | `GET /tailors/:tailorId/offers` | Propositions en attente (quartier, créneaux, articles : **jamais** le client) |
| App couturier | `POST /missions/:missionId/accept` | Accepter et choisir le rendez-vous (`9h00`, `9h30`…) |
| App couturier | `POST /missions/:missionId/decline` | Décliner |
| App couturier | `GET /tailors/:tailorId/interventions` | Mes interventions, avec les coordonnées du client |
| App couturier | `POST /interventions/:id/start` puis `/complete` | Démarrer, terminer |
| Admin | `GET /admin/orders` | Suivi des commandes, construit à partir des événements |

Exemple, avec un lundi à venir :

```bash
curl -s -X POST localhost:3000/orders -H 'content-type: application/json' -d '{
  "items": [{ "garmentType": "dress", "fabric": "dressy", "alterationCodes": ["hem-ruffles"] }],
  "address": { "street": "12 rue Oberkampf", "postalCode": "75011", "city": "Paris" },
  "slots": [{ "start": "2026-11-16T09:00:00Z", "end": "2026-11-16T11:00:00Z" }],
  "customer": { "firstName": "Léa", "lastName": "Martin", "phone": "+33600000000", "email": "lea@example.com" },
  "quotedPriceGridVersion": "demo-2026-11"
}'
curl -s localhost:3000/tailors/marie/offers
```
