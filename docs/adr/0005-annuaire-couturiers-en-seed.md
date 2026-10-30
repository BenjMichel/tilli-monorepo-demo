# ADR 0005 : annuaire des couturiers alimenté par seed

- **Statut** : accepté
- **Date** : 2026-10-30

## Contexte

L'attribution a besoin de profils de couturiers : zone, compétences, disponibilités. Dans le système réel, ces profils viennent de l'onboarding et du KYC, deux sous-domaines hors périmètre.

## Décision

Pas de contexte « Annuaire » dans la démo. Dispatch possède localement un modèle `Candidate`, alimenté par un seed au démarrage. Fulfillment connaît seulement l'identifiant et le nom affiché de l'intervenant, reçus dans `MissionAwarded`.

## Conséquences

Ce qu'on gagne :

- Le périmètre reste centré sur le parcours commande → mission → intervention.

Ce que ça coûte :

- Si l'annuaire devient un vrai contexte, Dispatch devra consommer ses événements (`TailorOnboarded`, `TailorSkillsUpdated`) pour remplir `Candidate`. Seule la source de données de Dispatch changera, pas son modèle.
