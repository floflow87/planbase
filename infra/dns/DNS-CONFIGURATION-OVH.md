# Configuration DNS OVH pour Déploiement Replit

## Étape 1: Publier votre application sur Replit

1. Cliquez sur le bouton **"Publish"** en haut de votre workspace Replit
2. Choisissez le type de déploiement:
   - **Autoscale** (recommandé pour SaaS) - scale automatiquement avec le trafic
   - **Reserved VM** - serveur dédié avec ressources garanties
   - **Static** - pour sites statiques uniquement
3. Suivez les instructions pour configurer votre déploiement

## Étape 2: Récupérer les enregistrements DNS depuis Replit

Après publication:

1. Allez dans l'onglet **"Deployments"**
2. Cliquez sur **"Settings"**
3. Sélectionnez **"Link a domain"** ou **"Manually connect from another registrar"**
4. Entrez votre nom de domaine (ex: `planbase.com` ou `www.planbase.com`)
5. Replit vous fournira:
   - **Enregistrement A** - l'adresse IP du serveur Replit
   - **Enregistrement TXT** - pour la vérification du domaine

Exemple:
```
Type: A
Nom: @ (ou votre domaine racine)
Valeur: 35.190.XX.XX (IP fournie par Replit)

Type: TXT
Nom: @ (ou votre domaine racine)
Valeur: replit-verification=xxxxxxxxxxxxxx
```

## Étape 3: Configurer DNS sur OVH

### Accéder à la gestion DNS OVH

1. Connectez-vous à votre **compte OVH**: https://www.ovh.com/manager/
2. Dans le menu de gauche, cliquez sur **"Noms de domaine"**
3. Sélectionnez votre domaine (ex: `planbase.com`)
4. Allez dans l'onglet **"Zone DNS"**

### Ajouter les enregistrements DNS

#### Pour le domaine racine (planbase.com)

1. **Enregistrement A** (obligatoire):
   - Cliquez sur **"Ajouter une entrée"**
   - Type: **A**
   - Sous-domaine: **@ (laisser vide)** ou entrez juste `.`
   - Cible/Valeur: **L'adresse IP fournie par Replit** (ex: `35.190.XX.XX`)
   - TTL: **3600** (1 heure) ou laissez par défaut

2. **Enregistrement TXT** (pour la vérification):
   - Cliquez sur **"Ajouter une entrée"**
   - Type: **TXT**
   - Sous-domaine: **@ (laisser vide)** ou `.`
   - Cible/Valeur: **Le code de vérification Replit** (ex: `replit-verification=abc123...`)
   - TTL: **3600**

#### Pour un sous-domaine (www.planbase.com)

Si vous voulez aussi configurer `www.planbase.com`:

1. **Enregistrement A pour www**:
   - Type: **A**
   - Sous-domaine: **www**
   - Cible: **Même IP que le domaine racine**
   - TTL: **3600**

2. **OU utiliser un CNAME** (alternative):
   - Type: **CNAME**
   - Sous-domaine: **www**
   - Cible: **planbase.com.** (n'oubliez pas le point final!)
   - TTL: **3600**

### Supprimer les anciens enregistrements (si nécessaire)

Si votre domaine pointe déjà vers un autre serveur:

1. Dans la **Zone DNS**, trouvez les anciens enregistrements A pointant vers une autre IP
2. Cliquez sur l'icône **"Poubelle"** pour les supprimer
3. Validez la suppression

## Étape 4: Vérifier et valider

### Sur OVH
1. Cliquez sur **"Modifier en mode textuel"** pour voir tous vos enregistrements DNS
2. Vérifiez que vos enregistrements A et TXT sont corrects
3. Cliquez sur **"Suivant"** puis **"Valider"**

### Sur Replit
1. Retournez dans **Deployments > Settings > Custom Domains**
2. Le statut devrait passer de **"Pending"** à **"Verified"** (peut prendre quelques minutes)
3. Une fois vérifié, Replit génère automatiquement un **certificat SSL/TLS** pour HTTPS

## Étape 5: Temps de propagation DNS

- **Minimum**: 5-10 minutes
- **Maximum**: 24-48 heures (rare)
- **Moyenne**: 1-2 heures

### Vérifier la propagation DNS

Utilisez ces outils en ligne:
- https://dnschecker.org/ - vérifier la propagation mondiale
- https://mxtoolbox.com/SuperTool.aspx - outil complet DNS

Ou en ligne de commande:
```bash
# Vérifier l'enregistrement A
dig planbase.com
# ou
nslookup planbase.com

# Vérifier l'enregistrement TXT
dig TXT planbase.com
```

## Configuration DNS finale recommandée

Voici un exemple de zone DNS complète sur OVH:

```
Type    Sous-domaine    Cible/Valeur                      TTL
-------------------------------------------------------------
A       @               35.190.XX.XX (IP Replit)          3600
A       www             35.190.XX.XX (IP Replit)          3600
TXT     @               replit-verification=abc123...     3600
```

## Points importants

✅ **SSL/TLS automatique**: Replit fournit HTTPS automatiquement (Let's Encrypt)
✅ **Pas de configuration nginx/apache**: Replit gère tout
✅ **Support des sous-domaines**: Ajoutez autant de sous-domaines que nécessaire
✅ **Redirection automatique**: Configurez `www` → `racine` ou vice-versa dans Replit

⚠️ **Attention**:
- OVH n'accepte **PAS** le symbole `@` comme sous-domaine - laissez vide ou utilisez `.`
- N'oubliez **PAS** le point final dans les CNAME (ex: `planbase.com.`)
- Videz le cache DNS de votre navigateur si le site ne s'affiche pas: `chrome://net-internals/#dns`

## Support

Si problèmes:
1. Vérifiez que les DNS OVH sont corrects (mode textuel)
2. Testez la propagation DNS avec dnschecker.org
3. Vérifiez le statut dans Replit > Deployments > Settings
4. Contactez le support OVH ou Replit si nécessaire

---

**Votre application sera accessible sur**:
- https://planbase.com ✅
- https://www.planbase.com ✅ (si configuré)
- Avec certificat SSL/TLS valide 🔒
