# Bounded context : Fulfillment (réalisation des interventions)

**Sous-domaine** : supporting · **Interface** : l'app couturier (« Mes interventions »)

## Responsabilité

Accompagner le couturier une fois la mission remportée : rendez-vous, démarrage, fin. C'est le seul contexte qui donne au couturier les **coordonnées du client**.

## Langage ubiquitaire

| Terme | Code | Définition |
|---|---|---|
| Intervention | `Intervention` | Le travail qu'un couturier précis réalise pour une commande |
| Intervenant | `Tailor` | Le couturier qui réalise l'intervention |
| Rendez-vous | `Appointment` | Le créneau confirmé, choisi parmi ceux proposés par le client |
| Contact client | `CustomerContact` | Nom, téléphone et adresse, visibles par l'intervenant uniquement |
| Fiche de travail | `WorkSheet` | Les articles (type, matière) et les retouches à réaliser (copie locale) |

Le même couturier s'appelle **candidat** dans Dispatch et **intervenant** ici, et chaque contexte a son propre modèle de lui.

## Agrégat : `Intervention`

Invariants :

- le rendez-vous est choisi parmi les créneaux proposés par le client ;
- on ne peut démarrer qu'avec un rendez-vous confirmé, à partir de son heure ;
- on ne peut terminer qu'une intervention démarrée ;
- seul l'intervenant assigné peut agir sur l'intervention.

Cycle de vie : `Scheduled → AppointmentConfirmed → InProgress → Completed`, et `Cancelled` tant que l'intervention n'a pas démarré.

## Événements publiés

| Événement d'intégration | Contenu |
|---|---|
| `InterventionStarted` | interventionId, orderId |
| `InterventionCompleted` | interventionId, orderId, completedAt |

## Événements consommés

| Événement | Origine | Réaction |
|---|---|---|
| `OrderPlaced` | Ordering | Conserve un **brouillon** privé (contact client, fiche de travail, créneaux) en attente d'attribution |
| `MissionAwarded` | Dispatch | Crée l'`Intervention` à partir du brouillon, pour l'intervenant gagnant |
| `OrderCancelled` | Ordering | Annule l'intervention si elle n'a pas démarré |

Fulfillment consomme `OrderPlaced` lui-même au lieu de recevoir le contact client par Dispatch. Dispatch n'a pas à connaître de données personnelles (minimisation RGPD) et ne garde que ce qui sert à décider. Voir [ADR 0003](../adr/0003-integration-par-evenements.md).
