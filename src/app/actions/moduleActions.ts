"use server";
import { getWorkbookRowsForModule } from '@/lib/demo-workbook-adapter.mjs';

export async function listModuleRecords(moduleId?: string) {
  if (moduleId) {
    try {
      return getWorkbookRowsForModule(moduleId) || [];
    } catch {
      return [];
    }
  }
  return [];
}
