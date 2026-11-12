# Plan de tests E2E

Source : référentiel fonctionnel (§ entre parenthèses) confronté au code backend et frontend.

Légende :

- **Priorité** : P0 = parcours critique (bloquant en cas de régression) · P1 = règle métier ou droit important · P2 = affichage et confort.
- **Niveau** : UI = via le navigateur · API = appel direct au backend (règles sans rendu dédié, droits).
- ⚠︎ = le code s'écarte du référentiel ou n'y figure pas : le test suit le code.
- Rôles : R_A / R_U (application), RP_A / RP_C / RP_P (projet). Options : V, A, C, E.

Principe : l'E2E est un filet de sécurité, pas une recette exhaustive. Chaque formulaire a **un** test représentatif
de l'affichage des erreurs sous les champs ; les bornes de chaque champ (150, 250, 20 caractères…) relèvent des tests
unitaires du frontend et du backend.

---

## 0. Parcours critique

| ID      | P   | Niveau | Scénario                                                                                                                                               |
| ------- | --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CRIT-01 | P0  | UI     | Créer un projet (3 étapes) → créer un participant → créer un groupe → enregistrer sa première entrée → visible sur l'accueil du projet et dans les E/S |

## 1. Authentification et écrans transverses (§1, §2)

| ID       | P   | Niveau | Scénario                                                                                                                           |
| -------- | --- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01  | P0  | UI     | Un visiteur anonyme sur une page protégée est redirigé vers le SSO, puis ramené à la page demandée                                 |
| AUTH-02  | P0  | UI     | La déconnexion rend les pages protégées inaccessibles                                                                              |
| AUTH-03  | P1  | UI     | Le SSO injoignable mène à la page d'erreur globale avec un message adapté (§1.1)                                                   |
| AUTH-04  | P1  | UI     | Les conditions d'utilisation et la politique de confidentialité sont consultables sans être connecté                               |
| AUTH-05  | P1  | UI     | Un utilisateur bloqué est refusé après l'étape IdP                                                                                 |
| AUTH-06  | P1  | UI     | La session survit au rechargement et un jeton d'accès expiré est rafraîchi sans interruption                                       |
| AUTH-07  | P2  | UI     | Le lien support de la page de login n'apparaît que s'il est configuré                                                              |
| ERR-01   | P0  | UI     | Erreur à la récupération de l'utilisateur courant : message générique + message du backend ; « Réessayer » recharge la page (§1.3) |
| SHELL-01 | P2  | UI     | [R_A, R_U] Le footer donne accès à la documentation, au support, aux CGU et à la confidentialité (§1.2)                            |
| SHELL-02 | P2  | UI     | Chaque page applicative commence par un `sgdf-page-title` (§2)                                                                     |
| SHELL-03 | P2  | UI     | ⚠︎ Une route inconnue redirige vers l'accueil (code : `'**' → ''`, absent du référentiel)                                           |

## 2. Accueil applicatif (§3)

| ID      | P   | Niveau | Scénario                                                                                                                                      |
| ------- | --- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| HOME-01 | P1  | UI     | Favoris : 3 au plus ; chaque carte montre l'étoile, le nom tronqué, participants/groupes, le statut, les dates et la dernière mise à jour     |
| HOME-02 | P1  | UI     | Un clic sur l'étoile retire le favori ; un clic sur la carte ouvre l'accueil du projet                                                        |
| HOME-03 | P2  | UI     | « Voir tout » des favoris ouvre la liste des projets filtrée sur les favoris (query param)                                                    |
| HOME-04 | P1  | UI     | Invitations : 3 au plus, avec le projet, le rôle et la durée ; acceptation et refus après confirmation                                        |
| HOME-05 | P2  | UI     | « Voir tout » des invitations ouvre la liste des invitations                                                                                  |
| HOME-06 | P1  | UI     | Projets demandant de l'attention : seulement ceux avec E et des alertes en cours, par nombre décroissant, 5 au plus ; un clic ouvre le projet |
| HOME-07 | P2  | UI     | Accès rapide (R_A puis R_U) : aucun lien mort, en double ou vers une page interdite                                                           |
| HOME-08 | P1  | UI     | « Créer un projet » ouvre le formulaire de création                                                                                           |
| HOME-09 | P2  | UI     | Une donnée modifiée par l'API apparaît sans rechargement (polling selon les préférences)                                                      |

