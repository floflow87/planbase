# 📋 Patch Notes - Planbase (Novembre 2025)
**Depuis l'export PDF jusqu'à aujourd'hui**

---

## 📊 Burn Down Chart - Recommandations Intelligentes (Janvier 2026)

Le graphique Burn Down affiche désormais des recommandations contextuelles avec code couleur basées sur l'analyse de la courbe de consommation.

### Algorithme d'Analyse
L'algorithme analyse 3 métriques clés :
- **Coefficient de Variation (CV)** : Mesure la régularité de la courbe (CV < 50% = régulier)
- **Ratio de livraison tardive** : Compare la consommation 1ère vs 2ème moitié du sprint
- **Consommation vs Idéal** : Compare le rythme actuel au rythme linéaire optimal

### 4 Cas de Recommandation

| Cas | Condition | Message | Couleur | Icône |
|-----|-----------|---------|---------|-------|
| 1 | Courbe régulière + projection OK | "Rythme maîtrisé, pas d'action requise" | Vert | CheckCircle |
| 2 | Courbe régulière mais trop haute en fin | "Rythme stable mais insuffisant → risque de débordement" | Orange | AlertCircle |
| 3 | Chute tardive (courbe plate puis chute) | "Livraison tardive → risque de stress, qualité et dette technique" | Rouge | XCircle |
| 4 | Chute trop rapide | "Sous-estimation initiale ou tickets trop grossiers" | Amber | AlertTriangle |

### Conditions de Déclenchement
- **Cas 1** : CV < 50% ET sprints restants <= 2
- **Cas 2** : CV < 50% ET sprints restants > 2 ET restant > 30% du total initial
- **Cas 3** : Ratio 2ème/1ère moitié > 2 ET CV > 50%
- **Cas 4** : Consommation > 150% de l'idéal ET restant < 30% du total initial

---

## ✅ Critères d'Acceptation des Tickets (Janvier 2026)

Les tickets (User Stories, Tasks, Bugs) peuvent désormais avoir des critères d'acceptation gérés directement depuis le panneau de détail.

### Fonctionnalités
- **Ajout** : Champ de saisie avec bouton "+" ou touche Entrée
- **Modification** : Clic sur un critère pour édition inline, sauvegarde au blur ou Entrée
- **Suppression** : Icône corbeille au survol pour supprimer un critère
- **Numérotation** : Affichage ordonné avec numéros (1., 2., 3., ...)

### Architecture
- **Table** : `ticket_acceptance_criteria` avec support multi-type (user_story, task, bug)
- **API** : CRUD complet via `/api/tickets/:ticketId/:ticketType/acceptance-criteria`
- **UI** : Section positionnée avant "Recette" dans le panneau de détail

### Usage
1. Ouvrir un ticket (User Story, Task ou Bug)
2. Scroller jusqu'à "Critères d'acceptation"
3. Saisir un critère et appuyer sur Entrée ou cliquer sur "+"
4. Cliquer sur un critère pour le modifier
5. Survoler et cliquer sur la corbeille pour supprimer

---

## 🎯 Nouvelles Fonctionnalités Majeures

### 1. 📊 **Système de Gestion des Tâches Amélioré**

#### **Sélecteur Multi-Projets avec Checkboxes** ⭐ NEW
- Sélection multiple de projets simultanément
- Interface avec checkboxes au lieu de radio buttons
- Affichage intelligent :
  - "Tous les projets" si tout sélectionné
  - "Nom du projet" si un seul
  - "X projets sélectionnés" si plusieurs
- **Persistence** : Sélection sauvegardée automatiquement dans localStorage
- **Performance** : Requêtes optimisées, pas de fetch inutile

#### **Barre de Progression d'Échéance avec Gradient de Couleurs** 🎨
- Visualisation intuitive de l'urgence des tâches
- **Niveaux d'urgence** :
  - 🔴 **Rouge** (100%) : Tâche dépassée
  - 🟠 **Orange** (75%) : ≤ 2 jours restants
  - 🟠 **Orange** (50%) : 3 jours restants
  - 🟡 **Jaune** (35%) : 5 jours restants
  - 🟢 **Vert** (15%) : 8 jours restants
  - 🟢 **Vert** (1%) : > 8 jours restants
