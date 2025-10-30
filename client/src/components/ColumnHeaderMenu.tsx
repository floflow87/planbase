import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit3, Palette, Trash2 } from "lucide-react";
import type { TaskColumn } from "@shared/schema";

interface ColumnHeaderMenuProps {
  column: TaskColumn;
  onRename: (column: TaskColumn) => void;
  onChangeColor: (column: TaskColumn) => void;
  onDelete: (column: TaskColumn) => void;
}

export function ColumnHeaderMenu({
  column,
  onRename,
  onChangeColor,
  onDelete,
}: ColumnHeaderMenuProps) {
  const isLocked = Boolean(column.isLocked);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          data-testid={`button-column-menu-${column.id}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid={`menu-column-${column.id}`}>
        <DropdownMenuItem
          onClick={() => onRename(column)}
          disabled={isLocked}
          data-testid="menu-item-rename"
        >
          <Edit3 className="mr-2 h-4 w-4" />
          Renommer
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => onChangeColor(column)}
          disabled={isLocked}
          data-testid="menu-item-change-color"
        >
          <Palette className="mr-2 h-4 w-4" />
          Changer la couleur
        </DropdownMenuItem>
        
        {!isLocked && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(column)}
              className="text-destructive"
              data-testid="menu-item-delete"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
