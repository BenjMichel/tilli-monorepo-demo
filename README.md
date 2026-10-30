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