- Gradient automatique selon les jours restants
- Affichage dans ListView et TaskDetailModal

#### **Bouton de Complétion de Tâche** ✓
- Nouveau bouton "check" dans le modal de détail
- Positionné à gauche du titre "Détails de la tâche"
- Toggle rapide entre "todo" ↔ "done"
- Style : 10px border-radius, 40x40px
- Icône CheckCircle2 intégrée

#### **Vue Calendrier des Tâches Étendue** 📅
- **3 modes de vue** : Mensuelle, Hebdomadaire, Quotidienne
- Navigation avec boutons précédent/suivant
- Synchronisation avec la page `/calendar`
- Switch pour afficher/masquer les tâches dans le calendrier

#### **Toggle de Visibilité des Tâches dans Calendrier** 🔄
- Remplacement du bouton par un composant Switch
- Ordre réorganisé des contrôles :
  1. Nouveau rendez-vous
  2. Google Calendar
  3. Tasks toggle
- Interface plus cohérente

#### **Tri Persistant dans ListView** 📋
- Sauvegarde automatique de l'ordre de tri dans localStorage
- Restauration automatique au retour
- Fonctionne pour toutes les colonnes triables

---

### 2. 📄 **Système de Documents Intelligent**

#### **Sélection Multiple de Documents** ✨
- Checkboxes pour sélectionner plusieurs documents
- Actions groupées disponibles :
  - Téléchargement en masse
  - Suppression en masse
  - Changement de statut en masse
- Compteur de sélection
- Bouton "Tout sélectionner / Tout désélectionner"

#### **Formulaire de Création de Documents Avancé** 🚀
- **Autocomplete entreprise** : Recherche intelligente avec SIRET
- **Création de projet intégrée** :
  - Créer un nouveau projet directement depuis le formulaire
  - Lier automatiquement le document au nouveau projet
  - Pas besoin de sortir du flux de création
- **Champ SIRET** : Identification unique des entreprises
- **Liaison projet améliorée** : Utilise le bon endpoint API

---

### 3. 📝 **Protection des Notes** 🛡️

#### **Anti-Perte de Données pour Autosave**
- **Problème résolu** : L'autosave ne supprime plus accidentellement le contenu
- **Protection intelligente** :
  - Détecte si une note avec contenu devient vide
  - Bloque la sauvegarde si suspect
  - Warning en console pour debugging
- **Garantie** : Vos données importantes sont protégées

---

### 4. 👤 **Page Profil Utilisateur** 🎨

#### **Améliorations du Profil**
- Interface redessinée
- Formulaire de modification des informations
- Gestion des préférences
- +148 lignes de nouvelles fonctionnalités

---

### 5. 📊 **Dashboard & CRM**

#### **Dashboard Enrichi**
- Nouveaux widgets et statistiques
- +43 lignes d'améliorations
- Meilleure visualisation des données

#### **CRM Optimisé**
- Tri persistant des données
- Sauvegarde des préférences utilisateur
- Interface plus réactive

---

## 🔧 Améliorations Techniques

### Backend
- **Nouveaux endpoints API** : +29 lignes dans `server/routes.ts`
- **Migrations de démarrage** : Amélioration du système de migration
- **Tables de documents** : Optimisation de la structure

### Frontend
- **+1775 lignes** de nouvelles fonctionnalités
- **-256 lignes** de code obsolète supprimé
- **21 fichiers** modifiés pour amélioration
- **Performance** : Requêtes optimisées et cache intelligent

### Base de Données
- **Nouveau champ** : SIRET pour les entreprises (schema.ts)
- **Migrations automatiques** : Synchronisation améliorée
- **Intégrité** : Meilleures relations entre tables

---

## 📈 Statistiques de la Session

```
Total des commits : 20+
Fichiers modifiés : 21
Lignes ajoutées  : +1,775
Lignes supprimées: -256
Net              : +1,519 lignes
```

---

## 🎨 Design & UX

