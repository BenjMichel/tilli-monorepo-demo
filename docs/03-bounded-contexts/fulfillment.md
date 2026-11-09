# Bounded context : Fulfillment (réalisation des interventions)

**Sous-domaine** : supporting · **Interface** : l'app couturier (« Mes interventions »)

## Responsabilité

Accompagner le couturier une fois la mission remportée : rendez-vous, démarrage, fin. C'est le seul contexte qui donne au couturier les **coordonnées du client**.

## Langage ubiquitaire

| Terme | Code | Définition |
|---|---|---|
| Intervention | `Intervention` | Le travail qu'un couturier précis réalise pour une commande |
| Intervenant | `Tailor` | Le couturier qui réalise l'intervention |
| Rendez-vous | `Appointment` | Les 30 minutes choisies par le couturier **au moment où il accepte** la mission (règle portée par Dispatch). Il ne change plus ensuite |
| Contact client | `CustomerContact` | Nom, téléphone et adresse, visibles par l'intervenant uniquement |
| Fiche de travail | `WorkSheet` | Les articles (type, matière) et les retouches à réaliser (copie locale) |

Le même couturier s'appelle **candidat** dans Dispatch et **intervenant** ici, et chaque contexte a son propre modèle de lui.

## Agrégat : `Intervention`

Invariants :

- on ne peut démarrer qu'à partir de l'heure du rendez-vous ;
- on ne peut terminer qu'une intervention démarrée ;
- seul l'intervenant assigné peut agir sur l'intervention.

Cycle de vie : `Scheduled → InProgress → Completed`, et `Cancelled` tant que l'intervention n'a pas démarré.

## Événements publiés

| Événement d'intégration | Contenu |
|---|---|
| `InterventionStarted` | interventionId, orderId |
| `InterventionCompleted` | interventionId, orderId, completedAt |

## Événements consommés

| Événement | Origine | Réaction |
|---|---|---|
| `OrderPlaced` | Ordering | Conserve un **brouillon** privé (contact client, fiche de travail) en attente d'attribution |
| `MissionAwarded` | Dispatch | Crée l'`Intervention` à partir du brouillon, pour l'intervenant gagnant et **au rendez-vous qu'il a choisi** |
| `OrderCancelled` | Ordering | Annule l'intervention si elle n'a pas démarré |

Fulfillment consomme `OrderPlaced` lui-même au lieu de recevoir le contact client par Dispatch. Dispatch n'a pas à connaître de données personnelles (minimisation RGPD) et ne garde que ce qui sert à décider. Voir [ADR 0003](../adr/0003-integration-par-evenements.md).

## Événements qui se croisent

Les événements de deux contextes n'arrivent pas forcément dans l'ordre. Chaque cas a une réponse explicite :

| Situation | Réaction |
|---|---|
| `MissionAwarded` arrive avant `OrderPlaced` | Pas de brouillon : le handler **échoue** et le relais de Dispatch rejoue l'événement plus tard |
| `MissionAwarded` livré deux fois | L'identifiant d'intervention est dérivé de la commande : **une seule** intervention |
| `OrderCancelled` arrive avant `MissionAwarded` | Le brouillon est marqué annulé ; l'intervention est créée puis **annulée aussitôt**, et le couturier est prévenu |
| `OrderCancelled` arrive après le démarrage | Fulfillment ne peut pas défaire un fait : l'intervention **continue** et `LateCancellationReceived` alerte les ops, une seule fois |

Le dernier cas existe parce qu'Ordering n'apprend le démarrage qu'en recevant `InterventionStarted`. Entre les deux, une annulation peut encore être acceptée. Ordering, de son côté, garde alors la commande annulée même quand `InterventionCompleted` arrive.
