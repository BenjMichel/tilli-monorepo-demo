# Tilli : monorepo de démonstration

[![CI](https://github.com/BenjMichel/tilli-monorepo-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/BenjMichel/tilli-monorepo-demo/actions/workflows/ci.yml)

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
| `apps/site` | **Site** client (Vite, React) : le funnel de commande en 2 étapes, qui ne parle qu'à l'API |
| `apps/admin` | **Admin** ops (Vite, React) : suivi des commandes et annulation, via l'API |
| `apps/tailor` | **App couturier** (Expo, React Native, react-native-web) : propositions et interventions, sur iOS, Android et le web |
| `apps/api` | **Composition root** et API HTTP : branche les contextes sur le bus, vide les outbox, projection « Suivi admin » |
| `infra` | **Infrastructure as code** (OpenTofu) : Cloud Run, Artifact Registry, identité GitHub sans clé |
| `contexts/ordering` | Bounded context **Ordering** : grille tarifaire, devis, agrégat `Order` |
| `contexts/dispatch` | Bounded context **Dispatch** (core domain) : domaine, application, infrastructure |
| `contexts/fulfillment` | Bounded context **Fulfillment** : agrégat `Intervention`, seul contexte qui voit les coordonnées du client |
| `tests/journeys` | Parcours **de bout en bout** entre contextes, reliés uniquement par le bus |
| `packages/contracts` | **Published language** : schémas versionnés des événements d'intégration, seul code partagé entre contextes |
| `packages/event-bus` | Bus d'événements en mémoire pour le monolithe modulaire |

Prérequis : Node 24 et pnpm 12.

```bash
pnpm install
pnpm verify
```

`pnpm verify` enchaîne les mêmes vérifications que la CI :

| Étape | Commande | Outil |
|---|---|---|
| Lint et format | `pnpm lint` (`pnpm lint:fix` pour corriger) | Biome |
| Types | `pnpm typecheck` | tsc |
| Architecture | `pnpm check:architecture` | dependency-cruiser : isolation des contextes, domaine pur, pas de cycle |
| Tests | `pnpm test` | Vitest |

## Conteneur et infrastructure

L'API est compilée en un seul fichier JavaScript (esbuild) et embarquée dans une image **distroless** non root :

```bash
docker build -t tilli-api .
docker run -p 8080:8080 tilli-api
```

`infra/` décrit l'environnement GCP en **OpenTofu** ([ADR 0006](docs/adr/0006-infrastructure-cloud-run-opentofu.md)) :

| Élément | Rôle |
|---|---|
| `modules/cloud-run-service` | Service Cloud Run avec sa propre identité, sondes `/health`, accès public optionnel |
| `modules/github-deployer` | Workload Identity Federation : seul `main` de ce dépôt obtient des identifiants, sans clé stockée ; droits limités à une ressource chacun |
| `envs/demo` | Environnement de démo à Paris (`europe-west9`) : **une seule instance**, car l'état est en mémoire |

Rien n'est déployé : la CI valide la configuration, la **teste avec `tofu test` sur un provider simulé** (aucun identifiant nécessaire), puis la passe à tflint et à trivy. Pour un vrai déploiement, il faudrait un projet GCP, un bucket pour l'état, et :

```bash
cd infra/envs/demo
cp terraform.tfvars.example terraform.tfvars   # puis renseigner project_id et api_image
tofu init -backend-config="bucket=<bucket-d-etat>"
tofu plan
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

## Le site

Dans un second terminal, l'API étant lancée :

```bash
pnpm --filter @tilli/site dev
```

Le site s'ouvre sur `http://localhost:5173` et joint l'API par `/api`, que Vite relaie vers `http://127.0.0.1:3000` (variable `API_URL` pour en changer). Il ne connaît que les routes HTTP, jamais le code d'un contexte :

| Étape | Ce que voit le client | Appels |
|---|---|---|
| 1. Vêtements et retouches | Vêtement, matière, retouches avec leur prix ; panier et total recalculés à chaque ajout | `GET /catalog/alterations`, `POST /quotes` |
| 2. Coordonnées | Adresse, créneaux de 2 h sur 7 jours, coordonnées | `POST /orders` avec la version de grille du devis |
| Confirmation | Numéro de commande et prix figé | |

Le prix affiché vient toujours du devis de l'API : le site ne calcule rien. Ses tests (Vitest, Testing Library) parcourent le funnel complet contre une fausse API.

## L'admin

L'API étant lancée :

```bash
pnpm --filter @tilli/admin dev
```

L'admin s'ouvre sur `http://localhost:5174` et joint l'API par `/api`, comme le site. Il n'a aucune logique métier ([context map](docs/04-context-map.md#le-suivi-admin-est-une-projection)) :

| Besoin des ops | Ce que fait l'admin | Appels |
|---|---|---|
| Voir où en est chaque commande | Tableau rafraîchi toutes les 5 s : statut, couturier, rendez-vous, prix | `GET /admin/orders` (projection) |
| Repérer les blocages | Bandeau et commandes **non pourvues** en tête de liste, filtres par statut | |
| Annuler | Motif obligatoire, puis commande envoyée à Ordering, qui peut refuser si l'intervention a démarré | `POST /orders/:id/cancel` |

Le bouton « Annuler » n'est qu'un indice tiré de la projection : c'est Ordering qui tranche, et l'admin explique son refus.

## L'app couturier

Une seule base de code React Native (Expo SDK 58) pour iOS, Android et le web : sur le web, `react-native-web` traduit les composants `View`, `Text` et `Pressable` en HTML. L'API étant lancée :

```bash
pnpm --filter @tilli/tailor web       # navigateur, sur http://localhost:8081
pnpm --filter @tilli/tailor start     # QR code pour Expo Go, sur un téléphone du même réseau
pnpm --filter @tilli/tailor build:web # export statique dans apps/tailor/dist
```

L'app joint l'API par `/api` sur le serveur Metro, qui la relaie vers `http://127.0.0.1:3000` (`metro.config.cjs`, variable `API_URL` pour en changer). Sur un téléphone, elle passe par le même serveur Metro : l'API n'a donc pas besoin de CORS ni d'écouter sur le réseau. Pour une API déployée, `EXPO_PUBLIC_API_URL` remplace le relais.

Sans authentification, le couturier choisit qui il est parmi les quatre couturiers de démo :

| Écran | Ce que voit le couturier | Appels |
|---|---|---|
| Propositions | Quartier, vêtements, matières, délai de réponse ; rendez-vous de 30 min à choisir dans les créneaux du client. **Jamais** le client | `GET /tailors/:id/offers`, `POST /missions/:id/accept` ou `/decline` |
| Mes interventions | Rendez-vous, nom, adresse et téléphone du client, fiche de travail ; démarrer puis terminer | `GET /tailors/:id/interventions`, `POST /interventions/:id/start` puis `/complete` |

Les deux écrans se rafraîchissent toutes les 5 s. Les horaires proposés suivent la règle de Dispatch (à l'heure ou à la demie, dans un créneau, dans le futur), mais c'est Dispatch qui tranche : si un autre couturier a accepté avant, l'app l'explique. Ses tests (Vitest, Testing Library) rendent l'app avec `react-native-web`, le même moteur que la version web.
