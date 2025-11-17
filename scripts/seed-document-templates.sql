-- ============================================
-- Seed document templates
-- Execute this SQL in Supabase SQL Editor
-- ============================================

-- Template 1: NDA / Accord de confidentialité
INSERT INTO document_templates (
  id,
  account_id,
  name,
  description,
  category,
  icon,
  is_system,
  form_schema,
  content_template
) VALUES (
  gen_random_uuid(),
  NULL, -- System template
  'NDA / Accord de confidentialité',
  'Accord de non-divulgation pour protéger les informations confidentielles',
  'legal',
  'FileText',
  1,
  '[
    {"name": "transmetteur_raison_sociale", "label": "Raison sociale du transmetteur", "type": "text", "required": true},
    {"name": "transmetteur_identifiant", "label": "Identifiant du transmetteur (SIRET)", "type": "text", "required": true},
    {"name": "transmetteur_role", "label": "Rôle du transmetteur", "type": "text", "required": false},
    {"name": "prestataire_nom", "label": "Nom complet du prestataire", "type": "text", "required": true},
    {"name": "prestataire_date_naissance", "label": "Date de naissance du prestataire", "type": "date", "required": true},
    {"name": "prestataire_adresse", "label": "Adresse du prestataire", "type": "text", "required": true},
    {"name": "prestataire_identifiant", "label": "Identifiant du prestataire (SIRET)", "type": "text", "required": true},
    {"name": "projet_nom", "label": "Nom du projet", "type": "text", "required": true},
    {"name": "projet_url", "label": "URL du projet", "type": "text", "required": false},
    {"name": "projet_description", "label": "Description du projet", "type": "textarea", "required": true},
    {"name": "date_signature", "label": "Date de signature", "type": "date", "required": true},
    {"name": "lieu_signature", "label": "Lieu de signature", "type": "text", "required": true},
    {"name": "duree_confidentialite", "label": "Durée de confidentialité", "type": "text", "required": true, "placeholder": "ex: 5 ans"},
    {"name": "juridiction", "label": "Juridiction applicable", "type": "text", "required": true, "placeholder": "ex: français"},
    {"name": "support_information", "label": "Support d''information", "type": "text", "required": false, "placeholder": "ex: documents, maquettes, etc."},
    {"name": "autorisation_acces_plateforme", "label": "Autorisation d''accès plateforme", "type": "text", "required": false, "placeholder": "ex: lecture seule, modification, etc."}
  ]'::jsonb,
  '**ENTRE LES SOUSSIGNÉS,**

**{{transmetteur_raison_sociale}}**, immatriculé **{{transmetteur_identifiant}}**, dûment habilité pour la signature des présentes,

Ci-après dénommée **"la Société"**

**D''UNE PART,**

ET

**{{prestataire_nom}}**, né le **{{prestataire_date_naissance}}**, domicilié **{{prestataire_adresse}}**, immatriculé **{{prestataire_identifiant}}**,

Ci-après dénommé **"le Prestataire"**

**D''AUTRE PART,**

---

### 🟣 **Préambule**

Dans le cadre du projet **{{projet_nom}}**, notamment relatif à **{{projet_description}}**, la Société souhaite transmettre au Prestataire des informations confidentielles aux fins de collaboration et d''analyse de faisabilité. Les Parties reconnaissent que la confidentialité constitue un élément essentiel du projet.

---

### **Article 1 — Définitions**

Sont considérées comme *informations confidentielles* toutes informations ou données communiquées sous forme orale, écrite, numérique ou matérielle, incluant notamment : documents internes, feuilles de route, idées, maquettes, supports techniques, identifiants, accès, documents stratégiques, listes de clients, business plans et codes d''accès éventuels, y compris **{{support_information}}**.

---

### **Article 2 — Obligations du Prestataire**

Le Prestataire s''engage notamment à :

1. Protéger les informations avec la même rigueur que ses propres données sensibles
2. Ne pas les divulguer ou transférer à des tiers sans accord écrit
3. Ne pas les exploiter à son profit ou pour un client tiers
4. Ne pas contourner, reproduire, désassembler ou imiter les éléments communiqués
5. Ne pas créer d''accès détournés, outils d''extraction, mécanismes de copie ou re-vente

L''accès technique fourni (ex: plateforme, dépôt, site, drive) :

→ **{{autorisation_acces_plateforme}}**