## 3. Accueil d'un projet (§4)

| ID    | P   | Niveau | Scénario                                                                                                                                    |
| ----- | --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| PH-01 | P1  | UI     | L'étoile du titre ajoute ou retire le favori, sans navigation                                                                               |
| PH-02 | P1  | UI     | Statut des participants : inscrits présents, inscrits absents, invités présents, sur un jeu de données connu                                |
| PH-03 | P1  | UI     | (V) Statut des véhicules (présents/absents) ; widget absent sans V                                                                          |
| PH-04 | P1  | UI     | [RP_A, RP_C] Présences à régulariser : départ prévu dépassé sans sortie définitive ; widget absent pour RP_P                                |
| PH-05 | P1  | UI     | (E) Alertes ouvertes : titre ou placeholder, durées, « Communiquer » ouvre le drawer ; widget absent sans E                                 |
| PH-06 | P0  | UI     | Arrivée du jour → formulaire de mouvement à l'étape 2, prérempli (maintenant, entrée, membres du groupe ou participant)                     |
| PH-07 | P0  | UI     | Départ du jour → étape 2, prérempli (maintenant, sortie, concernés, motif DEFINITIVE_DEPARTURE)                                             |
| PH-08 | P0  | UI     | (A) Activités en cours : contenu de la ligne, le compteur ouvre le drawer des participants, « Faire rentrer » préremplit ceux encore dehors |
| PH-09 | P1  | UI     | Autres E/S en cours : sans A, tous les mouvements ; avec A, seulement ceux sans activité ; le motif remplace le nom d'activité              |
| PH-10 | P1  | UI     | ⚠︎ L'entrée d'un invité encore présent figure dans les E/S en cours, avec « Faire sortir » (code : `isCurrent`)                              |
| PH-11 | P2  | UI     | [RP_A, RP_C] Anniversaires du jour : seulement les participants arrivés et pas encore partis                                                |
| PH-12 | P1  | UI     | Les boutons « + inscrit », « + invité » et (E) « Nouvelle alerte » ouvrent le bon formulaire                                                |
| PH-13 | P2  | UI     | Rafraîchissement par polling                                                                                                                |

## 4. Drawers (§5)

| ID     | P   | Niveau | Scénario                                                                                                                                    |
| ------ | --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| DRW-01 | P1  | UI     | (C) Communications : la plus récente en bas, chargement progressif vers le haut                                                             |
| DRW-02 | P1  | UI     | (C) Envoi au bouton et au raccourci cmd/ctrl + Entrée                                                                                       |
| DRW-03 | P1  | UI     | (C) Sur un mouvement d'activité l'auteur affiché est l'activité ; sinon l'utilisateur connecté                                              |
| DRW-04 | P1  | UI     | (E) Une communication qui crée une alerte apparaît aussi dans l'alerte et s'affiche comme une réponse liée                                  |
| DRW-05 | P2  | UI     | (C) L'auteur supprimé s'affiche « Utilisateur supprimé »                                                                                    |
| DRW-06 | P1  | UI     | Participants d'un mouvement : onglets tous/mineurs/majeurs s'ils sont non vides, un par groupe, « indépendant » s'il y a au moins un groupe |
| DRW-07 | P2  | UI     | (V) Le responsable d'un véhicule porte les informations du véhicule ; le drawer des véhicules liste véhicules et responsables               |

## 5. Comportements communs aux listes (§6)

Testés une fois, sur la liste des participants, plus une vérification ciblée sur une deuxième liste.

