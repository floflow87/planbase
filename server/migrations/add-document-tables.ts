import { db } from "../db";
import { sql } from "drizzle-orm";

export async function addDocumentTables() {
  console.log("🔄 Creating document_templates and documents tables...");
  
  try {
    // Create document_templates table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS document_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        form_schema JSONB NOT NULL,
        content_template TEXT NOT NULL,
        is_system BOOLEAN DEFAULT false,
        account_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create documents table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL,
        template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        form_data JSONB,
        plain_text TEXT,
        status TEXT DEFAULT 'draft',
        version INTEGER DEFAULT 1,
        created_by UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Add missing plain_text column if it doesn't exist (for existing tables)
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'documents' AND column_name = 'plain_text'
        ) THEN
          ALTER TABLE documents ADD COLUMN plain_text TEXT;
        END IF;
      END $$;
    `);

    // Add source_type column if it doesn't exist (for PDF generation feature)
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'documents' AND column_name = 'source_type'
        ) THEN
          ALTER TABLE documents ADD COLUMN source_type TEXT NOT NULL DEFAULT 'template';
        END IF;
      END $$;
    `);

    // Add pdf_storage_path column if it doesn't exist (for PDF generation feature)
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'documents' AND column_name = 'pdf_storage_path'
        ) THEN
          ALTER TABLE documents ADD COLUMN pdf_storage_path TEXT;
        END IF;
      END $$;
    `);

    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_document_templates_account ON document_templates(account_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_document_templates_category ON document_templates(category)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_account ON documents(account_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_template ON documents(template_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status)`);

    console.log("✅ Document tables created successfully");
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log("ℹ️  Document tables already exist");
    } else {
      console.error("❌ Error creating document tables:", error);
      throw error;
    }
  }
}