La Société peut révoquer cet accès **sans préavis ni justification**.

---

### **Article 3 — Durée**

Le présent NDA prend effet à compter du **{{date_signature}}** et est valable **{{duree_confidentialite}}** à compter de la transmission de la dernière information.

---

### **Article 4 — Restitution et suppression**

À première demande, le Prestataire doit :

- Restituer l''ensemble des éléments remis
- Supprimer irrévocablement copies, captures, backups ou dérivés
- Fournir une confirmation de suppression si demandé

---

### **Article 5 — Propriété**

La transmission n''emporte aucune cession de propriété ou de droit d''exploitation.

Les informations demeurent la propriété exclusive de la Société.

---

### **Article 6 — Droit applicable**

Le présent contrat est soumis au droit **{{juridiction}}**.

---

### **Article 7 — Signature**

Fait à **{{lieu_signature}}**, le **{{date_signature}}**

En deux exemplaires originaux.'
) ON CONFLICT DO NOTHING;

-- Template 2: Clause de non-concurrence
INSERT INTO document_templates (
  id,
  account_id,
  name,
  description,
  category,
  icon,
  is_system,
  form_schema,
  content_template
) VALUES (
  gen_random_uuid(),
  NULL,
  'Clause de non-concurrence',
  'Engagement de non-concurrence et non-sollicitation',
  'legal',
  'Shield',
  1,
  '[
    {"name": "employeur_ou_societe", "label": "Nom de l''employeur ou société", "type": "text", "required": true},
    {"name": "employeur_identifiant", "label": "Identifiant de l''employeur (SIRET)", "type": "text", "required": true},
    {"name": "prestataire_nom", "label": "Nom complet du prestataire", "type": "text", "required": true},
    {"name": "prestataire_date_naissance", "label": "Date de naissance", "type": "date", "required": true},
    {"name": "prestataire_adresse", "label": "Adresse du prestataire", "type": "text", "required": true},
    {"name": "prestataire_identifiant", "label": "Identifiant du prestataire", "type": "text", "required": true},
    {"name": "projet_nom", "label": "Nom du projet", "type": "text", "required": true},
    {"name": "projet_description", "label": "Description du projet", "type": "textarea", "required": true},
    {"name": "date_signature", "label": "Date de signature", "type": "date", "required": true},
    {"name": "lieu_signature", "label": "Lieu de signature", "type": "text", "required": true},
    {"name": "duree_non_concurrence", "label": "Durée de non-concurrence", "type": "text", "required": true, "placeholder": "ex: 2 ans"},
    {"name": "duree_non_solicitation", "label": "Durée de non-sollicitation", "type": "text", "required": true, "placeholder": "ex: 1 an"},
    {"name": "zone_geographique", "label": "Zone géographique", "type": "text", "required": true, "placeholder": "ex: France, Europe, Monde"},
    {"name": "type_activite_interdite", "label": "Type d''activité interdite", "type": "textarea", "required": true},
    {"name": "penalites_ou_indemnites", "label": "Pénalités ou indemnités", "type": "text", "required": false},
    {"name": "juridiction", "label": "Juridiction applicable", "type": "text", "required": true}
  ]'::jsonb,
  '**ENTRE LES SOUSSIGNÉS,**

**{{employeur_ou_societe}}**, immatriculé **{{employeur_identifiant}}**, dûment habilité, ci-après dénommée **"la Société"**,

**D''UNE PART,**

ET

**{{prestataire_nom}}**, né le **{{prestataire_date_naissance}}**, domicilié **{{prestataire_adresse}}**, immatriculé **{{prestataire_identifiant}}**,

Ci-après dénommé **"le Prestataire"**,

**D''AUTRE PART,**

---

### **Préambule**

Dans le cadre du projet **{{projet_nom}}**, portant notamment sur **{{projet_description}}**, la Société et le Prestataire ont entrepris une relation professionnelle impliquant l''accès à des informations stratégiques, savoir-faire, ressources clients et méthodes commerciales.

Afin de protéger la valeur économique, la réputation, les actifs immatériels et la relation commerciale de la Société, les Parties conviennent de formaliser les engagements de non-concurrence et de non-sollicitation dans les conditions suivantes.

---

### **Article 1 — Objet du présent accord**

Le présent accord vise à :

