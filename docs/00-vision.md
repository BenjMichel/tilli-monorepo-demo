# Vision du domaine

## Le problème

Faire retoucher un vêtement est contraignant : il faut trouver un retoucheur, s'y déplacer deux fois et accepter ses délais. De leur côté, des couturiers indépendants qualifiés cherchent des missions régulières près de chez eux, sans avoir à démarcher eux-mêmes.

## Ce que fait Tilli

Tilli met en relation des clients avec des couturiers indépendants qui viennent à domicile. Le client choisit ses retouches en ligne, avec un prix connu d'avance, et propose des créneaux. Tilli propose la mission aux couturiers compétents et disponibles dans la zone, et le premier qui accepte la réalise : rendez-vous, prise de mesures, retouche, restitution.

## Ce qui différencie Tilli

**L'attribution** : trouver vite un couturier qui a la bonne compétence (type de vêtement, matière), qui est dans la bonne zone et disponible sur un des créneaux du client. Si personne n'accepte, la commande est perdue. Si le mauvais couturier accepte, le client est déçu. C'est le **core domain**.

## Acteurs

| Acteur | Interface | Besoin |
|---|---|---|
| Client | Site | Commander simplement, à un prix connu d'avance |
| Couturier | App mobile | Recevoir des missions adaptées et suivre celles qu'il a acceptées |
| Ops Tilli | Admin | Voir où en est chaque commande et repérer les blocages |

## Hors périmètre de la démo

Paiement et facturation, KYC et onboarding des couturiers, logistique colis, retail et partenariats marques, programmes de fidélité. Ces sous-domaines existent dans le système réel mais ne sont pas modélisés ici, pour garder la démo centrée sur le parcours principal.
