# Session de développement - Novembre 2025

## 🎯 Fonctionnalités implémentées

### 1. **Sélecteur multi-projets avec checkboxes** ⭐
**Localisation**: `client/src/pages/tasks.tsx`

**Fonctionnalité**:
- Remplacement du sélecteur radio par des checkboxes permettant la sélection multiple de projets
- Affichage intelligent du texte sélectionné :
  - "Tous les projets" si "all" sélectionné
  - "Nom du projet" si un seul projet
  - "X projets sélectionnés" si plusieurs projets
- Persistence de la sélection dans localStorage
- Optimisation des requêtes (pas de fetches inutiles)

**Comportement**:
- **"Tous les projets"** ou **multi-sélection** : affiche toutes les tâches et colonnes
- **Sélection unique** : affiche uniquement les tâches et colonnes du projet sélectionné
- Cache invalidé correctement après mutations

**Code clé**:
```typescript
// Fonction de toggle de sélection
const toggleProjectSelection = (projectId: string) => {
  if (projectId === "all") {
    setSelectedProjectIds(["all"]);
  } else {
    setSelectedProjectIds(prev => {
      const withoutAll = prev.filter(id => id !== "all");
      if (withoutAll.includes(projectId)) {
        const newSelection = withoutAll.filter(id => id !== projectId);
        return newSelection.length === 0 ? ["all"] : newSelection;
      } else {
        return [...withoutAll, projectId];
      }
    });
  }
};
```

---

### 2. **Barre de progression d'échéance avec gradient de couleurs** 🎨
**Localisation**: `client/src/components/TaskDetailModal.tsx`, `client/src/components/ListView.tsx`

**Fonctionnalité**:
- Barre de progression visuelle indiquant l'urgence d'une tâche selon sa date d'échéance
- Gradient de couleurs reflétant le niveau d'urgence

**Niveaux d'urgence**:
- **Dépassée** : 100% rouge (task-overdue)
- **≤ 2 jours** : 75% orange (task-urgent)
- **3 jours** : 50% orange (task-urgent)
- **5 jours** : 35% jaune (task-soon)
- **8 jours** : 15% vert (task-ok)
- **> 8 jours** : 1% vert (task-ok)

**Code clé**:
```typescript
const getDeadlineProgress = (dueDate: string) => {
  const now = new Date();
  const due = new Date(dueDate);
  const daysRemaining = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysRemaining < 0) return { progress: 100, className: "bg-task-overdue" };
  if (daysRemaining <= 2) return { progress: 75, className: "bg-task-urgent" };
  if (daysRemaining === 3) return { progress: 50, className: "bg-task-urgent" };
  if (daysRemaining <= 5) return { progress: 35, className: "bg-task-soon" };
  if (daysRemaining <= 8) return { progress: 15, className: "bg-task-ok" };
  return { progress: 1, className: "bg-task-ok" };
};
```

**Couleurs CSS**:
```css
--task-ok: 142 71% 45%;      /* Vert */
--task-soon: 45 93% 47%;     /* Jaune */
--task-urgent: 25 95% 53%;   /* Orange */
--task-overdue: 0 84% 60%;   /* Rouge */
```

---

### 3. **Bouton de complétion de tâche dans le modal de détail** ✓
**Localisation**: `client/src/components/TaskDetailModal.tsx`

**Fonctionnalité**:
- Bouton "check" positionné à gauche du titre
- Toggle entre "todo" et "done"
- Style : `h-10 w-10`, `border-radius: 10px`
- Icône `CheckCircle2` de taille `h-6 w-6`

**Code clé**:
```typescript
<Button
  variant={task.status === "done" ? "default" : "outline"}
  size="icon"
  className="h-10 w-10"
  style={{ borderRadius: "10px" }}
  onClick={handleToggleComplete}
>
  <CheckCircle2 className="h-6 w-6" />
</Button>
```

---

### 4. **Vue calendrier des tâches avec sélecteurs de mode** 📅
**Localisation**: `client/src/pages/tasks.tsx`

**Fonctionnalité**:
- Ajout de sélecteurs pour basculer entre les vues :
  - Mensuelle
  - Hebdomadaire  
  - Quotidienne
- Navigation avec boutons précédent/suivant
- Cohérence avec la page `/calendar`

---

### 5. **Switch de visibilité des tâches dans le calendrier** 🔄
**Localisation**: `client/src/pages/calendar.tsx`

**Fonctionnalité**:
- Remplacement du bouton par un composant `Switch`
- Réorganisation de l'ordre des contrôles :
  1. Nouveau rendez-vous
  2. Google Calendar
  3. Tasks toggle

---

### 6. **Protection anti-perte de données pour l'autosave** 🛡️
**Localisation**: `client/src/pages/note-detail.tsx`

**Problème résolu**:
- L'autosave pouvait supprimer accidentellement le contenu d'une note

**Solution**:
- Vérification de sécurité avant sauvegarde
- Blocage si une note avec contenu devient vide sans changement de titre
- Message de warning en console pour debugging

**Code clé**:
```typescript
// SAFETY CHECK: Don't save if content becomes empty and note had content before
const hadContent = note.plainText && note.plainText.trim().length > 0;
const hasContentNow = plainText && plainText.trim().length > 0;

if (hadContent && !hasContentNow && !titleChanged) {
  console.warn('Autosave blocked: content became empty unexpectedly');
  return;
}
```

---

## 🏗️ Améliorations techniques

### Optimisations des requêtes
- Requêtes conditionnelles pour éviter les fetches inutiles
- `globalTaskColumns` ne charge que si `newTaskProjectId === "none"`
- Cache invalidation ciblée pour `/api/tasks` et `/api/task-columns`

### Persistence des préférences
- Sélection de projets sauvegardée dans `localStorage`
- Clé : `tasks_selected_project_ids`
- Restauration automatique au retour sur la page

---

## 📊 Tests et validation

✅ Filtrage multi-projets vérifié par l'architecte  
✅ Protection autosave testée  
✅ Barre de progression d'échéance validée  
✅ UI responsive et intuitive  
✅ Pas de régressions détectées  

---

## 🎨 Design système

### Couleurs de progression
- Vert : Tâche ok (> 8 jours)
- Jaune : À venir (5-8 jours)
- Orange : Urgent (2-5 jours)
- Rouge : Dépassée

### Composants utilisés
- `Checkbox` pour sélection multiple
- `Switch` pour toggles
- `Button` avec variants
- `Progress` pour barres visuelles

---

## 🔍 Détails d'implémentation

### État de sélection multi-projets
```typescript
const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(() => {
  const saved = localStorage.getItem("tasks_selected_project_ids");
  return saved ? JSON.parse(saved) : ["all"];
});
```

### Filtrage des tâches
```typescript
const filteredTasks = selectedProjectIds.includes("all") || selectedProjectIds.length > 1
  ? tasks
  : tasks.filter((t) => t.projectId && selectedProjectIds.includes(t.projectId));
```

---

## 📝 Notes de migration

### localStorage
- Nouvelle clé : `tasks_selected_project_ids` (tableau de strings)
- Ancienne clé : `tasks_selected_project_id` (string unique) - **deprecated**

### API
- Pas de changements backend
- Utilisation optimisée des endpoints existants
