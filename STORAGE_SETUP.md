# Configuration Supabase Storage pour les images des notes

## Prérequis

Pour que l'upload d'images fonctionne dans l'éditeur de notes, vous devez créer un bucket de stockage Supabase.

## Étapes de configuration

1. **Accédez à votre projet Supabase**
   - Allez sur https://supabase.com/dashboard
   - Sélectionnez votre projet

2. **Créez le bucket `note-images`**
   - Dans le menu latéral, cliquez sur "Storage"
   - Cliquez sur "Create a new bucket"
   - Nom du bucket: `note-images`
   - Cochez "Public bucket" (pour permettre l'accès public en lecture)
   - Cliquez sur "Create bucket"

3. **Configurez les politiques de sécurité (RLS)**

   Dans l'onglet "Policies" du bucket `note-images`, créez les politiques suivantes :

   **Policy 1: Lecture publique**
   ```sql
   CREATE POLICY "Public can read note images"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'note-images');
   ```

   **Policy 2: Upload pour utilisateurs authentifiés**
   ```sql
   CREATE POLICY "Authenticated users can upload note images"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'note-images');
   ```

   **Policy 3: Suppression pour utilisateurs authentifiés**
   ```sql
   CREATE POLICY "Users can delete note images"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'note-images');
   ```

## Vérification

Une fois le bucket créé, l'upload d'images devrait fonctionner dans l'éditeur de notes :
1. Ouvrez une note
2. Cliquez sur l'icône "Upload" dans la barre d'outils
3. Sélectionnez une image depuis votre ordinateur
4. L'image devrait être uploadée et insérée dans la note

## Dépannage

Si l'upload ne fonctionne pas :
- Vérifiez que le bucket `note-images` existe
- Vérifiez que le bucket est public
- Vérifiez que les politiques RLS sont correctement configurées
- Consultez les logs du navigateur pour plus de détails sur l'erreur
