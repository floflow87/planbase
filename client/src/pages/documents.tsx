import { useState } from "react";
import { Search, Filter, Home, ChevronRight, LayoutGrid, List, Upload, FolderPlus, FileText, File, Image, FileSpreadsheet, FileType, Link, Music, Archive, MoreVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Documents() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Mock folder tree
  const folders = [
    {
      id: "root",
      name: "Racine",
      icon: Home,
      expanded: true,
      children: [
        { id: "clients", name: "Clients", count: 8, children: [] },
        { id: "projects", name: "Projets internes", count: 12, children: [] },
        {
          id: "documentation",
          name: "Documentation",
          count: 24,
          expanded: true,
          children: [
            { id: "product", name: "Produit", count: 8 },
            { id: "technique", name: "Technique", count: 6 },
            { id: "equipe", name: "Équipe", count: 4 },
            { id: "fundraising", name: "Levée de fonds", count: 6 },
          ],
        },
      ],
    },
  ];

  // Mock files
  const files = [
    {
      id: "1",
      name: "Product_Specs_v3.pdf",
      type: "pdf",
      size: "2.4 MB",
      updatedAt: "Modifié il y a 2h",
      author: { name: "P", color: "bg-violet-500" },
    },
    {
      id: "2",
      name: "MP_Requirements.doc",
      type: "word",
      size: "1.2 MB",
      updatedAt: "Modifié il y a 1j",
      author: { name: "T", color: "bg-blue-500" },
    },
    {
      id: "3",
      name: "Esture_Roadmap.xlsx",
      type: "excel",
      size: "856 KB",
      updatedAt: "Modifié il y a 3j",
      author: { name: "F", color: "bg-green-500" },
    },
    {
      id: "4",
      name: "UI_Mockups_v2.png",
      type: "image",
      size: "3.1 MB",
      updatedAt: "Modifié il y a 1 sem",
      author: { name: "D", color: "bg-orange-500" },
    },
    {
      id: "5",
      name: "AIGenerated_Analysis",
      type: "note",
      size: "Doc IA",
      updatedAt: "Modifié il y a 2h",
      author: { name: "AI", color: "bg-violet-500" },
    },
    {
      id: "6",
      name: "Figma Design System",
      type: "link",
      size: "Lien externe - figma.com",
      updatedAt: "Modifié il y a 4h",
      author: { name: "F", color: "bg-cyan-500" },
    },
    {
      id: "7",
      name: "Notes_Reunion_Equipe",
      type: "note",
      size: "Note - Modifié il y a 4h",
      updatedAt: "",
      author: { name: "N", color: "bg-indigo-500" },
    },
    {
      id: "8",
      name: "Assets_Export_v1.zip",
      type: "zip",
      size: "12.5 MB",
      updatedAt: "Modifié il y a 1 sem",
      author: { name: "A", color: "bg-pink-500" },
    },
  ];

  const getFileIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-8 h-8 text-red-600" />;
      case "word":
        return <FileType className="w-8 h-8 text-blue-600" />;
      case "excel":
        return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
      case "image":
        return <Image className="w-8 h-8 text-orange-600" />;
      case "link":
        return <Link className="w-8 h-8 text-cyan-600" />;
      case "note":
        return <FileText className="w-8 h-8 text-violet-600" />;
      case "audio":
        return <Music className="w-8 h-8 text-purple-600" />;
      case "zip":
        return <Archive className="w-8 h-8 text-gray-600" />;
      default:
        return <File className="w-8 h-8 text-gray-600" />;
    }
  };

  const FolderTree = ({ items, level = 0 }: any) => (
    <div className={level > 0 ? "ml-4" : ""}>
      {items.map((item: any) => (
        <div key={item.id}>
          <div className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer text-sm">
            {item.icon ? <item.icon className="w-4 h-4 text-muted-foreground" /> : <FileText className="w-4 h-4 text-muted-foreground" />}
            <span className="flex-1 text-foreground">{item.name}</span>
            {item.count !== undefined && (
              <Badge variant="secondary" className="text-xs">{item.count}</Badge>
            )}
          </div>
          {item.children && item.expanded && (
            <FolderTree items={item.children} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex-1 overflow-hidden bg-background flex" data-testid="page-documents">
      {/* Left Sidebar - Folder Explorer */}
      <div className="w-72 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-heading font-semibold text-lg mb-3">Explorer</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              className="pl-9"
              data-testid="input-search-files"
            />
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-2 justify-start gap-2" data-testid="button-filter">
            <Filter className="w-4 h-4" />
            Filtres
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <FolderTree items={folders} />
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Breadcrumb & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Home className="w-4 h-4 text-muted-foreground" />
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Documentation</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-foreground">Produit</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border border-border rounded-md p-1">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  data-testid="button-view-grille"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-liste"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="outline" className="gap-2" data-testid="button-importer">
                <Upload className="w-4 h-4" />
                Importer
              </Button>
              <Button className="gap-2" data-testid="button-nouveau">
                <FolderPlus className="w-4 h-4" />
                Nouveau
              </Button>
            </div>
          </div>

          {/* Files Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((file) => (
              <Card key={file.id} className="hover-elevate cursor-pointer transition-shadow" data-testid={`card-file-${file.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      {getFileIcon(file.type)}
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground truncate">{file.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{file.size}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    {file.updatedAt && (
                      <span className="text-xs text-muted-foreground">{file.updatedAt}</span>
                    )}
                    <div className={`w-6 h-6 rounded-full ${file.author.color} flex items-center justify-center text-xs text-white font-medium`}>
                      {file.author.name}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Storage Indicator */}
          <Card className="mt-8">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Stockage:</span>
                <span className="text-sm text-muted-foreground">21 GB / 5 GB</span>
              </div>
              <Progress value={42} className="h-2" indicatorClassName="bg-violet-600" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">24 éléments</span>
                <span className="text-xs text-muted-foreground">Trié par date de modification</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
