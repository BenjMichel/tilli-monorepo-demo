# Bounded context : Ordering (prise de commande)

Sous-domaine supporting. Interfaces : le site (funnel en 2 étapes) et l'admin (annulation).

## Responsabilité

Recueillir ce que le client veut faire retoucher, en calculer le prix et enregistrer sa commande. Ordering ne sait pas qui réalisera la commande, ni comment ce couturier est choisi.

## Langage ubiquitaire

| Terme | Code | Définition |
|---|---|---|
| Commande | `Order` | Demande ferme d'un client : des articles, une adresse, des créneaux, un prix figé |
| Article | `Item` | Un vêtement à retoucher, caractérisé par son type et sa matière |
| Type de vêtement | `GarmentType` | Pantalon, robe, manteau… Détermine les retouches possibles |
| Matière | `Fabric` | Catégorie de tissu qui fait varier le prix : Basique ou Habillé (tailleur, soie…) |
| Retouche | `Alteration` | Prestation unitaire (ourlet simple, ourlet revers, cintrage…) |
| Grille tarifaire | `PriceGrid` | Table fixe qui donne le prix de chaque triplet (type de vêtement, retouche, matière). Elle est versionnée |
| Devis | `Quote` | Le total calculé à partir de la grille. C'est un calcul, pas un agrégat |
| Client | `Customer` | Coordonnées de la personne qui commande (snapshot, pas de compte) |
| Créneau souhaité | `TimeSlot` | Une plage pendant laquelle le client est disponible |
| Zone desservie | `ServiceArea` | Les codes postaux où Tilli intervient |

## Tarification

Le prix d'une retouche dépend de la retouche, du type de vêtement et de la matière. Extrait de la grille réelle :

| Type de vêtement | Retouche | Basique | Habillé |
|---|---|---|---|
| Pantalon | Ourlet simple (x2) | 12 € | 17 € |
| Pantalon | Ourlet revers (x2) | 15 € | 20 € |
| Pantalon | Ourlet de jean simple | 12 € | 12 € |

`PriceGrid.priceOf(garmentType, alteration, fabric): Money` est une fonction pure. Le devis est la somme des prix de toutes les retouches de tous les articles. La grille est une donnée de référence : elle vient d'un fichier versionné, et aucun use case du domaine ne la modifie.

## Agrégat pressenti : `Order`

Invariants :

- au moins un article, et au moins une retouche par article ;
- chaque retouche a un prix dans la grille pour le type et la matière de son article (sinon, la combinaison n'est pas proposée) ;
- l'adresse est dans une zone desservie ;
- au moins un créneau, et tous les créneaux sont dans le futur ;
- le prix est figé au passage de la commande, avec la version de la grille utilisée. Une nouvelle version de la grille ne modifie pas les commandes existantes ;
- l'annulation n'est plus possible une fois l'intervention démarrée.

Cycle de vie : `Placed → Completed` ou `Placed → Cancelled`.

L'état « un couturier a accepté » appartient à Dispatch, pas à `Order`. La projection admin se charge du suivi transverse.

## Événements publiés

| Événement d'intégration | Contenu |
|---|---|
| `OrderPlaced` | orderId, articles (type, matière, retouches), adresse, créneaux, contact client, prix, version de la grille |
| `OrderCancelled` | orderId, motif |

## Événements consommés

| Événement | Origine | Réaction |
|---|---|---|
| `InterventionStarted` | Fulfillment | Garde une trace locale qui interdit ensuite l'annulation |
| `InterventionCompleted` | Fulfillment | `Order` passe à Completed |