1. Empêcher toute **activité concurrente directe ou indirecte** au détriment de la Société
2. Interdire la **sollicitation ou débauchage** de collaborateurs, prestataires, clients, affiliés ou prospects
3. Garantir la **protection des actifs stratégiques, commerciaux et relationnels** de la Société

---

### **Article 2 — Engagement de non-concurrence**

Le Prestataire s''engage à **ne pas exercer, créer, rejoindre, conseiller ou collaborer** avec une entité, produit ou activité susceptible de concurrencer la Société, directement ou indirectement, dans le domaine suivant :

**{{type_activite_interdite}}**

Cette interdiction s''applique :

- Pendant la durée du projet ou contrat
- Ainsi que **pendant {{duree_non_concurrence}}** après la fin de la relation professionnelle
- Sur la zone géographique suivante : **{{zone_geographique}}**

Cette clause **ne bloque pas le droit fondamental au travail**, mais vise uniquement les activités constituant une atteinte économique, stratégique ou commerciale.

---

### **Article 3 — Engagement de non-sollicitation**

Pendant la durée du présent accord et **pendant {{duree_non_solicitation}}** suivant sa cessation, le Prestataire s''interdit de :

1. Solliciter, démarcher, recruter ou employer :
    - salariés
    - indépendants
    - partenaires commerciaux
    - sous-traitants
2. Démarcher, contacter ou traiter directement avec :
    - clients actifs
    - clients historiques
    - prospects qualifiés
    - leads transmis
    - membres d''un programme, communauté, plateforme ou portefeuille

Que ce soit **au profit de lui-même ou d''un tiers**.

---

### **Article 4 — Indemnités & responsabilité**

En cas de violation constatée, le Prestataire pourra être redevable d''une **indemnité compensatoire**, indépendamment des recours potentiels, fixée contractuellement ou évaluée par un tribunal compétent.

Indemnité prévue : **{{penalites_ou_indemnites}}**

---

### **Article 5 — Exceptions et limites**

La présente clause ne s''applique pas si :

- l''activité ne porte aucune atteinte commerciale ou réputationnelle
- l''offre ou le projet n''est pas concurrent selon périmètre défini
- l''accord fait l''objet d''un **avenant écrit signé**

---

### **Article 6 — Durée**

La clause prend effet à compter de la signature du présent document et pour la durée définie aux articles précédents.

---

### **Article 7 — Droit applicable et juridiction**

Le présent accord est soumis au droit **{{juridiction}}**.

Tout litige sera soumis à la juridiction compétente.

---

### **Signature**

Fait à **{{lieu_signature}}**, le **{{date_signature}}**

En deux exemplaires originaux.

**La Société**

Nom : ___________________ | Signature : _______

**Le Prestataire**

Nom : ___________________ | Signature : _______'
) ON CONFLICT DO NOTHING;

-- Template 3: Contrat de cession de propriété intellectuelle
INSERT INTO document_templates (
  id,
  account_id,
  name,
  description,
  category,
  icon,
  is_system,
  form_schema,
  content_template
) VALUES (
  gen_random_uuid(),
  NULL,
  'Contrat de cession de propriété intellectuelle',
  'Cession des droits de propriété intellectuelle',
  'legal',
  'Copyright',
  1,
  '[
    {"name": "societe_nom", "label": "Nom de la société cessionnaire", "type": "text", "required": true},
    {"name": "societe_identifiant", "label": "Identifiant de la société (SIRET)", "type": "text", "required": true},
    {"name": "cessionnaire_role", "label": "Rôle du cessionnaire", "type": "text", "required": false},
    {"name": "prestataire_nom", "label": "Nom complet du cédant", "type": "text", "required": true},
    {"name": "prestataire_date_naissance", "label": "Date de naissance du cédant", "type": "date", "required": true},
    {"name": "prestataire_adresse", "label": "Adresse du cédant", "type": "text", "required": true},
    {"name": "prestataire_identifiant", "label": "Identifiant du cédant", "type": "text", "required": true},
    {"name": "objet_cede", "label": "Objet cédé", "type": "text", "required": true},
    {"name": "description_oeuvre", "label": "Description de l''œuvre", "type": "textarea", "required": true},
    {"name": "date_signature", "label": "Date de signature", "type": "date", "required": true},
    {"name": "lieu_signature", "label": "Lieu de signature", "type": "text", "required": true},
    {"name": "montant_cession", "label": "Montant de la cession", "type": "text", "required": true, "placeholder": "ex: 5000€"},
    {"name": "modalites_paiement", "label": "Modalités de paiement", "type": "text", "required": true, "placeholder": "ex: 50% à la signature, 50% à la livraison"},
    {"name": "droits_cedes", "label": "Droits cédés", "type": "textarea", "required": true, "placeholder": "ex: reproduction, représentation, adaptation"},
    {"name": "territoires", "label": "Territoires", "type": "text", "required": true, "placeholder": "ex: Monde entier"},
    {"name": "duree", "label": "Durée de la cession", "type": "text", "required": true, "placeholder": "ex: durée légale maximale"},
    {"name": "usage_autorise", "label": "Usage autorisé", "type": "textarea", "required": true},
    {"name": "restrictions", "label": "Restrictions éventuelles", "type": "textarea", "required": false},
    {"name": "garanties", "label": "Garanties du cédant", "type": "textarea", "required": false},
    {"name": "mention_auteur", "label": "Mention de l''auteur", "type": "text", "required": false, "placeholder": "ex: Crédit obligatoire"},
    {"name": "juridiction", "label": "Juridiction applicable", "type": "text", "required": true}
  ]'::jsonb,
  '**ENTRE LES SOUSSIGNÉS :**

