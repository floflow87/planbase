// Update "Terminé" column color to lighter pastel green
import { db } from "../server/db";
import { taskColumns } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function updateTermineColor() {
  console.log("Updating 'Terminé' column color to #d1fae5...");
  
  try {
    const result = await db
      .update(taskColumns)
      .set({ color: '#d1fae5' })
      .where(
        and(
          eq(taskColumns.name, 'Terminé'),
          eq(taskColumns.isLocked, 1)
        )
      )
      .returning();
    
    console.log(`✅ Updated ${result.length} 'Terminé' columns`);
    console.log("New color: #d1fae5 (ultra-light pastel green)");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating columns:", error);
    process.exit(1);
  }
}

updateTermineColor();
