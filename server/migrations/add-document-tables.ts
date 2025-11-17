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
            { name: "party-a", label: "Partie A (divulgatrice)", type: "text", required: true },
            { name: "party-b", label: "Partie B (réceptrice)", type: "text", required: true },
            { name: "effective-date", label: "Date d'entrée en vigueur", type: "date", required: true },
            { name: "duration", label: "Durée de confidentialité (années)", type: "number", required: true }
          ]
        },
        contentTemplate: `ACCORD DE CONFIDENTIALITÉ

Entre les soussignés :

{{party-a}}, ci-après « la Partie divulgatrice »

et

{{party-b}}, ci-après « la Partie réceptrice »

Il a été convenu ce qui suit :

1. OBJET
La Partie divulgatrice s'engage à communiquer à la Partie réceptrice certaines informations confidentielles dans le cadre de [décrire le contexte].

2. INFORMATIONS CONFIDENTIELLES
Sont considérées comme confidentielles toutes informations, de quelque nature que ce soit, communiquées par la Partie divulgatrice.

3. OBLIGATIONS DE CONFIDENTIALITÉ
La Partie réceptrice s'engage à :
- Garder strictement confidentielles toutes les informations
- Ne pas les divulguer à des tiers sans autorisation écrite préalable
- Les utiliser uniquement aux fins convenues

4. DURÉE
Cet accord entre en vigueur à compter du {{effective-date}} et reste valable pendant {{duration}} ans.

Fait en deux exemplaires originaux,
Le {{effective-date}}`
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
        ON CONFLICT (id) DO NOTHING
      `);
    }

    console.log("✅ Document templates seeded successfully (6 templates)");
  } catch (error: any) {
    console.error("❌ Error seeding document templates:", error);
    throw error;
  }
}