**{{societe_nom}}**, immatriculé **{{societe_identifiant}}**, dûment habilité à représenter l''entreprise,

ci-après dénommée **"le Cessionnaire"**,

**D''UNE PART,**

ET

**{{prestataire_nom}}**, né le **{{prestataire_date_naissance}}**, domicilié **{{prestataire_adresse}}**, immatriculé **{{prestataire_identifiant}}**,

ci-après dénommé **"le Cédant"**,

**D''AUTRE PART.**

---

### **Préambule**

Dans le cadre des travaux réalisés par le Cédant, portant sur la création, conception, rédaction, design, développement, production ou livraison des éléments suivants :

**{{description_oeuvre}}**, liés au projet **{{objet_cede}}**, les Parties conviennent de formaliser une **cession totale ou partielle des droits de propriété intellectuelle**, afin de clarifier l''exploitation, la diffusion, la reproduction et l''usage commercial de l''œuvre concernée.

---

### **Article 1 — Objet de la cession**

Le présent contrat a pour objet la **cession des droits patrimoniaux** relatifs à **{{description_oeuvre}}**, au profit du Cessionnaire, dans le cadre professionnel et commercial de ses activités.

---

### **Article 2 — Étendue des droits cédés**

La présente cession peut porter, selon les cas, sur tout ou partie des droits suivants :

- Droit de reproduction
- Droit de représentation
- Droit d''adaptation, modification, traduction, dérivation
- Droit de distribution ou diffusion
- Droit de commercialisation
- Droit de reproduction numérique et algorithmique

Les droits cédés sont définis comme suit : **{{droits_cedes}}**.

Toute extension postérieure devra faire l''objet d''un **avenant écrit et signé**.

---

### **Article 3 — Durée et territoire**

- Durée de la cession : **{{duree}}**
- Territoires concernés : **{{territoires}}**

À défaut de précision, la cession est réputée :

- **sans limitation territoriale**
- **limitée dans la durée légale maximale autorisée par le droit applicable**

---

### **Article 4 — Usage, exploitation & modifications**

Le Cessionnaire est autorisé à exploiter l''œuvre, la modifier, l''adapter, la combiner ou la distribuer, dans les limites suivantes :

**{{usage_autorise}}**

En cas de restrictions souhaitées par le Cédant, celles-ci doivent être précisées ici :

**{{restrictions}}**

---

### **Article 5 — Contrepartie financière**

Le Cessionnaire versera au Cédant :

- Montant total : **{{montant_cession}}**
- Modalités de paiement : **{{modalites_paiement}}**

La signature du présent document vaut **renonciation à toute rémunération ultérieure**, sauf accord complémentaire.

---

### **Article 6 — Garanties du Cédant**

Le Cédant **garantit expressément** que :

1. Il est auteur ou détenteur légitime des droits cédés
2. L''œuvre ne constitue pas une violation de droits tiers
3. Aucun contrat antérieur ne contredit la présente cession

Toute contestation ou litige lié à un droit tiers reste de la **responsabilité du Cédant**.

