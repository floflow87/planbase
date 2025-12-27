# Calcul de Rentabilité - Documentation Technique

Ce document décrit en détail la logique de calcul des métriques de rentabilité des projets dans Planbase.

## Vue d'ensemble

Le système de rentabilité permet de suivre la performance financière de chaque projet en comparant les revenus aux coûts. Il est conçu pour donner une **vision prévisionnelle** de la rentabilité.

## Fichiers clés

- `server/services/profitabilityService.ts` - Logique de calcul backend
- `client/src/pages/project-detail.tsx` - Affichage des KPI sur la page projet

---

## 1. Types de projets

### 1.1 Par mode de facturation (`billingType`)

| Type | Valeur DB | Description |
|------|-----------|-------------|
| **Forfait** | `fixed_price` | Prix fixe négocié, TJM déduit du montant ÷ jours |
| **Régie** | `time_based` | Facturation au temps passé, TJM global appliqué |

### 1.2 Par type d'activité (`businessType`)

| Type | Valeur DB | Impact |
|------|-----------|--------|
| **Projet client** | `client` | Inclus dans les calculs de rentabilité |
| **Projet interne** | `internal` | Exclu des calculs de rentabilité |

---

## 2. Métriques Principales

### 2.1 Montant facturé (`totalBilled`)

**Source de données :** `project.totalBilled` (prioritaire) ou `project.budget` (fallback)

```typescript
const totalBilled = parseFloat(project.totalBilled?.toString() || project.budget?.toString() || '0');
```

**Règle de priorité :**
- **`totalBilled` a TOUJOURS la priorité sur `budget`**
- Si `totalBilled` est renseigné, c'est lui qui est affiché et utilisé partout (badge budget, progression paiements, calculs CA, etc.)
- `budget` sert uniquement de fallback quand `totalBilled` n'est pas défini

**Affichage :** Onglet Facturation > "Montant facturé"

---

### 2.2 Nombre de jours (`numberOfDays`)

**Champ :** `project.numberOfDays`

**Modes de fonctionnement :**
- **Mode verrouillé** (`isNumberOfDaysOverridden = true`) : Valeur manuelle, ne se synchronise pas
- **Mode déverrouillé** (`isNumberOfDaysOverridden = false`) : Synchronisé avec le total des `estimatedDays` du CDC

**Utilisation pour le coût :**
```typescript
// Si des heures ont été trackées → utiliser les jours réels
// Sinon → utiliser les jours théoriques (numberOfDays)
const daysForCostCalculation = actualDaysWorked > 0 ? actualDaysWorked : theoreticalDays;
```

---

### 2.3 TJM Cible (`targetTJM`)

Le TJM cible représente le **coût journalier interne** utilisé pour calculer le coût du projet.

**Hiérarchie de priorité :**

```typescript
const targetTJM = projectTJM ?? forfaitTJM ?? globalTJM;
```

| Priorité | Source | Condition |
|----------|--------|-----------|
| 1 | `project.billingRate` | Si défini sur le projet |
| 2 | `totalBilled / numberOfDays` | **Seulement si `billingType = 'fixed_price'`** (forfait) |
| 3 | `settings.billing.defaultTJM` | TJM global des paramètres |

**Important :** Pour les projets en **régie**, le calcul forfaitTJM (montant ÷ jours) ne s'applique PAS. Le TJM global est utilisé.

---

### 2.4 Coût actualisé (`totalCost` / `estimatedCost`)

**Formule :**
```
Coût actualisé = Jours × TJM cible
```

**Détail :**
```typescript
const totalCost = daysForCostCalculation * targetTJM;
```

**Jours utilisés :**
- Si `actualDaysWorked > 0` → Jours réellement travaillés (depuis time entries)
- Sinon → `numberOfDays` (jours théoriques)

**Tooltip affiché :**
> "Estimation du coût interne basée sur le temps travaillé et le TJM cible."
> Formule : Jours × TJM cible

---

### 2.5 Marge prévisionnelle (`margin`)

**Formule :**
```
Marge = Montant facturé - Coût actualisé
```

**Détail :**
```typescript
const margin = totalBilled - totalCost;
const marginPercent = totalBilled > 0 ? (margin / totalBilled) * 100 : 0;
```

**Note importante :** La marge utilise le **Montant facturé** (et non le CA encaissé) car c'est une vision **prévisionnelle**. Le CA encaissé sera éventuellement égal au montant facturé.

---

## 3. Affichage des KPI

### 3.1 Logique d'affichage

