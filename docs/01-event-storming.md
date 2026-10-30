# Event Storming : big picture et process level

Notation :

- Événement (au passé) : un fait métier qui s'est produit. En **gras**, ceux qui intéressent un autre contexte.
- *Commande* (en italique) : une intention, émise par un acteur ou une policy.
- Policy : « quand X se produit, alors faire Y ».
- ⚠️ Hot spot : une question ouverte ou un point de friction.

## Chronologie

### 1. Prise de commande (client, sur le site)

| Acteur | Commande | Événement | Règles |
|---|---|---|---|
| Client | *Ajouter un article* (type de vêtement et matière) | ArticleAjouté | — |
| Client | *Choisir les retouches* d'un article | RetouchesChoisies | Seules les retouches qui ont un prix pour ce type et cette matière sont proposées |
| — | — | DevisCalculé | Prix de chaque retouche lu dans la grille fixe selon (vêtement, retouche, matière), puis additionné. Ex. : ourlet simple de pantalon, 12 € en Basique, 17 € en Habillé |
| Client | *Renseigner ses coordonnées et ses créneaux* | — | Adresse dans une zone desservie ; au moins un créneau dans le futur |
| Client | *Passer la commande* | **CommandePassée** | Au moins un article et au moins une retouche ; le prix est figé à cet instant |

Tranché : le devis est un calcul déterministe à partir d'une grille tarifaire fixe. Il n'a ni négociation ni durée de validité, donc pas d'agrégat.

### 2. Attribution (système, couturiers)

| Acteur | Commande | Événement | Règles |
|---|---|---|---|
| Policy : quand **CommandePassée** | *Ouvrir une mission* | MissionOuverte | Une mission par commande |
| Policy : quand MissionOuverte ou VagueExpirée | *Lancer une vague de propositions* | VagueLancée, PropositionEnvoyée (×N) | Candidats éligibles : zone, compétences, disponibilité, pas déjà sollicités |
| Couturier | *Décliner* | PropositionDéclinée | — |
| Couturier | *Accepter* | **MissionAttribuée** | Une seule acceptation possible ; les autres propositions sont retirées |
| Système (délai) | — | VagueExpirée | Aucune acceptation dans le délai imparti |
| Policy : quand le nombre max de vagues est atteint | — | **MissionNonPourvue** | Escalade vers les ops |

Tranché : quand deux couturiers acceptent à la même seconde, le premier obtient la mission et le second apprend qu'elle est déjà attribuée. C'est l'invariant central du core domain (voir [Dispatch](03-bounded-contexts/dispatch.md)).

⚠️ Le couturier ne voit les coordonnées du client qu'après avoir accepté. Pendant la proposition, il voit seulement le quartier, les créneaux et les articles.

### 3. Réalisation (couturier, sur l'app)

| Acteur | Commande | Événement | Règles |
|---|---|---|---|
| Policy : quand **MissionAttribuée** | *Créer l'intervention* | InterventionCréée | — |
| Couturier | *Confirmer le rendez-vous* | RendezVousConfirmé | Le créneau fait partie de ceux proposés par le client |
| Couturier | *Démarrer* | InterventionDémarrée | Uniquement à partir de l'heure du rendez-vous |
| Couturier | *Terminer* | **InterventionTerminée** | — |

### 4. Annulation (client ou ops)

| Acteur | Commande | Événement | Règles |
|---|---|---|---|
| Client / Ops | *Annuler la commande* | **CommandeAnnulée** | Impossible une fois l'intervention démarrée |
| Policy : quand **CommandeAnnulée** | *Clore la mission* / *Annuler l'intervention* | MissionClose / InterventionAnnulée | — |

## Read models (vues)

| Vue | Pour qui | Alimentée par |
|---|---|---|
| Récapitulatif de commande | Client | Ordering |
| Propositions en attente | Couturier | Dispatch |
| Mes interventions | Couturier | Fulfillment |
| Suivi des commandes | Ops | Événements des trois contextes (projection) |

## Frontières repérées

Le vocabulaire change deux fois au cours du parcours, de commande à mission puis de mission à intervention. Chacun de ces changements marque une frontière de bounded context.
