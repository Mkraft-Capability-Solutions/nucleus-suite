import { readData } from '../services/workspace-data.mjs';

export const operationalModules = readData('lib.operational-module-registry', 'modules');
export const operationalNavigationGroups = readData('lib.operational-module-registry', 'groups');
export const operationalNavigationDomains = readData('lib.operational-module-registry', 'domains');

export function getOperationalModule(id) {
    if (!id) return undefined;
    const cleanId = String(id).toLowerCase().replace(/-/g, '_');
    return operationalModules.find((item) =>
        item.id === id ||
        item.id === cleanId ||
        item.formId?.toLowerCase() === id.toLowerCase() ||
        item.formId?.toLowerCase().replace(/-/g, '_') === cleanId ||
        item.screenId?.toLowerCase() === id.toLowerCase() ||
        item.screenId?.toLowerCase().replace(/-/g, '_') === cleanId
    );
}
