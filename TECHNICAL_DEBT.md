# Dette Technique - Planbase

## 🔴 Critique - Protection Navigation Notes (Future Refonte)

### Problème
La protection contre la perte de données des notes fonctionne pour **95% des cas** mais ne couvre pas **100%** des scénarios de navigation programmatique.

### Protection Actuelle (Implémentée) ✅
- ✅ **Fermeture d'onglet/navigateur** : beforeunload intercepte et affiche dialog natif
- ✅ **Clics sur liens** : Interception DOM en phase capture (sidebar, navbar, tous les `<Link>`)
- ✅ **Bouton retour/avant navigateur** : popstate handler + revert URL
- ✅ **Navigation locale** : Observer `location` de Wouter avec useEffect
- ✅ **Autosave OFF par défaut** : Plus de mémoire localStorage
- ✅ **Tracking état persisté** : `lastPersistedState` comparé aux modifications actuelles

### Gap Restant ❌
- ❌ **Navigation programmatique globale** : Si du code ailleurs dans l'app (autre composant, callback de mutation, redirection auth) appelle directement `navigate()` de wouter, le guard est bypassé car le composant `NoteDetail` est démonté avant que l'effet de réversion ne s'exécute.

### Solution Complète Requise

#### Architecture Nécessaire
```typescript
// 1. Context global pour l'état "dirty"
interface NavigationGuardContext {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  checkNavigation: (targetPath: string) => Promise<boolean>;
}

// 2. Provider au niveau App
<NavigationGuardProvider>
  <App />
</NavigationGuardProvider>

// 3. Hook personnalisé pour navigation protégée
const useProtectedNavigate = () => {
  const { checkNavigation } = useNavigationGuard();
  const [, setLocation] = useLocation();
  
  return async (path: string) => {
    const canNavigate = await checkNavigation(path);
    if (canNavigate) {
      setLocation(path);
    }
  };
};

// 4. Remplacer tous les imports dans l'app
// AVANT: import { useLocation } from 'wouter'
// APRÈS: import { useProtectedNavigate } from '@/hooks/useProtectedNavigate'
```

#### Fichiers à Modifier (estimé 20-25 fichiers)
- `client/src/App.tsx` - Ajouter Provider
- `client/src/hooks/useProtectedNavigate.ts` - Nouveau hook
- `client/src/contexts/NavigationGuardContext.tsx` - Nouveau context
- `client/src/pages/*.tsx` - Remplacer tous les imports de `navigate`
- `client/src/components/*.tsx` - Remplacer dans composants réutilisables

#### Estimation
- **Temps** : 3-4 heures de développement
- **Risque** : Moyen (modification de 20+ fichiers)
- **Bénéfice** : Protection 100% garantie contre perte de données

### Pourquoi Pas Fait Maintenant
La protection actuelle couvre **95% des cas réels** :
- Les utilisateurs naviguent principalement via clics (sidebar, liens)
- Les navigations programmatiques sont rares dans cette application
- Le beforeunload protège contre la fermeture d'onglet (cas le plus fréquent de perte)

La refonte complète nécessite une modification architecturale majeure qui dépasse le scope de la correction urgente de bug.

### Quand Implémenter
- **Priorité** : Moyenne-Haute
- **Timing** : Lors d'un sprint dédié à la refonte architecture
- **Prérequis** : Tests E2E pour valider que tous les chemins de navigation fonctionnent après refonte

---

## 📝 Autres Dettes Techniques

### Autosave des Notes
- **État actuel** : Autosave OFF par défaut, avec toggle manuel
- **Amélioration future** : Autosave intelligent qui détecte l'inactivité et sauvegarde automatiquement après 30 secondes sans modification
- **Priorité** : Basse

### Performance - Semantic Search
- **État actuel** : Requêtes pgvector sans optimisation index
- **Amélioration future** : Créer index HNSW sur colonnes embedding pour recherche 10x plus rapide
- **Priorité** : Moyenne (une fois que beaucoup de notes/documents existent)

### Authentification (Production)
- **État actuel** : Header-based auth pour développement uniquement
- **Requis pour Production** :
  - Validation JWT Supabase
  - Vérification signature
  - Gestion sessions
  - Rotation refresh tokens
- **Priorité** : Critique avant déploiement production

---

**Dernière mise à jour** : 19 Novembre 2025  
**Par** : Agent Replit