### Nouvelles Couleurs de Progression
```css
--task-ok: 142 71% 45%;      /* Vert - Tâche ok */
--task-soon: 45 93% 47%;     /* Jaune - À venir */
--task-urgent: 25 95% 53%;   /* Orange - Urgent */
--task-overdue: 0 84% 60%;   /* Rouge - Dépassée */
```

### Composants Ajoutés/Améliorés
- ✅ Checkbox pour sélection multiple
- 🔄 Switch pour toggles
- 📊 Progress bars avec gradients
- 🎯 Boutons de complétion stylisés
- 📅 Sélecteurs de vue calendrier

---

## 🔐 Sécurité & Stabilité

### Protection des Données
- ✅ Anti-perte de contenu dans l'autosave
- ✅ Validation des sauvegardes avant commit
- ✅ Warnings en console pour debugging

### Performance
- ⚡ Requêtes conditionnelles optimisées
- 💾 Cache invalidation ciblée
- 🔄 Persistence intelligente dans localStorage

---

## 📦 Persistence & État

### localStorage Keys
```typescript
"tasks_selected_project_ids"  // Sélection multi-projets
"note-{id}-autosave"          // État autosave par note
"noteListPageSize"            // Taille de page des notes
"taskListSortOrder"           // Ordre de tri des tâches
"crmSortOrder"                // Ordre de tri CRM
"projectsSortOrder"           // Ordre de tri projets
```

---

## 🐛 Corrections de Bugs

1. ✅ **Autosave ne supprime plus le contenu** des notes
2. ✅ **Liaison de projets** aux documents corrigée
3. ✅ **Endpoint API** pour les liens de documents
4. ✅ **Tri persistant** fonctionne correctement
5. ✅ **Sélection de projets** restaurée au retour sur la page

---

## 🚀 À Venir

### Prochaines Fonctionnalités Planifiées
- [ ] Export PDF multi-documents
- [ ] Notifications en temps réel
- [ ] Gestion des versions de documents
- [ ] Intégration complète Google Calendar
- [ ] Dashboard personnalisable

---

## 📖 Documentation Technique

### Fichiers Principaux Modifiés
1. **`client/src/pages/tasks.tsx`** (+551 lignes)
   - Sélecteur multi-projets
   - Vues calendrier
   - Progress bars

2. **`client/src/pages/documents-template-form.tsx`** (+469 lignes)
   - Autocomplete entreprise
   - Création de projet intégrée
   - Champ SIRET

3. **`client/src/pages/documents.tsx`** (+270 lignes)
   - Sélection multiple
   - Actions groupées

4. **`client/src/pages/profile.tsx`** (+148 lignes)
   - Interface profil redesignée

5. **`client/src/components/ListView.tsx`** (+134 lignes)
   - Progress bars d'échéance
   - Tri amélioré

---

## 💡 Exemples d'Utilisation

### Sélectionner Plusieurs Projets
```typescript
// L'utilisateur peut maintenant :
1. Cocher "Projet A"
2. Cocher "Projet B"
3. Voir "2 projets sélectionnés"
4. Visualiser toutes les tâches de A et B ensemble
```

### Voir l'Urgence d'une Tâche
```typescript
// Une tâche due dans 2 jours affiche :
- Barre de progression à 75%
- Couleur orange
- Indication visuelle claire
```

### Créer un Document Rapidement
```typescript
// Flux simplifié :
1. Ouvrir formulaire de document
2. Taper nom d'entreprise → autocomplete avec SIRET
3. Besoin d'un nouveau projet ? Créer directement
4. Document créé et lié automatiquement
```

---

## 🎓 Notes de Migration

### Pour les Développeurs
- **localStorage** : Nouvelle clé `tasks_selected_project_ids` (array)
- **API** : Pas de breaking changes
- **Types** : Nouveaux types pour multi-sélection
- **Cache** : Invalidation optimisée

### Pour les Utilisateurs
- ✅ Toutes les préférences sont conservées
- ✅ Migration automatique des données
- ✅ Pas d'action requise

---

## ✨ Remerciements

Merci pour votre patience durant ces améliorations majeures !
Vos données et votre productivité sont notre priorité.

---

**Version**: Post-Export PDF (Novembre 2025)  
**Statut**: ✅ Stable et prêt pour production  
**Tests**: ✅ Validé par l'architecte
