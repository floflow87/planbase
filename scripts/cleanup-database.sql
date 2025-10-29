-- Script SQL pour nettoyer la base de données Supabase
-- ATTENTION : Ce script supprime TOUTES les données sauf votre compte
-- Assurez-vous d'avoir identifié votre ID de compte avant d'exécuter

-- 1. Trouvez d'abord votre ID de compte :
SELECT id, name, owner_email FROM accounts;

-- 2. REMPLACEZ 'VOTRE_ACCOUNT_ID_ICI' par votre vrai ID de compte
-- Exemple : '67a3cb31-7755-43f2-81e0-4436d5d0684f'

-- 3. Décommentez et exécutez les commandes suivantes UNE PAR UNE :

-- Supprimer toutes les tâches qui ne sont pas liées à votre compte
-- DELETE FROM tasks WHERE account_id != 'VOTRE_ACCOUNT_ID_ICI';

-- Supprimer tous les projets qui ne sont pas liés à votre compte
-- DELETE FROM projects WHERE account_id != 'VOTRE_ACCOUNT_ID_ICI';

-- Supprimer tous les clients qui ne sont pas liés à votre compte
-- DELETE FROM clients WHERE account_id != 'VOTRE_ACCOUNT_ID_ICI';

-- Supprimer tous les utilisateurs qui ne sont pas liés à votre compte
-- DELETE FROM app_users WHERE account_id != 'VOTRE_ACCOUNT_ID_ICI';

-- Supprimer tous les autres comptes sauf le vôtre
-- DELETE FROM accounts WHERE id != 'VOTRE_ACCOUNT_ID_ICI';

-- Vérifier ce qui reste
SELECT 'accounts' as table_name, COUNT(*) as count FROM accounts
UNION ALL
SELECT 'app_users', COUNT(*) FROM app_users
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks;
