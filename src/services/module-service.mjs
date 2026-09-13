import { loadWorkspaceData } from './workspace-data.mjs';

export async function listModuleRecords(moduleId) {
    await loadWorkspaceData();
    const { getWorkbookRowsForModule } = await import('../lib/demo-workbook-adapter.mjs');
    return getWorkbookRowsForModule(moduleId);
}
