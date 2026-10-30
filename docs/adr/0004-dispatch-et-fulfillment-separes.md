# ADR 0004 : Dispatch et Fulfillment séparés, propositions en parallèle

- **Statut** : accepté
- **Date** : 2026-10-30

## Contexte

L'attribution et la réalisation concernent toutes les deux le couturier, et l'app couturier les affiche côte à côte. On pourrait donc les fusionner en un seul contexte « Missions ».

Dans le système actuel, une mission est proposée à plusieurs couturiers en même temps, par tentatives successives qui élargissent le cercle (`algoTryNumber`). Le premier qui accepte l'emporte.

## Décision

Dispatch et Fulfillment sont deux contextes distincts. Dispatch est le core domain (sélection, vagues, concurrence), et son modèle doit pouvoir évoluer vite, par exemple avec un nouveau scoring ou de nouvelles règles d'éligibilité, sans risque pour la réalisation. Fulfillment est un supporting domain linéaire qui manipule des données personnelles que Dispatch n'a pas à voir.

Les propositions partent en parallèle, par vagues. L'agrégat `Mission` contient la vague active et ses propositions. La règle « premier qui accepte gagne » est un invariant de l'agrégat, protégé par un verrouillage optimiste.

## Conséquences

Ce qu'on gagne :

- L'invariant de concurrence est concentré dans un seul agrégat, simple à tester.
- Le modèle de Fulfillment reste petit et sans logique d'attribution.

Ce que ça coûte :

- L'app couturier compose deux sources : « Propositions » depuis Dispatch, « Mes interventions » depuis Fulfillment. Ça se règle dans l'interface, sans toucher au domaine.
- Une mission très demandée concentre les écritures sur un seul agrégat, ce qui reste acceptable avec quelques dizaines de candidats par vague.