| ID     | P   | Niveau | Scénario                                                                                                                      |
| ------ | --- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| LST-01 | P1  | UI     | Défilement infini avec indicateur du lot suivant, sans pagination numérotée                                                   |
| LST-02 | P1  | UI     | Recherche au changement et forcée à Entrée, sans bouton ; filtres, recherche et tri dans l'URL ; le rechargement les restaure |
| LST-03 | P1  | UI     | Les filtres actifs sont affichés et le bouton de réinitialisation les vide                                                    |
| LST-04 | P1  | UI     | Liste vide : message adapté ; bouton de création seulement pour un rôle qui peut créer (membres : RP_A oui, RP_C non)         |
| LST-05 | P1  | UI     | Erreur de chargement : message convivial enrichi du message du backend                                                        |
| LST-06 | P1  | UI     | Le filtre de visibilité n'est proposé qu'aux rôles autorisés ; un élément supprimé est grisé avec un tag                      |

## 6. Projets (§7.1, §7.5, §8.2)

| ID     | P   | Niveau | Scénario                                                                                                                                    |
| ------ | --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| PRJ-01 | P0  | UI     | Création en 3 étapes : à l'étape 2 le projet existe et le créateur est RP_A ; l'étape 3 est l'invitation                                    |
| PRJ-02 | P0  | UI     | Modification : formulaire identique, prérempli                                                                                              |
| PRJ-03 | P1  | UI     | Erreurs sous les champs : nom vide, heure sans date, fin pas strictement après le début                                                     |
| PRJ-04 | P1  | UI     | Dépendances d'options renvoyées par le backend : C exige A, E exige C                                                                       |
| PRJ-05 | P1  | API    | Réduire les dates en excluant des éléments existants est refusé                                                                             |
| PL-01  | P0  | UI     | R_U ne voit que ses projets ; R_A a « avec profil » actif par défaut et voit tout en le désactivant                                         |
| PL-02  | P1  | UI     | Filtres texte, date/heure (projets actifs à cet instant) et favori                                                                          |
| PL-03  | P1  | UI     | Ligne : étoile, nom tronqué, dates, statut, « Options » s'il y a plus d'une option, « Rejoindre » avec un profil valide                     |
| PL-04  | P1  | UI     | [R_A] Sans profil : « Rejoindre pour support » après confirmation donne accès au projet                                                     |
| PL-05  | P1  | UI+API | [R_U] Aucune action de support ; l'API refuse la création d'un profil de support                                                            |
| PL-06  | P0  | UI     | [RP_A] Supprimer (grisé, tag, dialog explicative au clic) → Restaurer → Supprimer définitivement, chacun confirmé                           |
| PL-07  | P1  | UI+API | [RP_A] « Modifier » ouvre le formulaire prérempli ; un projet supprimé reste modifiable, mais son contenu est refusé (lecture et création)  |
| CFG-01 | P1  | UI     | Configuration : informations du projet ; bouton de modification RP_A seulement ; tuiles selon les options et le rôle, avec compteur et lien |
| CFG-02 | P1  | UI     | [RP_A] Zone de danger : suppression et suppression définitive ; absente pour RP_C et RP_P                                                   |

## 7. Utilisateurs (§7.2, §8.5)

| ID     | P   | Niveau | Scénario                                                                                                                               |
| ------ | --- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| USR-01 | P1  | UI+API | R_U n'a accès aux utilisateurs ni par le menu, ni par l'URL, ni par l'API                                                              |
| USR-02 | P1  | UI     | Liste : filtres texte et visibilité ; nom, dernière connexion, rôle ; un utilisateur bloqué est grisé avec un tag                      |
| USR-03 | P1  | UI     | « Modifier le rôle » : dialog préremplie ; rétrograder le dernier R_A est refusé                                                       |
| USR-04 | P1  | UI     | Bloquer puis débloquer avec confirmation ; l'utilisateur bloqué ne peut plus entrer                                                    |
| USR-05 | P1  | UI     | Export RGPD : la confirmation rappelle la suppression après transmission ; le fichier est téléchargé                                   |
| USR-06 | P1  | UI     | Suppression avec confirmation ; pas d'action sur sa propre ligne ; dernier R_A ou dernier RP_A d'un projet ni supprimable ni bloquable |
| AUD-01 | P1  | API    | Export RGPD limité à 5 par utilisateur et par heure (§10)                                                                              |

## 8. Membres d'un projet (§7.14, §8.3)

