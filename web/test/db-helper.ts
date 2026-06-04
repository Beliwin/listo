import { ListoDB } from "@/db/dexie";

let counter = 0;
const opened: ListoDB[] = [];

export function freshDb(): ListoDB {
  const db = new ListoDB(`test-${++counter}`);
  opened.push(db);
  return db;
}

export async function cleanupDbs(): Promise<void> {
  for (const db of opened.splice(0)) {
    db.close();
    await db.delete();
  }
}
