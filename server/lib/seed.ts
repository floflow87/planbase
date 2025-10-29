// Seed database with demo data for Supabase
import { storage } from "../storage";
import type { Account, AppUser, Client, Project } from "@shared/schema";

export async function seedDatabase() {
  console.log("🌱 Seeding Supabase database...");

  // 1. Create demo account
  const account = await storage.createAccount({
    name: "Demo Startup",
    plan: "pro",
    settings: {
      theme: "dark",
      notifications: true,
    },
  });
  console.log(`✅ Account created: ${account.id}`);

  // 2. Create owner user
  const owner = await storage.createUser({
    id: crypto.randomUUID(),
    accountId: account.id,
    email: "owner@demo.com",
    role: "owner",
    profile: {
      firstName: "Jean",
      lastName: "Dupont",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jean",
    },
  });
  console.log(`✅ Owner created: ${owner.id}`);

  // 3. Create collaborator
  const collaborator = await storage.createUser({
    id: crypto.randomUUID(),
    accountId: account.id,
    email: "collaborator@demo.com",
    role: "collaborator",
    profile: {
      firstName: "Marie",
      lastName: "Martin",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marie",
    },
  });
  console.log(`✅ Collaborator created: ${collaborator.id}`);

  // 4. Create demo clients
  const clients: Client[] = [];
  
  const clientsData = [
    {
      name: "TechCorp Solutions",
      type: "company" as const,
      status: "active",
      budget: "50000.00",
      contacts: [
        { name: "Pierre Laurent", email: "pierre@techcorp.com", phone: "+33612345678", role: "CEO" }
      ],
      tags: ["tech", "b2b", "saas"],
      notes: "Client premium avec fort potentiel de croissance",
    },
    {
      name: "Sophie Bernard",
      type: "person" as const,
      status: "prospecting",
      budget: "15000.00",
      contacts: [
        { name: "Sophie Bernard", email: "sophie.bernard@email.com", phone: "+33698765432", role: "Freelance Designer" }
      ],
      tags: ["design", "freelance"],
      notes: "Recherche refonte site web + identité visuelle",
    },
    {
      name: "Green Energy Partners",
      type: "company" as const,
      status: "negotiating",
      budget: "120000.00",
      contacts: [
        { name: "Marc Dubois", email: "marc@greenenergy.fr", phone: "+33687654321", role: "CTO" }
      ],
      tags: ["greentech", "b2b", "enterprise"],
      notes: "Opportunité de partenariat stratégique",
    },
  ];

  for (const clientData of clientsData) {
    const client = await storage.createClient({
      accountId: account.id,
      createdBy: owner.id,
      ...clientData,
    });
    clients.push(client);
    console.log(`✅ Client created: ${client.name}`);
  }

  // 5. Create demo projects
  const projects: Project[] = [];

  const projectsData = [
    {
      name: "Refonte Site Web TechCorp",
      clientId: clients[0].id,
      stage: "in_progress",
      budget: "25000.00",
      tags: ["web", "design", "dev"],
      meta: {
        deadline: "2025-03-31",
        team: ["owner", "collaborator"],
        tech: ["React", "TypeScript", "Tailwind"],
      },
    },
    {
      name: "Branding Sophie Bernard",
      clientId: clients[1].id,
      stage: "discovery",
      budget: "8000.00",
      tags: ["branding", "design"],
      meta: {
        deadline: "2025-02-15",
        deliverables: ["Logo", "Charte graphique", "Templates"],
      },
    },
    {
      name: "Plateforme IoT Green Energy",
      clientId: clients[2].id,
      stage: "planning",
      budget: "95000.00",
      tags: ["iot", "backend", "frontend"],
      meta: {
        deadline: "2025-06-30",
        complexity: "high",
        team: ["owner", "collaborator", "external-devs"],
      },
    },
  ];

  for (const projectData of projectsData) {
    const project = await storage.createProject({
      accountId: account.id,
      createdBy: owner.id,
      ...projectData,
    });
    projects.push(project);
    console.log(`✅ Project created: ${project.name}`);
  }

  // 6. Create activities
  const activitiesData = [
    {
      subjectType: "client" as const,
      subjectId: clients[0].id,
      kind: "email" as const,
      payload: {
        subject: "Réunion kick-off planifiée",
        snippet: "Rendez-vous confirmé pour le 15 novembre",
      },
    },
    {
      subjectType: "project" as const,
      subjectId: projects[0].id,
      kind: "meeting" as const,
      payload: {
        title: "Sprint Planning #1",
        duration: "2h",
        participants: ["owner", "collaborator"],
      },
    },
    {
      subjectType: "client" as const,
      subjectId: clients[1].id,
      kind: "call" as const,
      payload: {
        duration: "30min",
        notes: "Discussion sur les attentes et le budget",
      },
    },
  ];

  for (const activityData of activitiesData) {
    await storage.createActivity({
      accountId: account.id,
      createdBy: owner.id,
      ...activityData,
    });
  }
  console.log(`✅ Activities created`);

  // 7. Create demo notes
  const note1 = await storage.createNote({
    accountId: account.id,
    createdBy: owner.id,
    title: "Stratégie Q1 2025",
    content: [
      { type: "heading", content: "Objectifs principaux" },
      { type: "paragraph", content: "1. Augmenter le CA de 40%" },
      { type: "paragraph", content: "2. Recruter 2 développeurs seniors" },
      { type: "paragraph", content: "3. Lancer la nouvelle offre SaaS" },
    ],
    plainText: "Stratégie Q1 2025\nObjectifs principaux\n1. Augmenter le CA de 40%\n2. Recruter 2 développeurs seniors\n3. Lancer la nouvelle offre SaaS",
    status: "active",
    visibility: "account",
  });
  console.log(`✅ Note created: ${note1.title}`);

  // 8. Create folder structure
  const rootFolder = await storage.createFolder({
    accountId: account.id,
    createdBy: owner.id,
    name: "Documents",
    scope: "generic",
  });

  const clientsFolder = await storage.createFolder({
    accountId: account.id,
    createdBy: owner.id,
    parentId: rootFolder.id,
    name: "Clients",
    scope: "client",
  });
  console.log(`✅ Folders created`);

  console.log("\n🎉 Seeding completed successfully!");
  console.log(`\n📊 Demo Account ID: ${account.id}`);
  console.log(`👤 Owner Email: ${owner.email}`);
  console.log(`👥 Collaborator Email: ${collaborator.email}`);
  console.log(`\n💡 Tip: Save this account ID in localStorage: localStorage.setItem("demo_account_id", "${account.id}")`);

  return {
    account,
    owner,
    collaborator,
    clients,
    projects,
  };
}
