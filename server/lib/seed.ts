import { storage } from "../storage";

export async function seedDatabase() {
  // Create account
  const account = await storage.createAccount({
    name: "Planbase Demo",
    ownerEmail: "alex@planbase.com",
  });

  // Create users
  const owner = await storage.createUser({
    accountId: account.id,
    email: "alex@planbase.com",
    name: "Alex Johnson",
    role: "owner",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  });

  const member1 = await storage.createUser({
    accountId: account.id,
    email: "marie@planbase.com",
    name: "Marie Dubois",
    role: "member",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marie",
  });

  const member2 = await storage.createUser({
    accountId: account.id,
    email: "pierre@planbase.com",
    name: "Pierre Martin",
    role: "member",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Pierre",
  });

  // Create clients
  const client1 = await storage.createClient({
    accountId: account.id,
    name: "Marie Dubois",
    type: "individual",
    email: "marie@techstartup.com",
    company: "TechStartup SAS",
    position: "CEO & Founder",
    sector: "Technology",
    status: "in_progress",
    budget: 25000,
    tags: ["B2B", "SaaS"],
    createdBy: owner.id,
  });

  const client2 = await storage.createClient({
    accountId: account.id,
    name: "Pierre Martin",
    type: "individual",
    email: "p.martin@innovcorp.fr",
    company: "InnovCorp",
    position: "Directeur Innovation",
    sector: "Technology",
    status: "prospect",
    budget: 15000,
    tags: ["B2B"],
    createdBy: owner.id,
  });

  const client3 = await storage.createClient({
    accountId: account.id,
    name: "Sophie Laurent",
    type: "individual",
    email: "s.laurent@greentech.io",
    company: "GreenTech Solutions",
    position: "CMO",
    sector: "Sustainability",
    status: "signed",
    budget: 35000,
    tags: ["B2B", "Green Tech"],
    createdBy: owner.id,
  });

  // Create projects
  const project1 = await storage.createProject({
    accountId: account.id,
    name: "FinTech Startup MVP",
    description: "Business Plan & Legal Setup",
    clientId: client1.id,
    status: "active",
    progress: 75,
    color: "#7C3AED",
    createdBy: owner.id,
  });

  const project2 = await storage.createProject({
    accountId: account.id,
    name: "E-commerce Platform",
    description: "Product Development & Marketing",
    clientId: client2.id,
    status: "active",
    progress: 45,
    color: "#3B82F6",
    createdBy: owner.id,
  });

  const project3 = await storage.createProject({
    accountId: account.id,
    name: "GreenTech Solution",
    description: "Roadmap & Finance Planning",
    clientId: client3.id,
    status: "active",
    progress: 90,
    color: "#10B981",
    createdBy: owner.id,
  });

  // Create tasks for project 1
  await storage.createTask({
    accountId: account.id,
    projectId: project1.id,
    title: "MVP Product Design",
    description: "Créer les maquettes et prototypes pour la version beta",
    status: "todo",
    priority: "high",
    assignees: [member1.id, member2.id],
    order: 1,
    createdBy: owner.id,
  });

  await storage.createTask({
    accountId: account.id,
    projectId: project1.id,
    title: "Market Research",
    description: "Analyser la concurrence et les tendances du marché",
    status: "todo",
    priority: "medium",
    assignees: [member1.id],
    order: 2,
    createdBy: owner.id,
  });

  await storage.createTask({
    accountId: account.id,
    projectId: project1.id,
    title: "Business Plan Rédaction",
    description: "Finaliser le business plan pour la levée de fonds",
    status: "in_progress",
    priority: "high",
    progress: 65,
    assignees: [member1.id],
    order: 3,
    createdBy: owner.id,
  });

  await storage.createTask({
    accountId: account.id,
    projectId: project1.id,
    title: "Wireframes Mobile",
    description: "Validation des maquettes par l'équipe produit",
    status: "review",
    priority: "medium",
    assignees: [member2.id],
    order: 4,
    createdBy: owner.id,
  });

  await storage.createTask({
    accountId: account.id,
    projectId: project1.id,
    title: "Logo Design",
    description: "Identité visuelle complète",
    status: "done",
    priority: "low",
    assignees: [member1.id],
    order: 5,
    createdBy: owner.id,
  });

  // Create notes
  await storage.createNote({
    accountId: account.id,
    title: "Stratégie de lancement produit Q1 2024",
    content: { blocks: [{ type: "paragraph", content: "Analyse des tendances marché et définition de la stratégie de positionnement pour le lancement du nouveau produit SaaS. Focus sur l'acquisition client B2B..." }] },
    category: "marketing",
    tags: ["TechCorp", "SaaS Launch"],
    clientId: client1.id,
    projectId: project1.id,
    attachments: [{ name: "market-analysis.pdf" }, { name: "positioning.doc" }, { name: "budget.xlsx" }],
    createdBy: owner.id,
  });

  await storage.createNote({
    accountId: account.id,
    title: "Feedback utilisateurs - Dashboard V2",
    content: { blocks: [{ type: "paragraph", content: "Compilation des retours utilisateurs sur la nouvelle interface dashboard. Points d'amélioration identifiés : navigation, filtres avancés, performance mobile..." }] },
    category: "product",
    tags: [],
    projectId: project2.id,
    attachments: [],
    createdBy: owner.id,
  });

  await storage.createNote({
    accountId: account.id,
    title: "Prévisions budget 2024 - Startup",
    content: { blocks: [{ type: "paragraph", content: "Projection financière détaillée pour 2024 incluant les coûts d'acquisition client, salaires équipe, infrastructure cloud et marketing digital..." }] },
    category: "finance",
    tags: ["StartupCo", "Budget 2024"],
    attachments: [{ name: "budget-2024.xlsx" }, { name: "projections.pdf" }],
    createdBy: owner.id,
  });

  await storage.createNote({
    accountId: account.id,
    title: "Contrat partenariat - TechVenture",
    content: { blocks: [{ type: "paragraph", content: "Points clés du contrat de partenariat stratégique avec TechVenture. Clauses de propriété intellectuelle, revenus partagés et exclusivité territoriale..." }] },
    category: "legal",
    tags: ["TechVenture"],
    attachments: [{ name: "contract.pdf" }, { name: "amendments.doc" }],
    createdBy: owner.id,
  });

  // Create folders
  const rootFolder = await storage.createFolder({
    accountId: account.id,
    name: "Documentation",
    path: "/Documentation",
    createdBy: owner.id,
  });

  const productFolder = await storage.createFolder({
    accountId: account.id,
    name: "Produit",
    parentId: rootFolder.id,
    path: "/Documentation/Produit",
    createdBy: owner.id,
  });

  // Create documents
  await storage.createDocument({
    accountId: account.id,
    folderId: productFolder.id,
    name: "Product_Specs_v3.pdf",
    type: "pdf",
    url: "/docs/product-specs.pdf",
    size: 2457600, // 2.4 MB
    category: "product",
    projectId: project1.id,
    version: 3,
    createdBy: owner.id,
  });

  await storage.createDocument({
    accountId: account.id,
    folderId: productFolder.id,
    name: "MP_Requirements.doc",
    type: "word",
    url: "/docs/requirements.doc",
    size: 1258291, // 1.2 MB
    category: "product",
    createdBy: owner.id,
  });

  await storage.createDocument({
    accountId: account.id,
    folderId: productFolder.id,
    name: "Roadmap.xlsx",
    type: "excel",
    url: "/docs/roadmap.xlsx",
    size: 876544, // 856 KB
    category: "product",
    projectId: project1.id,
    createdBy: owner.id,
  });

  // Create activities
  await storage.createActivity({
    accountId: account.id,
    type: "client_onboarded",
    description: "New client onboarded",
    userId: owner.id,
    metadata: { clientId: client1.id },
  });

  await storage.createActivity({
    accountId: account.id,
    type: "document_signed",
    description: "Legal documents signed",
    userId: owner.id,
    metadata: { documentId: "doc-1" },
  });

  await storage.createActivity({
    accountId: account.id,
    type: "business_plan_updated",
    description: "Business plan updated",
    userId: owner.id,
    metadata: { projectId: project1.id },
  });

  await storage.createActivity({
    accountId: account.id,
    type: "campaign_launched",
    description: "Marketing campaign launched",
    userId: owner.id,
    metadata: {},
  });

  return { account, owner };
}
