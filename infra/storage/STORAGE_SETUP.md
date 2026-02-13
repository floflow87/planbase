# Configuration Supabase Storage pour les images des notes

## ⚠️ IMPORTANT - Politiques RLS requises

L'upload d'images nécessite des politiques RLS correctement configurées dans Supabase Storage.

## Étapes de configuration

### 1. Créer le bucket `note-images`

1. Accédez à votre projet Supabase : https://supabase.com/dashboard
2. Dans le menu latéral, cliquez sur **Storage**
3. Cliquez sur **New bucket**
4. Configurez le bucket :
   - **Nom** : `note-images`
   - **Public bucket** : ✅ COCHÉ (important pour l'accès public en lecture)
   - **File size limit** : Par défaut ou selon vos besoins
5. Cliquez sur **Create bucket**

### 2. Configurer les politiques RLS

Le bucket créé ne permet PAS automatiquement l'upload. Vous devez créer des politiques RLS.

**Méthode 1 : Via l'interface Supabase (Recommandé)**

1. Allez dans **Storage** > Sélectionnez le bucket `note-images`
2. Cliquez sur l'onglet **Policies**
3. Cliquez sur **New Policy**

**Créez 3 politiques :**

#### Policy 1 : Lecture publique
- **Name** : `Public can read note images`
- **Allowed operation** : SELECT
- **Target roles** : `public`
- **Policy definition** :
```sql
bucket_id = 'note-images'
```

#### Policy 2 : Upload pour utilisateurs authentifiés
- **Name** : `Authenticated users can upload note images`  
- **Allowed operation** : INSERT
- **Target roles** : `authenticated`
- **Policy definition** :
```sql
bucket_id = 'note-images'
```

#### Policy 3 : Suppression pour utilisateurs authentifiés
- **Name** : `Users can delete note images`
- **Allowed operation** : DELETE
- **Target roles** : `authenticated`
- **Policy definition** :
```sql
bucket_id = 'note-images'
```

**Méthode 2 : Via SQL Editor**

Si vous préférez utiliser SQL, allez dans **SQL Editor** et exécutez :

```sql
-- Policy 1: Lecture publique
CREATE POLICY "Public can read note images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'note-images');

-- Policy 2: Upload pour utilisateurs authentifiés
CREATE POLICY "Authenticated users can upload note images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'note-images');

-- Policy 3: Suppression pour utilisateurs authentifiés
CREATE POLICY "Users can delete note images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'note-images');
```

## Vérification

Pour vérifier que tout fonctionne :

1. Accédez à **Storage** > `note-images` > **Policies**
2. Vous devriez voir **3 politiques actives** :
   - 1 pour SELECT (public)
   - 1 pour INSERT (authenticated)
   - 1 pour DELETE (authenticated)

3. Testez l'upload :
   - Ouvrez une note dans l'application
   - Cliquez sur l'icône "Image" dans la barre d'outils
   - Sélectionnez une image depuis votre ordinateur
   - L'image devrait être uploadée et affichée dans la note

## Dépannage

### Erreur : "new row violates row-level security policy"

**Cause** : Les politiques RLS ne sont pas configurées ou incorrectes.

**Solution** :
1. Vérifiez que les 3 politiques existent dans **Storage** > `note-images` > **Policies**
2. Vérifiez que la policy INSERT est bien pour le rôle `authenticated` (pas `public`)
3. Vérifiez que `bucket_id = 'note-images'` dans chaque politique

### Erreur : "Bucket not found"

**Cause** : Le bucket `note-images` n'existe pas.

**Solution** : Créez le bucket comme décrit dans l'étape 1.

### L'image ne s'affiche pas

**Cause** : Le bucket n'est pas public ou la policy SELECT n'existe pas.

**Solution** :
1. Vérifiez que le bucket est **Public** dans les paramètres
2. Vérifiez que la policy SELECT existe pour le rôle `public`

## Formats d'images supportés

- PNG
- JPG/JPEG
- GIF
- WebP
- SVG
- BMP

## Limites

- Taille maximale : Définie dans les paramètres du bucket (par défaut Supabase)
- Les images sont stockées dans le bucket public `note-images`
- Les URLs sont publiques et accessibles sans authentification