| Condition | Affichage |
|-----------|-----------|
| `estimatedCost > 0` OU `totalBilled > 0` | Valeur (même si 0€) |
| Aucune donnée | "-" |

```typescript
const hasMarginData = metrics.totalBilled > 0 || metrics.totalPaid > 0 || metrics.actualDaysWorked > 0;
```

### 3.2 Code couleur de la marge

| Pourcentage de marge | Couleur | Code hex |
|----------------------|---------|----------|
| ≥ 100% du target | Vert | `#16a34a` |
| 70% - 100% du target | Jaune | `#eab308` |
| 40% - 70% du target | Orange | `#f97316` |
| < 40% du target | Rouge | `#dc2626` |

**Calcul du ratio :**
```typescript
const targetMarginPercent = project.targetMarginPercent || 30; // Défaut: 30%
const marginRatio = (marginPercent / targetMarginPercent) * 100;
```

---

## 4. Exemples de calcul

### 4.1 Projet Forfait

**Données :**
- Montant facturé : 10 000€
- Nombre de jours : 10
- Jours travaillés : 8
- TJM global : 800€

**Calcul :**
1. `forfaitTJM = 10 000 / 10 = 1 000€/j` ← Car billingType = 'fixed_price'
2. `targetTJM = 1 000€`
3. `totalCost = 8 × 1 000 = 8 000€`
4. `margin = 10 000 - 8 000 = 2 000€`
5. `marginPercent = (2 000 / 10 000) × 100 = 20%`

### 4.2 Projet Régie

**Données :**
- Montant facturé : 36 000€
- Nombre de jours : 72
- Jours travaillés : 0 (pas encore tracké)
- TJM global : 800€

**Calcul :**
1. `forfaitTJM = null` ← Car billingType ≠ 'fixed_price'
2. `targetTJM = 800€` ← TJM global appliqué
3. `daysForCostCalculation = 72` ← Fallback sur jours théoriques
4. `totalCost = 72 × 800 = 57 600€`
5. `margin = 36 000 - 57 600 = -21 600€`
6. Marge négative = projet déficitaire au tarif actuel

### 4.3 Projet sans suivi de temps

**Données :**
- Montant facturé : 5 000€
- Nombre de jours : 5
- Jours travaillés : 0
- billingType : 'fixed_price'

**Calcul :**
1. `forfaitTJM = 5 000 / 5 = 1 000€/j`
2. `daysForCostCalculation = 5` ← Fallback sur numberOfDays
3. `totalCost = 5 × 1 000 = 5 000€`
4. `margin = 5 000 - 5 000 = 0€`
5. Marge nulle affichée (pas "-")

---

## 5. Champs de la base de données

### Table `projects`

| Champ | Type | Description |
|-------|------|-------------|
| `totalBilled` | text | Montant facturé (prioritaire pour les calculs) |
| `budget` | text | Budget estimé (fallback) |
| `numberOfDays` | numeric | Jours facturés/estimés |
| `isNumberOfDaysOverridden` | boolean | Mode manuel (true) ou sync CDC (false) |
| `billingType` | text | 'fixed_price' ou 'time_based' |
| `billingRate` | numeric | TJM spécifique au projet (optionnel) |
| `businessType` | text | 'client' ou 'internal' |
| `targetMarginPercent` | numeric | Objectif de marge en % |

---

## 6. Priorité `totalBilled` sur `budget`

Partout dans l'application, quand un montant "budget" est affiché, la logique est :

```typescript
const effectiveBudget = project.totalBilled || project.budget;
```

**Pages impactées :**
- `project-detail.tsx` - Badge header, progression paiements, composant scope
- `dashboard.tsx` - Calculs CA mensuel, CA global, paiements
- `projects.tsx` - Cartes Kanban, tableau liste, vues mobiles
- `client-detail.tsx` - Liste des projets du client
- `profitabilityService.ts` - Tous les calculs de rentabilité

---

## 7. Historique des modifications

| Date | Modification |
|------|--------------|
| 2025-12-27 | **totalBilled prioritaire sur budget** dans toute l'application |
| 2025-12-27 | Marge calculée sur Montant facturé (au lieu de CA encaissé) |
| 2025-12-27 | forfaitTJM appliqué uniquement aux projets `fixed_price` |
| 2025-12-27 | Source du montant facturé : `totalBilled` prioritaire sur `budget` |
| 2025-12-27 | Affichage 0€ (au lieu de "-") quand données présentes mais marge nulle |
