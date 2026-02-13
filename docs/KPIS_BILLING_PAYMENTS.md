# Documentation : KPIs, Facturation et Paiements

Ce document décrit les calculs des indicateurs clés de performance (KPIs), le système de facturation et le système de paiement de Planbase.

---

## 1. KPIs du Dashboard

### 1.1 Chiffre d'Affaires (CA)

#### CA par période
Le chiffre d'affaires est calculé selon la période sélectionnée dans le filtre :

| Filtre | Description |
|--------|-------------|
| **Année N** | Somme des budgets de tous les projets signés (hors prospection) de l'année en cours |
| **Jusqu'à ce mois** | CA de janvier jusqu'au mois en cours inclus |
| **Projection** | CA des projets démarrant **à partir de demain** jusqu'au 31 décembre |
| **6 derniers mois** | CA des 6 derniers mois glissants |
| **Trimestre actuel** | CA du trimestre en cours (Q1, Q2, Q3 ou Q4) |

#### Formule de calcul
```
CA Période = Σ budget des projets 
             WHERE stage ≠ "prospection"
             AND startDate est dans la période sélectionnée
```

**Note importante sur le filtre "Projection"** :
- Si nous sommes le 27 novembre, le filtre prend les projets à partir du 28 novembre jusqu'au 31 décembre
- Les projets du jour actuel ou avant sont exclus de la projection

#### CA Potentiel
Affiché sous le CA principal, le CA potentiel représente le chiffre d'affaires non signé :

```
CA Potentiel = Σ budget des projets 
               WHERE stage = "prospection"
```

**Inclut** :
- Tous les projets en prospection, qu'ils soient :
  - Passés (date de début antérieure)
  - Futurs (date de début à venir)
  - Non datés (sans date de début)

---

### 1.2 Paiements en Attente

#### Calcul du CA Global (base de calcul)
```
CA Global = Σ budget des projets WHERE stage ≠ "prospection"
```
Ce calcul prend TOUS les projets signés, sans filtre de date.

#### Calcul des Montants Encaissés
La logique prend en compte le statut de facturation de chaque projet :

```
Pour chaque projet (hors prospection) :
  SI billing_status = "paye" (payé)
    → Montant encaissé = budget total du projet
  SINON
    → Montant encaissé = Σ paiements individuels du projet
```

**Règle clé** : Si un projet est marqué comme "payé" au niveau du statut de facturation, son budget entier est considéré comme encaissé, indépendamment des paiements individuels enregistrés.

#### Formule finale
```
Paiements en Attente = MAX(0, CA Global - Total Encaissé)
```

---

### 1.3 Tâches en cours
```
Tâches en cours = COUNT(tâches) WHERE status ≠ "done"
```

### 1.4 Projets en cours
```
Projets en cours = COUNT(projets) WHERE stage ≠ "termine"
```

---

## 2. Système de Facturation (Billing)

### 2.1 Statuts de facturation disponibles

| Code | Libellé | Description |
|------|---------|-------------|
| `devis_envoye` | Devis envoyé | Proposition commerciale envoyée au client |
| `devis_accepte` | Devis accepté | Client a validé le devis |
| `bon_commande` | Bon de commande | BC reçu du client |
| `facture` | Facturé | Facture émise |
| `paye` | Payé | **Projet entièrement réglé** |
| `partiel` | Paiement partiel | Paiement reçu mais incomplet |
| `annule` | Annulé | Projet annulé |
| `retard` | En retard | Paiement en retard |

### 2.2 Impact du statut "Payé"

Lorsqu'un projet passe au statut `paye` :
1. Le budget entier du projet est comptabilisé comme encaissé
2. Les paiements individuels ne sont plus pris en compte dans le calcul
3. Le projet ne contribue plus aux "Paiements en attente"

**Cas d'usage** : Permet de simplifier la gestion pour les projets réglés en une seule fois ou dont les paiements détaillés n'ont pas été enregistrés.

### 2.3 Date d'échéance (billingDueDate)

Utilisée principalement quand le statut est `retard` pour indiquer la date de paiement attendue qui a été dépassée.

---

## 3. Système de Paiements

### 3.1 Structure d'un paiement

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | Identifiant unique |
| `projectId` | UUID | Projet associé |
| `amount` | Decimal | Montant du paiement |
| `paymentDate` | Date | Date du règlement |
| `paymentMethod` | Text | Mode de paiement (virement, carte, etc.) |
| `reference` | Text | Référence du paiement |
| `notes` | Text | Notes additionnelles |

### 3.2 Relation Paiements ↔ Statut de facturation

```
Projet.billing_status = "paye" ?
  ├─ OUI → Budget entier = Encaissé (paiements ignorés)
  └─ NON → Somme des paiements = Encaissé
```

### 3.3 Mise à jour automatique du statut

Lors de l'ajout d'un paiement, le système peut suggérer de mettre à jour le statut de facturation :
- Si `total paiements >= budget` → Suggérer statut "payé"
- Si `total paiements > 0 mais < budget` → Statut "partiel" possible

---

## 4. Schéma récapitulatif

```
┌─────────────────────────────────────────────────────────────┐
│                        PROJETS                               │
├─────────────────────────────────────────────────────────────┤
│  stage = "prospection"  │  stage ≠ "prospection"            │
│  ─────────────────────  │  ─────────────────────            │
│  → CA Potentiel         │  → CA Global                      │
│                         │                                   │
│                         │  billing_status = "paye" ?        │
│                         │    OUI → budget = encaissé        │
│                         │    NON → Σ paiements = encaissé   │
└─────────────────────────────────────────────────────────────┘

Paiements en attente = CA Global - Total Encaissé
```

---

## 5. Exemples pratiques

### Exemple 1 : Projet entièrement payé via statut

| Projet | Budget | billing_status | Paiements | Encaissé |
|--------|--------|----------------|-----------|----------|
| Site Web | 5 000 € | paye | 0 € | **5 000 €** |

Le projet est marqué "payé" → budget entier comptabilisé.

### Exemple 2 : Projet avec paiements partiels

| Projet | Budget | billing_status | Paiements | Encaissé |
|--------|--------|----------------|-----------|----------|
| Application | 10 000 € | partiel | 4 000 € + 3 000 € | **7 000 €** |

Paiements en attente pour ce projet = 10 000 - 7 000 = **3 000 €**

### Exemple 3 : Calcul global

| Projet | Budget | billing_status | Paiements individuels | Encaissé |
|--------|--------|----------------|----------------------|----------|
| Projet A | 5 000 € | paye | - | 5 000 € |
| Projet B | 8 000 € | facture | 3 000 € | 3 000 € |
| Projet C | 2 000 € | partiel | 1 000 € | 1 000 € |
| Projet D | 3 000 € | prospection | - | Exclu (prospection) |

**CA Global** = 5 000 + 8 000 + 2 000 = **15 000 €**
**Total Encaissé** = 5 000 + 3 000 + 1 000 = **9 000 €**
**Paiements en attente** = 15 000 - 9 000 = **6 000 €**
**CA Potentiel** = 3 000 € (Projet D en prospection)

---

## 6. Notes techniques

### Précision des calculs
- Les montants sont stockés en `DECIMAL` pour éviter les erreurs d'arrondi
- L'affichage utilise `toLocaleString('fr-FR')` pour le formatage français

### Performance
- Les calculs sont effectués côté client via `useMemo` pour optimiser les re-rendus
- Les requêtes API récupèrent tous les projets et paiements puis filtrent localement

### Multi-tenant
- Tous les calculs sont automatiquement filtrés par `account_id` via les politiques RLS de Supabase
- Chaque compte ne voit que ses propres données
