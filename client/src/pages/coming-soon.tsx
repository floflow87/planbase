import { Rocket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-violet-100 p-4 rounded-full">
              <Rocket className="w-12 h-12 text-violet-600" />
            </div>
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            {title}
          </h1>
          <p className="text-muted-foreground">
            {description || "Cette fonctionnalité arrive bientôt !"}
          </p>
          <p className="text-sm text-muted-foreground">
            Nous travaillons activement sur ce module pour vous offrir la meilleure expérience possible.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