---

### **Article 7 — Droit moral**

Le droit moral du Cédant demeure **inaliénable**, incluant :

- Attribution (crédit créatif) : **{{mention_auteur}}**
- Respect de l''intégrité de l''œuvre, sauf renonciation limitée

---

### **Article 8 — Droit applicable et juridiction**

Le présent contrat est soumis au droit **{{juridiction}}**.

En cas de litige, les Parties s''engagent à privilégier un règlement amiable avant recours judiciaire.

---

### **Signature**

Fait à **{{lieu_signature}}**, le **{{date_signature}}**,

En deux exemplaires originaux.

**Le Cessionnaire**

Nom : __________________

Signature : _____________

**Le Cédant**

Nom : __________________

Signature : _____________'
) ON CONFLICT DO NOTHING;

-- Template 4: Autorisation d'utilisation d'image et/ou de voix
INSERT INTO document_templates (
  id,
  account_id,
  name,
  description,
  category,
  icon,
  is_system,
  form_schema,
  content_template
) VALUES (
  gen_random_uuid(),
  NULL,
  'Autorisation d''utilisation d''image et/ou de voix',
  'Autorisation pour l''utilisation d''image, voix ou apparence',
  'creative',
  'Camera',
  1,
  '[
    {"name": "identite_titulaire", "label": "Identité complète de l''autorisé(e)", "type": "text", "required": true},
    {"name": "identite_beneficiaire", "label": "Identité du bénéficiaire", "type": "text", "required": true},
    {"name": "nom_projet", "label": "Nom du projet", "type": "text", "required": true},
    {"name": "supports", "label": "Supports d''utilisation", "type": "text", "required": true, "placeholder": "ex: web, print, réseaux sociaux"},
    {"name": "territoire", "label": "Territoire", "type": "text", "required": true, "placeholder": "ex: Monde entier"},
    {"name": "duree", "label": "Durée d''exploitation", "type": "text", "required": true, "placeholder": "ex: 5 ans"},
    {"name": "exploitation_commerciale", "label": "Type d''exploitation", "type": "text", "required": true, "placeholder": "ex: commerciale, non commerciale"},
    {"name": "modifications", "label": "Modifications autorisées", "type": "text", "required": true, "placeholder": "ex: recadrage, filtres"},
    {"name": "gratuit_ou_remunere", "label": "Autorisation gratuite ou rémunérée", "type": "text", "required": true, "placeholder": "ex: À titre gratuit"},
    {"name": "modalites_paiement", "label": "Modalités de paiement si rémunérée", "type": "text", "required": false},
    {"name": "loi_applicable", "label": "Loi applicable", "type": "text", "required": true},
    {"name": "juridiction", "label": "Juridiction compétente", "type": "text", "required": true},
    {"name": "lieu", "label": "Lieu de signature", "type": "text", "required": true},
    {"name": "date", "label": "Date de signature", "type": "date", "required": true}
  ]'::jsonb,
  '**ENTRE LES SOUSSIGNÉS :**

**{{identite_titulaire}}**, ci-après dénommé(e) **"l''Autorisé(e)"**,

**D''UNE PART,**

ET

**{{identite_beneficiaire}}**, ci-après dénommé(e) **"Le Bénéficiaire"**,

**D''AUTRE PART.**

---

### **Préambule**

Dans le cadre du projet **{{nom_projet}}**, le Bénéficiaire souhaite utiliser l''image, la voix ou l''apparence de l''Autorisé(e). Les Parties conviennent des dispositions suivantes afin d''encadrer juridiquement l''exploitation de ces éléments dans un contexte conforme, respectueux et maitrisé.

---

### **Article 1 — Objet de l''autorisation**

L''Autorisé(e) autorise le Bénéficiaire à utiliser, reproduire, enregistrer, conserver, diffuser, représenter publiquement son image, sa voix et/ou son apparence capturée dans le cadre du projet susmentionné.

---

### **Article 2 — Étendue des droits**

L''autorisation couvre les éléments suivants :

- **Supports** : **{{supports}}**
- **Territoire** : **{{territoire}}**
- **Durée d''exploitation** : **{{duree}}**
- **Type d''exploitation** : **{{exploitation_commerciale}}**
- **Modifications autorisées** : **{{modifications}}**

