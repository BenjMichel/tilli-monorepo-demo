# ADR 0001 : découpage en trois bounded contexts

- **Statut** : accepté
- **Date** : 2026-10-30

## Contexte

Le système d'origine porte toute la vie d'une commande dans une seule entité `Order`, avec plus de 40 états qui mélangent funnel client, attribution, réalisation, logistique et retail. Toute évolution touche ce modèle central, et ses règles sont dispersées entre contrôleurs, crons et utilitaires.

L'Event Storming montre que le vocabulaire change deux fois au cours du parcours : commande (client), mission (attribution), intervention (réalisation).

## Décision

Trois bounded contexts, alignés sur ces changements de langage :

- Ordering : la demande du client et son prix ;
- Dispatch : le choix du couturier (core domain) ;
- Fulfillment : la réalisation par le couturier choisi.

Le site, l'admin et l'app couturier sont des interfaces au-dessus de ces contextes. Le suivi admin est une projection en lecture seule.

## Conséquences

Ce qu'on gagne :

- Chaque modèle a un cycle de vie court et lisible, de 3 à 5 états au lieu de 40.
- Le core domain peut évoluer (nouvel algorithme de sélection) sans toucher à la prise de commande.

Ce que ça coûte :

- Il faut une projection pour avoir une vue globale d'une commande (voir [ADR 0003](0003-integration-par-evenements.md)).
- Certaines données sont dupliquées entre contextes (créneaux, articles). Chaque contexte possède sa copie et l'interprète à sa façon.