| ID     | P   | Niveau | Scénario                                                                                                                                                                |
| ------ | --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRF-01 | P0  | UI     | [RP_A] Inviter (utilisateur ou email, rôle obligatoire, dates optionnelles) ; l'invité accepte depuis la liste après confirmation ; un autre membre voit « en attente » |
| PRF-02 | P1  | UI     | L'invité refuse ; l'invitation n'est pas utilisable avant d'être acceptée                                                                                               |
| PRF-03 | P1  | UI     | Modification limitée au rôle et à la plage d'accès ; rétrograder le dernier RP_A sans date de fin est refusé                                                            |
| PRF-04 | P1  | UI     | Bloquer et débloquer ; le profil bloqué perd l'accès tout de suite ; RP_C ne voit pas les profils bloqués                                                               |
| PRF-05 | P1  | UI     | Supprimer avec confirmation ; ⚠︎ supprimer son propre profil exige une phrase saisie (code)                                                                              |
| PRF-06 | P1  | UI     | RP_C : liste en lecture seule (pas d'« Inviter », pas d'options) ; ⚠︎ RP_P : comportement de l'URL directe à confirmer (la route n'a pas de garde de rôle)               |
| PRF-07 | P2  | API    | Le profil de support expire après une heure                                                                                                                             |

## 9. Participants (§7.6, §7.7, §8.6)

| ID     | P   | Niveau | Scénario                                                                                                                                        |
| ------ | --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| PAR-01 | P0  | UI     | Créer un participant (identité, date de naissance, groupes, disponibilité) ; il apparaît dans la liste                                          |
| PAR-02 | P0  | UI     | Modifier : tous les champs sont préremplis                                                                                                      |
| PAR-03 | P1  | UI     | Erreurs sous les champs : prénom ou nom vide, date de naissance manquante                                                                       |
| PAR-04 | P1  | UI     | L'utilisateur lié n'est cherché que parmi les accès passés, actuels et futurs au projet, et il préremplit le nom                                |
| PAR-05 | P1  | UI     | Ligne : premier groupe + « N autres » ouvre le drawer des groupes, disponibilité avec « … » pour une borne absente, statut de présence          |
| PAR-06 | P1  | UI     | Supprimer (tous) → Restaurer (RP_A, RP_C) → Supprimer définitivement (RP_A) ; refusé s'il a des mouvements                                      |
| PAR-07 | P1  | UI     | [RP_A] Export RGPD avec la confirmation dédiée                                                                                                  |
| PAR-08 | P1  | UI     | ⚠︎ Historique réservé à RP_A et RP_C (code : `PARTICIPANT_HISTORY_R`) : en-tête, mouvements du seul participant, frises prévisionnelle et réelle |

## 10. Groupes (§7.8, §7.9, §8.7, §8.8)

| ID     | P   | Niveau | Scénario                                                                                             |
| ------ | --- | ------ | ---------------------------------------------------------------------------------------------------- |
| GRP-01 | P0  | UI     | Créer un groupe avec et sans membres, puis le modifier                                               |
| GRP-02 | P1  | UI     | Un invité n'est proposé ni à la création ni à l'ajout de membres                                     |
| GRP-03 | P1  | UI     | Ligne : effectif (dedans · dehors), disponibilité ; le bouton primaire ouvre les membres             |
| GRP-04 | P1  | UI     | ⚠︎ « Ajouter des membres » (au moins un), RP_P compris (code : `GROUP_U`)                             |
| GRP-05 | P1  | UI     | « Créer un membre » ouvre le formulaire participant dans un layer ; le participant créé est rattaché |
| GRP-06 | P1  | UI     | « Retirer du groupe » avec confirmation ; retirer le dernier membre laisse un groupe vide            |
| GRP-07 | P1  | UI     | Supprimer → Restaurer → Supprimer définitivement, selon le rôle                                      |

## 11. Véhicules (§7.10, §7.11, §8.9)