Toute utilisation hors périmètre devra faire l''objet d''un **avenant écrit**.

---

### **Article 3 — Engagements du Bénéficiaire**

Le Bénéficiaire s''engage à :

1. Respecter l''intégrité, l''honneur et la dignité de l''Autorisé(e)
2. Ne pas associer l''image ou la voix à des contenus sensibles ou contraires à l''éthique
3. Respecter l''objet initial du projet et sa nature

---

### **Article 4 — Révocation**

L''autorisation est **irrévocable** pour les exploitations engagées ou archivées, sauf manquement grave, intention malveillante ou atteinte à l''image.

---

### **Article 5 — Contrepartie**

La présente autorisation est accordée :

**{{gratuit_ou_remunere}}**

Si rémunération : **{{modalites_paiement}}**

---

### **Article 6 — Droit applicable**

Le présent contrat est soumis au droit **{{loi_applicable}}**, juridiction **{{juridiction}}**.

---

### **Article 7 — Signatures**

Fait à **{{lieu}}**, le **{{date}}**

En deux exemplaires.

**L''Autorisé(e)**

Signature : ___________________

**Le Bénéficiaire**

Signature : ___________________'
) ON CONFLICT DO NOTHING;

-- Template 5: Contrat de collaboration créative
INSERT INTO document_templates (
  id,
  account_id,
  name,
  description,
  category,
  icon,
  is_system,
  form_schema,
  content_template
) VALUES (
  gen_random_uuid(),
  NULL,
  'Contrat de collaboration créative',
  'Accord de collaboration pour projets créatifs',
  'creative',
  'Users',
  1,
  '[
    {"name": "partie_A", "label": "Identité Partie A", "type": "text", "required": true},
    {"name": "partie_B", "label": "Identité Partie B", "type": "text", "required": true},
    {"name": "nom_projet", "label": "Nom du projet collaboratif", "type": "text", "required": true},
    {"name": "apport_A", "label": "Apport de la Partie A", "type": "textarea", "required": true},
    {"name": "apport_B", "label": "Apport de la Partie B", "type": "textarea", "required": true},
    {"name": "delai_validation", "label": "Délai de validation", "type": "text", "required": true, "placeholder": "ex: 5 jours ouvrés"},
    {"name": "duree", "label": "Durée des droits", "type": "text", "required": true, "placeholder": "ex: durée légale maximale"},
    {"name": "territoires", "label": "Territoires", "type": "text", "required": true, "placeholder": "ex: Monde entier"},
    {"name": "supports", "label": "Supports autorisés", "type": "text", "required": true, "placeholder": "ex: web, print, mobile"},
    {"name": "type_exploitation", "label": "Type d''exploitation", "type": "text", "required": true, "placeholder": "ex: commerciale"},
    {"name": "repartition", "label": "Répartition des revenus", "type": "text", "required": true, "placeholder": "ex: 50/50"},
    {"name": "frequence", "label": "Fréquence de versement", "type": "text", "required": true, "placeholder": "ex: trimestrielle"},
    {"name": "loi_applicable", "label": "Loi applicable", "type": "text", "required": true},
    {"name": "juridiction", "label": "Juridiction compétente", "type": "text", "required": true}
  ]'::jsonb,
  '**ENTRE :**

**{{partie_A}}**, ci-après dénommée **"Partie A"**,

et

**{{partie_B}}**, ci-après dénommée **"Partie B"**.

---

### **Préambule**

Les Parties souhaitent collaborer sur un projet créatif lié à **{{nom_projet}}**, impliquant la conception, réalisation, contribution ou diffusion de contenus artistiques, audiovisuels, rédactionnels ou multimédia.

---

### **Article 1 — Objet**

Le présent contrat a pour objet de définir clairement :

- les conditions de collaboration
- les contributions de chaque Partie
- les droits d''exploitation
- les responsabilités respectives

---

### **Article 2 — Contributions**

- Partie A apporte : **{{apport_A}}**
- Partie B apporte : **{{apport_B}}**
    
    Les Parties reconnaissent une **collaboration équilibrée et documentée**.
    

---

### **Article 3 — Gouvernance et communication**

- Une personne référente par partie est désignée
- Les validations se font **par écrit ou plateforme partagée**
- Les délais de réponse sont raisonnables, à défaut **{{delai_validation}}**

---

### **Article 4 — Propriété intellectuelle**

