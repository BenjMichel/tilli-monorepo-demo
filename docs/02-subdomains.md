# Sous-domaines (espace du problème)

| Sous-domaine | Type | Justification | Traitement dans la démo |
|---|---|---|---|
| **Attribution des missions** | **Core** | Avantage concurrentiel : vitesse et pertinence du matching | Modélisation la plus riche, tests les plus poussés |
| Prise de commande et tarification | Supporting | Spécifique à Tilli, sans différenciation forte | Modèle simple, grille tarifaire fixe (vêtement × retouche × matière) |
| Suivi de réalisation | Supporting | Indispensable, cycle de vie linéaire | Petite machine à états |
| Annuaire des couturiers (compétences, zones) | Supporting | Alimente l'attribution | **Données de seed**, pas de contexte dédié |
| Identité et authentification | Generic | Problème résolu par le marché | Fake / adapter |
| Notifications (push, SMS, email) | Generic | Problème résolu par le marché | Port + adapter qui écrit dans les logs |
| Paiement, facturation, KYC, logistique | — | Hors périmètre | Non modélisés |

## Conséquences

**L'effort de modélisation va au core.** Dispatch a le modèle le plus riche : un agrégat avec un invariant de concurrence, des policies et des value objects. Ordering et Fulfillment restent volontairement simples, parce qu'un supporting domain n'a pas besoin du même niveau de détail.

**Les sous-domaines generic passent derrière des ports.** Le domaine ne connaît que des interfaces (`Notifier`, …), dont les implémentations sont interchangeables.

L'annuaire des couturiers aurait son propre contexte dans le système réel. Ici, Dispatch possède en local un `CandidateProfile` alimenté par seed (voir [ADR 0005](adr/0005-annuaire-couturiers-en-seed.md)).
