-- Script de nettoyage: Supprime tous les utilisateurs sauf floflow87
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- D'abord, afficher tous les utilisateurs actuels pour vérification
SELECT id, email, first_name, last_name, role 
FROM app_users 
ORDER BY email;

-- Supprimer tous les utilisateurs sauf floflow87@planbase.com
-- ATTENTION: Cette action est irréversible !
-- Décommentez la ligne suivante pour exécuter la suppression :

-- DELETE FROM app_users 
-- WHERE email != 'floflow87@planbase.com';

-- Vérifier le résultat après suppression
-- SELECT id, email, first_name, last_name, role 
-- FROM app_users 
-- ORDER BY email;