export async function seedDocumentTemplates() {
  console.log("🌱 Seeding document templates...");
  
  try {
    const templates = [
      {
        id: 'f0be4fb9-d347-4764-8eb7-0d50e795b859',
        name: 'NDA / Accord de confidentialité',
        description: 'Accord légal pour protéger les informations confidentielles partagées entre parties',
        category: 'legal',
        formSchema: {
          fields: [
            { name: "transmetteur_raison_sociale", label: "Raison sociale du transmetteur", type: "text", required: true },
            { name: "transmetteur_identifiant", label: "Numéro d'immatriculation (SIRET/RCS)", type: "text", required: false },
            { name: "prestataire_nom", label: "Nom complet du prestataire", type: "text", required: true },
            { name: "prestataire_date_naissance", label: "Date de naissance du prestataire", type: "date", required: false },
            { name: "prestataire_adresse", label: "Adresse du prestataire", type: "text", required: true },
            { name: "prestataire_identifiant", label: "Numéro SIRET/SIREN du prestataire", type: "text", required: false },
            { name: "projet_nom", label: "Nom du projet", type: "text", required: true },
            { name: "projet_description", label: "Description du projet", type: "textarea", required: true },
            { name: "support_information", label: "Supports d'information (ex: documents, accès...)", type: "textarea", required: false },
            { name: "autorisation_accès_plateforme", label: "Autorisations d'accès (plateforme, dépôt...)", type: "textarea", required: false },
            { name: "date_signature", label: "Date de signature", type: "date", required: true },
            { name: "duree_confidentialite", label: "Durée de confidentialité (ex: 5 ans)", type: "text", required: true },
            { name: "juridiction", label: "Droit applicable (ex: français)", type: "text", required: true },
            { name: "lieu_signature", label: "Lieu de signature", type: "text", required: true }
          ]
        },
        contentTemplate: `**ENTRE LES SOUSSIGNÉS,**

**{{transmetteur_raison_sociale}}**{{#if transmetteur_identifiant}}, immatriculé **{{transmetteur_identifiant}}**{{/if}}, dûment habilité pour la signature des présentes,

Ci-après dénommée **"la Société"**

**D'UNE PART,**

**ET**

**{{prestataire_nom}}**{{#if prestataire_date_naissance}}, né le **{{prestataire_date_naissance}}**{{/if}}, domicilié **{{prestataire_adresse}}**{{#if prestataire_identifiant}}, immatriculé **{{prestataire_identifiant}}**{{/if}},

Ci-après dénommé **"le Prestataire"**

**D'AUTRE PART,**

---

## **Préambule**

Dans le cadre du projet ***{{projet_nom}}***, notamment relatif à :

***{{projet_description}}***

La Société souhaite transmettre au Prestataire des **informations confidentielles** aux fins de :
- Collaboration
- Analyse de faisabilité

Les Parties reconnaissent que **la confidentialité constitue un élément essentiel du projet**.

---

## **Article 1 — Définitions**

Sont considérées comme ***informations confidentielles*** toutes informations ou données communiquées sous forme :
- Orale
- Écrite
- Numérique
- Matérielle

Incluant notamment :
- Documents internes
- Feuilles de route
- Idées et maquettes
- Supports techniques
- Identifiants et accès
- Documents stratégiques
- Listes de clients
- Business plans
- Codes d'accès éventuels

Y compris : **{{support_information}}**

---

## **Article 2 — Obligations du Prestataire**

Le Prestataire s'engage ***expressément*** à :

1. **Protéger** les informations avec la même rigueur que ses propres données sensibles
2. **Ne pas divulguer** ou transférer à des tiers sans accord écrit préalable
3. **Ne pas exploiter** à son profit ou pour un client tiers
4. **Ne pas contourner**, reproduire, désassembler ou imiter les éléments communiqués
5. **Ne pas créer** d'accès détournés, outils d'extraction, mécanismes de copie ou re-vente

**Accès technique fourni :**

→ {{autorisation_accès_plateforme}}

***La Société peut révoquer cet accès sans préavis ni justification.***

---

## **Article 3 — Durée**

Le présent NDA prend effet à compter du **{{date_signature}}**

***Durée de validité : {{duree_confidentialite}}*** à compter de la transmission de la dernière information.

---

## **Article 4 — Restitution et suppression**

À première demande, le Prestataire doit :

1. **Restituer** l'ensemble des éléments remis
2. **Supprimer irrévocablement** :
   - Copies
   - Captures d'écran
   - Backups
   - Dérivés
3. **Fournir une confirmation** de suppression si demandé

---

## **Article 5 — Propriété**

***La transmission n'emporte aucune cession de propriété ou de droit d'exploitation.***

Les informations demeurent la **propriété exclusive** de la Société.

---

## **Article 6 — Droit applicable**

Le présent contrat est soumis au droit ***{{juridiction}}***.

---

## **Article 7 — Signature**

Fait à **{{lieu_signature}}**, le **{{date_signature}}**

***En deux exemplaires originaux.***`
      },
      {
        id: '08a88fe3-0d3f-4042-916c-7d5de4d703f1',
        name: 'Clause de non-concurrence',
        description: 'Clause juridique interdisant une activité concurrente pendant une période définie',
        category: 'legal',
        formSchema: {
          fields: [
            { name: "employee", label: "Nom de l'employé", type: "text", required: true },
            { name: "company", label: "Nom de l'entreprise", type: "text", required: true },
            { name: "position", label: "Poste occupé", type: "text", required: true },
            { name: "duration", label: "Durée de non-concurrence (mois)", type: "number", required: true },
            { name: "geographic-scope", label: "Zone géographique", type: "text", required: true }
          ]
        },
        contentTemplate: `CLAUSE DE NON-CONCURRENCE

Entre :
{{company}}, ci-après « l'Employeur »

et

{{employee}}, occupant le poste de {{position}}, ci-après « l'Employé »

1. OBJET
L'Employé s'engage à ne pas exercer, directement ou indirectement, d'activité concurrente à celle de l'Employeur.

2. PORTÉE DE L'INTERDICTION
L'Employé s'interdit de :
- Créer une entreprise concurrente
- Travailler pour un concurrent
- Solliciter les clients de l'Employeur
- Débaucher les employés de l'Employeur

3. DURÉE ET ZONE GÉOGRAPHIQUE
Cette clause s'applique pendant {{duration}} mois suivant la fin du contrat de travail, sur le territoire suivant : {{geographic-scope}}.

4. CONTREPARTIE FINANCIÈRE
En contrepartie de cette obligation, l'Employeur s'engage à verser une indemnité compensatrice.

5. SANCTION
Toute violation de cette clause donnera lieu au paiement de dommages et intérêts.`
      },
      {
        id: '8f46ad52-a6d4-4e09-93be-5136f465fa46',
        name: 'Contrat de cession de propriété intellectuelle',
        description: 'Transfert légal de droits de propriété intellectuelle (brevets, marques, droits d\'auteur)',
        category: 'legal',
        formSchema: {
          fields: [
            { name: "creator", label: "Créateur / Cédant", type: "text", required: true },
            { name: "assignee", label: "Bénéficiaire / Cessionnaire", type: "text", required: true },
            { name: "work-description", label: "Description de l'œuvre", type: "textarea", required: true },
            { name: "consideration", label: "Contrepartie financière", type: "text", required: true },
            { name: "effective-date", label: "Date de prise d'effet", type: "date", required: true }
          ]
        },
        contentTemplate: `CONTRAT DE CESSION DE PROPRIÉTÉ INTELLECTUELLE

Entre :
{{creator}}, ci-après « le Cédant »

et

{{assignee}}, ci-après « le Cessionnaire »

1. OBJET DE LA CESSION
Le Cédant cède au Cessionnaire l'intégralité de ses droits de propriété intellectuelle sur :
{{work-description}}

2. DROITS CÉDÉS
Sont cédés les droits suivants :
- Droit de reproduction
- Droit de représentation
- Droit d'adaptation
- Droit de traduction
- Droit d'exploitation commerciale

3. ÉTENDUE DE LA CESSION
La cession est :
- Totale et exclusive
- Sans limitation de durée
- Valable pour le monde entier
- Pour tous supports et formats

4. GARANTIES
Le Cédant garantit qu'il est le créateur original de l'œuvre et qu'elle ne porte atteinte à aucun droit de tiers.

5. CONTREPARTIE
En contrepartie de cette cession, le Cessionnaire versera au Cédant : {{consideration}}

6. DATE D'EFFET
Ce contrat prend effet à compter du {{effective-date}}.`
      },
      {
        id: 'b4b0664b-3e52-4d55-b7ff-ae6e24f6e85a',
        name: 'Autorisation d\'utilisation d\'image et/ou de voix',
        description: 'Accord pour utiliser l\'image ou la voix d\'une personne dans des productions créatives',
        category: 'creative',
        formSchema: {
          fields: [
            { name: "person", label: "Nom de la personne", type: "text", required: true },
            { name: "producer", label: "Nom du producteur/réalisateur", type: "text", required: true },
            { name: "project", label: "Titre du projet", type: "text", required: true },
            { name: "usage", label: "Utilisation prévue", type: "textarea", required: true },
            { name: "compensation", label: "Rémunération", type: "text", required: true }
          ]
        },
        contentTemplate: `AUTORISATION D'UTILISATION D'IMAGE ET DE VOIX

Je soussigné(e) {{person}}, autorise {{producer}} à utiliser mon image et ma voix dans le cadre du projet intitulé :

« {{project}} »

1. DROITS ACCORDÉS
J'autorise l'utilisation de :
- Mon image (photographies, vidéos, illustrations)
- Ma voix (enregistrements audio, doublages)
- Mon nom et mes déclarations

2. UTILISATION
Cette autorisation couvre les usages suivants :
{{usage}}

3. DURÉE ET TERRITOIRE
Cette autorisation est accordée :
- Sans limitation de durée
- Pour le monde entier
- Sur tous supports et formats

4. RÉMUNÉRATION
En contrepartie, il est convenu : {{compensation}}

5. DROIT DE MODIFICATION
J'autorise les modifications raisonnables de mon image/voix nécessaires à la réalisation du projet, sous réserve du respect de mon image et de ma dignité.

6. DROIT DE RÉTRACTATION
Je reconnais avoir été informé(e) de mon droit de retirer cette autorisation sous conditions.`
      },
      {
        id: 'e839534b-3d46-4ad2-80cc-e728d832b9f0',
        name: 'Contrat de collaboration créative',
        description: 'Accord entre créateurs pour collaborer sur un projet créatif (musique, art, écriture)',
        category: 'creative',
        formSchema: {
          fields: [
            { name: "party-a", label: "Collaborateur A", type: "text", required: true },
            { name: "party-b", label: "Collaborateur B", type: "text", required: true },
            { name: "project", label: "Titre du projet", type: "text", required: true },
            { name: "contributions", label: "Contributions de chacun", type: "textarea", required: true },
            { name: "revenue-split", label: "Partage des revenus (%)", type: "text", required: true }
          ]
        },
        contentTemplate: `CONTRAT DE COLLABORATION CRÉATIVE

Entre :
{{party-a}}, ci-après « Collaborateur A »

et

{{party-b}}, ci-après « Collaborateur B »

1. OBJET
Les parties conviennent de collaborer sur le projet créatif suivant :
« {{project}} »

2. CONTRIBUTIONS
Chaque partie apporte les contributions suivantes :
{{contributions}}

3. PROPRIÉTÉ INTELLECTUELLE
L'œuvre créée est la propriété commune des deux parties à parts égales, sauf accord contraire.

4. PARTAGE DES REVENUS
Les revenus générés par le projet seront répartis comme suit :
{{revenue-split}}

5. PRISE DE DÉCISION
Toutes les décisions importantes concernant le projet (publication, exploitation, modifications) doivent être prises d'un commun accord.

6. CRÉDITS
Chaque partie sera créditée de manière appropriée dans toutes les publications et utilisations de l'œuvre.

7. RÉSOLUTION DES CONFLITS
En cas de désaccord, les parties s'engagent à rechercher une solution amiable avant toute action légale.

8. DURÉE
Ce contrat reste en vigueur jusqu'à l'achèvement du projet ou jusqu'à résiliation d'un commun accord.`
      },
      {
        id: 'd46a769d-71dc-4563-afb5-8ad178098a8c',
        name: 'Contrat de prestation de services',
        description: 'Accord pour la fourniture de services professionnels entre un prestataire et un client',
        category: 'contract',
        formSchema: {
          fields: [
            { name: "provider", label: "Nom du prestataire", type: "text", required: true },
            { name: "client", label: "Nom du client", type: "text", required: true },
            { name: "services", label: "Description des services", type: "textarea", required: true },
            { name: "duration", label: "Durée de la prestation", type: "text", required: true },
            { name: "fees", label: "Honoraires", type: "text", required: true },
            { name: "payment-terms", label: "Modalités de paiement", type: "text", required: true }
          ]
        },
        contentTemplate: `CONTRAT DE PRESTATION DE SERVICES

Entre :
{{provider}}, ci-après « le Prestataire »

et

{{client}}, ci-après « le Client »

1. OBJET
Le Prestataire s'engage à fournir au Client les services suivants :
{{services}}

2. DURÉE
La prestation sera effectuée sur la période suivante : {{duration}}

3. OBLIGATIONS DU PRESTATAIRE
Le Prestataire s'engage à :
- Exécuter la prestation avec professionnalisme et diligence
- Respecter les délais convenus
- Informer le Client de l'avancement des travaux
- Maintenir la confidentialité des informations du Client

4. OBLIGATIONS DU CLIENT
Le Client s'engage à :
- Fournir les informations nécessaires à la réalisation de la prestation
- Collaborer activement avec le Prestataire
- Régler les honoraires selon les modalités convenues

5. RÉMUNÉRATION
Les honoraires pour cette prestation s'élèvent à : {{fees}}

Modalités de paiement : {{payment-terms}}

6. PROPRIÉTÉ INTELLECTUELLE
Sauf accord contraire, le Client devient propriétaire des livrables à l'issue du paiement complet.

7. RÉSILIATION
Chaque partie peut résilier le contrat moyennant un préavis écrit de 30 jours.

8. RESPONSABILITÉ
Le Prestataire est responsable de la bonne exécution de la prestation dans les limites du présent contrat.`
      },
      {
        id: 'c7f9b5d1-2e4a-4c8f-9d3b-1a6e5f8c2d4b',
        name: 'Cahier des Charges Fonctionnel (CDF)',
        description: 'Document structuré pour définir les besoins fonctionnels, le périmètre et les exigences d\'un projet',
        category: 'business',
        formSchema: {
          fields: [
            { name: "project_name", label: "Nom du projet", type: "text", required: true },
            { name: "client_name", label: "Nom du client", type: "text", required: true }
          ]
        },
        contentTemplate: `# Cahier des charges fonctionnel – {{project_name}} – {{client_name}}

## 1. Contexte du projet

Ce document a pour objectif de décrire les besoins fonctionnels du projet **{{project_name}}** pour le compte de **{{client_name}}**.

Le projet s'inscrit dans le contexte suivant :

**Contexte métier :** …

**Enjeux principaux :** …

**Parties prenantes impliquées :** …

---

## 2. Objectifs

L'objectif de ce projet est de :

- …
- …

À travers ce cahier des charges, il s'agit de cadrer précisément :

- Les fonctionnalités attendues,
- Les contraintes à respecter,
- Les livrables à produire.

---

## 3. Périmètre

Le périmètre couvert par ce document inclut :

- …
- …

**Ne sont pas inclus dans le périmètre :**

- …

---

## 4. Utilisateurs & Personas

Les principaux types d'utilisateurs concernés sont :

**Type d'utilisateur 1 :** …

**Type d'utilisateur 2 :** …

Pour chacun, préciser : objectifs, besoins, frustrations.

---

## 5. Parcours et cas d'usage

Les parcours suivants sont considérés comme prioritaires :

**Parcours 1 :** "Un utilisateur souhaite…"

**Parcours 2 :** "Un administrateur doit pouvoir…"

Pour chaque parcours :

- **Étapes clés :** …
- **Points de friction potentiels :** …

---

## 6. Exigences fonctionnelles

Les exigences fonctionnelles sont organisées par grandes fonctionnalités.

Pour chaque fonctionnalité, préciser :

**Intitulé :** …

**Description :** "L'utilisateur doit pouvoir…"

**Règles de gestion :** …

**Exceptions / cas particuliers :** …

---

## 7. Contraintes

Les contraintes identifiées à ce stade sont :

**Contraintes techniques :** …

**Contraintes légales / RGPD :** …

**Contraintes de planning :** …

---

## 8. Livrables attendus

Les livrables attendus dans le cadre de ce projet sont :

- …
- …`
      },
      {
        id: 'a3e8f2c9-5b7d-4a1e-8c3f-2d9b6e4f1a8c',
        name: 'Roadmap Produit (Trimestrielle)',
        description: 'Document de planification stratégique pour organiser les priorités produit sur un trimestre',
        category: 'business',
        formSchema: {
          fields: [
            { name: "project_name", label: "Nom du projet", type: "text", required: true },
            { name: "period_label", label: "Période (ex: T1 2026)", type: "text", required: true }
          ]
        },
        contentTemplate: `# Roadmap produit – {{project_name}} – {{period_label}}

## 1. Contexte & vision

Cette roadmap décrit les priorités produit pour **{{project_name}}** sur la période **{{period_label}}**.

La vision produit à moyen terme est la suivante :

"…"

---

## 2. Objectifs du trimestre

Les objectifs principaux de ce trimestre sont :

**Objectif 1 :** …

**Objectif 2 :** …

**Objectif 3 :** …

---

## 3. Thèmes / axes de travail

Les initiatives sont regroupées par thèmes :

**Thème A – "…"** : …

**Thème B – "…"** : …

---

## 4. Roadmap par mois / sprint

Pour chaque période, lister les initiatives prévues :

### Mois 1 / Sprint 1–2

…

### Mois 2 / Sprint 3–4

…

### Mois 3 / Sprint 5–6

…

---

## 5. Priorisation

La priorisation des sujets se base sur les critères suivants :

**Impact attendu :** …

**Effort estimé :** …

**Risque / dépendances :** …

---

## 6. Risques & points de vigilance

Les principaux risques identifiés sont :

…

Pour chaque risque, préciser un plan d'atténuation.`
      }
    ];

    for (const template of templates) {
      await db.execute(sql`
        INSERT INTO document_templates (id, name, description, category, form_schema, content_template, is_system)
        VALUES (
          ${template.id}::uuid,
          ${template.name},
          ${template.description},
          ${template.category},
          ${JSON.stringify(template.formSchema)}::jsonb,
          ${template.contentTemplate},
          true
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          form_schema = EXCLUDED.form_schema,
          content_template = EXCLUDED.content_template,
          is_system = EXCLUDED.is_system,
          updated_at = NOW()
      `);
    }

    console.log("✅ Document templates seeded successfully (8 templates)");
  } catch (error: any) {
    console.error("❌ Error seeding document templates:", error);
    throw error;
  }
}