| ID     | P   | Niveau | Scénario                                                                             |
| ------ | --- | ------ | ------------------------------------------------------------------------------------ |
| VEH-01 | P1  | UI     | Accessible seulement avec V et pour RP_A/RP_C ; RP_P n'y a pas accès                 |
| VEH-02 | P0  | UI     | Créer puis modifier un véhicule (plaque, marque, modèle, disponibilité)              |
| VEH-03 | P1  | UI     | Supprimer → Restaurer → Supprimer définitivement ; refusé s'il a des mouvements      |
| VEH-04 | P2  | UI     | Historique : en-tête, mouvements du seul véhicule, frises, pourcentage d'utilisation |

## 12. Activités (§7.12, §7.13, §8.10)

| ID     | P   | Niveau | Scénario                                                                                          |
| ------ | --- | ------ | ------------------------------------------------------------------------------------------------- |
| ACT-01 | P1  | UI     | ⚠︎ Accessible seulement avec A et pour RP_A/RP_C (code : RP_P n'a aucune permission `ACTIVITY_*`)  |
| ACT-02 | P0  | UI     | Créer puis modifier une activité ; fourchette de participants min ≤ max, les deux bornes ensemble |
| ACT-03 | P1  | UI     | Supprimer → Restaurer → Supprimer définitivement ; refusé s'il y a des mouvements                 |
| ACT-04 | P2  | UI     | Historique : pourcentage de participants, heures en sortie (au sens mouvement et en heures-homme) |

## 13. Entrées et sorties (§7.3, §8.11, §8.12, §9)

| ID     | P   | Niveau | Scénario                                                                                                                                                                                            |
| ------ | --- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVF-01 | P0  | UI     | Inscrit : stepper (« Annuler » à l'étape 1, « Précédent »/« Suivant », « Valider »), date à maintenant par défaut, sortie enregistrée                                                               |
| MVF-02 | P0  | UI     | Motif obligatoire pour une sortie d'inscrit ; (A) les activités figurent parmi les motifs                                                                                                           |
| MVF-03 | P0  | UI     | Invité : une entrée crée au moins un invité et exige un motif ; une sortie ne propose que les invités sans sortie définitive                                                                        |
| MVF-04 | P1  | UI     | Par défaut, seuls les participants présents (prévisionnel ou effectif) à la date du mouvement ; le toggle élargit au projet entier                                                                  |
| MVF-05 | P1  | UI     | (V) Étape 3 : chaque véhicule exige un responsable et peut être retiré                                                                                                                              |
| MVF-06 | P1  | API    | Mouvement dans le futur refusé (tolérance de 2 min), ou hors des dates du projet ; ⚠︎ conducteur mineur refusé                                                                                       |
| MVF-07 | P1  | API    | Dates effectives : la 1re entrée fixe l'arrivée ; une entrée antidatée la met à jour ; une sortie définitive fixe le départ ; une sortie définitive antidatée avant d'autres mouvements est refusée |
| MVF-08 | P1  | API    | Après le départ effectif : un mouvement non définitif le supprime, une sortie définitive le met à jour, un mouvement antérieur ne le change pas                                                     |
| MVF-09 | P1  | API    | Priorité des disponibilités (§9) : les dates du participant l'emportent ; sinon celles de l'un de ses groupes ; sinon toujours disponible                                                           |
| MVL-01 | P1  | UI     | Liste : filtres de/à et type ; ⚠︎ visibilité pour RP_A et RP_C (code : `MOVEMENT_RESTORE`)                                                                                                           |
| MVL-02 | P1  | UI     | Ligne : type, horodatage, motif ou activité, compteurs ; les compteurs ouvrent les drawers                                                                                                          |
| MVL-03 | P0  | UI     | « Modifier » ouvre le formulaire prérempli, inscrit comme invité                                                                                                                                    |
| MVL-04 | P0  | UI     | Supprimer (tous) → Restaurer (RP_A, RP_C) → Supprimer définitivement (RP_A)                                                                                                                         |
| MVL-05 | P1  | API    | ⚠︎ Un mouvement qui met fin au séjour ne peut être ni modifié ni supprimé ; le type d'un mouvement ne change pas                                                                                     |
| MVL-06 | P2  | API    | La modification d'un mouvement historise la version précédente (§8.1) ; à préciser : comment l'observer ?                                                                                           |

## 14. Alertes et communications (§7.4, §8.13, §8.14)

| ID     | P   | Niveau | Scénario                                                                                                         |
| ------ | --- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| ALR-01 | P0  | UI     | « Nouvelle alerte » : titre et message obligatoires ; l'alerte apparaît dans la liste et sur l'accueil du projet |
| ALR-02 | P1  | UI     | Page disponible seulement avec E                                                                                 |
| ALR-03 | P1  | UI     | Filtres texte, statut, de/à ; statistiques en haut (temps moyen de résolution, taux d'alertes réelles)           |
| ALR-04 | P1  | UI     | « Résoudre » et « Annuler » seulement sur une alerte en cours, avec confirmation                                 |
| ALR-05 | P1  | UI     | Supprimer → Restaurer (RP_A, RP_C) → Supprimer définitivement (RP_A) ; ⚠︎ refusé si l'alerte a des communications |
| ALR-06 | P2  | API    | ⚠︎ Une alerte résolue ne peut plus être modifiée ; une communication ne peut viser qu'un mouvement de sortie      |

## 15. Formulaires et dialogs : comportement de soumission (§8.1)

| ID     | P   | Niveau | Scénario                                                                                                                                                       |
| ------ | --- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FRM-01 | P1  | UI     | Échec d'un formulaire : il reste ouvert, message convivial + message du backend à l'intérieur, sans toast, données conservées ; le message disparaît au renvoi |
| FRM-02 | P1  | UI     | Même comportement pour une dialog de confirmation, et le message disparaît à la fermeture                                                                      |
| FRM-03 | P1  | UI     | Pendant l'envoi : chargement sur le bouton, bouton désactivé (un seul élément créé), reste de l'interface utilisable ; l'annulation coupe la requête           |

## 16. Droits et sécurité

| ID     | P   | Niveau | Scénario                                                                                                                                                                  |
| ------ | --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | P0  | API    | Les permissions renvoyées par le backend pour chaque rôle correspondent à la matrice attendue (`support/permissions.ts`)                                                  |
| SEC-02 | P1  | API    | Refus par rôle sur les points sensibles : historique, activités et véhicules (RP_P), restauration (RP_P), suppression définitive (RP_C, RP_P), profils (RP_C en écriture) |
| SEC-03 | P1  | API    | Une requête de modification sans jeton CSRF, ou avec un jeton invalide, est rejetée                                                                                       |
| SEC-04 | P1  | UI     | Un profil dont la plage d'accès est terminée n'ouvre plus le projet ; un utilisateur sans profil non plus                                                                 |
| SEC-05 | P1  | API    | RP_P ne peut pas modifier l'utilisateur lié d'un participant (`403 PARTICIPANT_USER_LINK_FORBIDDEN`), seulement retirer son propre lien                                   |

La traçabilité dans `tb_audit` (§10) n'est observable ni par l'UI ni par l'API : elle reste aux tests du backend.

## 17. Présent dans le code, absent du référentiel

| ID     | P   | Niveau | Scénario                                                                                                      |
| ------ | --- | ------ | ------------------------------------------------------------------------------------------------------------- |
| MON-01 | P1  | UI     | Suivi des participants : statuts présent, absent, en retard (`OVERDUE`) et indisponible ; filtre par présence |
| MON-02 | P1  | UI     | Un participant censé être revenu et toujours dehors est affiché en retard                                     |
| MON-03 | P2  | UI     | Suivi des véhicules disponible seulement avec V                                                               |
| ACC-01 | P1  | UI     | Mon compte : export de mes propres données                                                                    |
| ACC-02 | P1  | UI     | Supprimer mon compte exige une phrase saisie ; le dernier R_A est informé qu'il ne peut pas le faire          |
| ACC-03 | P2  | UI     | Préférences (intervalle de polling, langue, thème) conservées après rechargement                              |
| ACC-04 | P1  | UI     | Page des invitations : accepter et refuser après confirmation                                                 |
| CON-01 | P1  | UI     | Modifier un élément changé entre-temps par quelqu'un d'autre affiche un conflit, sans écraser                 |
| CON-02 | P2  | UI     | Modifier un élément supprimé définitivement entre-temps affiche un message adapté                             |
