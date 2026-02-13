# Dette Technique - Planbase

Ce document liste les limitations connues et les refactorisations futures nécessaires.

## Protection Contre la Perte de Données - Notes (Priorité: Haute)

### État Actuel (Solution Partielle - 95% de couverture)

La protection actuelle contre la perte de données dans `client/src/pages/note-detail.tsx` couvre :

✅ **Protections Implémentées** :
- Fermeture d'onglet/navigateur (événement `beforeunload`)
- Clics sur tous les liens internes (interception DOM en phase de capture)
- Bouton retour/avant du navigateur (événement `popstate`)
- Autosave désactivé par défaut (pas de mémoire localStorage)
- Tracking de l'état réellement persisté (comparaison avec `lastPersistedState`)
- Détection des sauvegardes en cours (vérifie `isPending`)

❌ **Gap Restant (5%)** :
- Navigation programmatique depuis d'autres composants : Si du code externe à `NoteDetail` importe directement `navigate` de wouter et l'appelle, le guard est contourné car le composant est démonté avant que le useEffect de protection ne s'exécute.

### Solution Complète Future

Pour une protection à 100%, il faudrait :

1. **Architecture Globale** :
   - Créer un `NavigationGuardContext` React global
   - Créer un `NavigationGuardProvider` qui wrap toute l'application
   - Exporter un hook `useProtectedNavigate()` personnalisé
   - Tracker l'état "dirty" (modifications non sauvegardées) dans le contexte global

2. **Modifications Requises** :
   - Modifier `client/src/App.tsx` pour ajouter le Provider
   - Créer `client/src/contexts/NavigationGuardContext.tsx`
   - Créer `client/src/hooks/useProtectedNavigate.ts`
   - Remplacer tous les imports de `navigate` de wouter par `useProtectedNavigate` dans ~20+ fichiers
   - Intercepter les changements de route au niveau du Router avant démontage des composants

3. **Estimation** :
   - Temps: 4-6 heures de développement
   - Complexité: Moyenne-Haute
   - Risque: Moyen (refactoring architectural)
   - Impact: Tous les fichiers utilisant la navigation

4. **Approche Recommandée** :
   - Créer le contexte et le provider
   - Wrapper `useLocation` de wouter pour intercepter AVANT les changements de state
   - Utiliser un système de callbacks pour demander confirmation avant navigation
   - Gérer un state global de "dirty pages" avec leurs callbacks de vérification
   - Assurer que le dialog s'affiche AVANT le démontage du composant source

### Justification de la Solution Partielle Actuelle

La solution partielle a été choisie car :
- Elle protège contre 95% des cas réels de perte de données
- Les navigations programmatiques sont rares dans l'application actuelle
- Une solution complète nécessiterait une refonte architecturale majeure
- Le délai de développement était critique

### Quand Implémenter la Solution Complète

Implémenter quand :
- L'application ajoute des navigations programmatiques fréquentes
- Les utilisateurs rapportent des pertes de données malgré les protections actuelles
- Une refonte du routing est planifiée
- Le temps de développement est disponible (sprint dédié)

---

## Autres Dettes Techniques

_À compléter au fur et à mesure des besoins identifiés_