- Chaque Partie conserve ses droits antérieurs
- Les créations communes deviennent **co-créations**, sauf attribution explicite
- Les droits d''exploitation sont définis comme suit :
    - Durée : **{{duree}}**
    - Territoires : **{{territoires}}**
    - Supports : **{{supports}}**
    - Nature d''exploitation : **{{type_exploitation}}**

---

### **Article 5 — Confidentialité**

Renvoi possible à NDA complémentaire.

---

### **Article 6 — Monétisation et revenus**

- Modèle de partage : **{{repartition}}**
- Transparence comptable obligatoire
- Périodicité du versement : **{{frequence}}**

---

### **Article 7 — Fin de collaboration**

Suspension ou rupture possible en cas de :

- manquement grave
- non-collaboration
- impossibilité technique
- décision mutuelle

Les contenus réalisés doivent faire l''objet d''un **avenant de sortie**.

---

### **Article 8 — Juridiction**

Droit applicable **{{loi_applicable}}**, juridiction **{{juridiction}}**.'
) ON CONFLICT DO NOTHING;

-- Template 6: Contrat de prestation de services
INSERT INTO document_templates (
  id,
  account_id,
  name,
  description,
  category,
  icon,
  is_system,
  form_schema,
  content_template
) VALUES (
  gen_random_uuid(),
  NULL,
  'Contrat de prestation de services',
  'Contrat pour définir une prestation de services professionnelle',
  'contract',
  'FileContract',
  1,
  '[
    {"name": "prestataire", "label": "Nom du prestataire", "type": "text", "required": true},
    {"name": "client", "label": "Nom du client", "type": "text", "required": true},
    {"name": "intitule_mission", "label": "Intitulé de la mission", "type": "text", "required": true},
    {"name": "liste_livrables", "label": "Liste des livrables", "type": "textarea", "required": true},
    {"name": "planning", "label": "Planning prévisionnel", "type": "text", "required": true},
    {"name": "date_fin", "label": "Date de fin", "type": "date", "required": true},
    {"name": "delai_validation", "label": "Délai de validation", "type": "text", "required": true, "placeholder": "ex: 5 jours ouvrés"},
    {"name": "nb_revisions", "label": "Nombre de révisions incluses", "type": "text", "required": true, "placeholder": "ex: 2"},
    {"name": "montant_total", "label": "Montant total", "type": "text", "required": true, "placeholder": "ex: 5000€ HT"},
    {"name": "modalites_paiement", "label": "Modalités de paiement", "type": "textarea", "required": true, "placeholder": "ex: 30% à la commande, 70% à la livraison"},
    {"name": "juridiction", "label": "Juridiction compétente", "type": "text", "required": true}
  ]'::jsonb,
  '**ENTRE :**

**{{prestataire}}**, ci-après **"Le Prestataire"**,

ET

**{{client}}**, ci-après **"Le Client"**.

---

### **Article 1 — Objet**

Le Prestataire s''engage à réaliser **{{intitule_mission}}** selon les modalités définies dans le présent contrat et ses annexes.

---

### **Article 2 — Livrables et planning**

- Livrables : **{{liste_livrables}}**
- Planning : **{{planning}}**
- Deadline finale : **{{date_fin}}**

---

### **Article 3 — Obligations du Prestataire**

- Travailler avec diligence et professionnalisme
- Informer de tout obstacle ou retard
- Produire un résultat conforme au périmètre défini

---

### **Article 4 — Obligations du Client**

- Fournir les ressources, accès et validations nécessaires
- Répondre dans un délai raisonnable **({{delai_validation}})**
- Régler les sommes dues selon l''échéancier

---

### **Article 5 — Révisions**

Inclut **{{nb_revisions}}** révisions ; toute demande supplémentaire est facturable.

---

### **Article 6 — Propriété intellectuelle**

Transfert ou licence d''utilisation selon avenant **PI** associé (fourni séparément).

---

### **Article 7 — Rémunération**

Montant total : **{{montant_total}}**

Modalités : **{{modalites_paiement}}**

---

### **Article 8 — Résiliation**

Possible si :

- inexécution contractuelle
- impayé majeur
- rupture anticipée par volonté mutuelle

---

### **Article 9 — Juridiction**

Droit et tribunal compétents : **{{juridiction}}**'
) ON CONFLICT DO NOTHING;
