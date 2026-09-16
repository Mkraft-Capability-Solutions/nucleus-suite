import { readData } from '../services/workspace-data.mjs';

export const getOperationalModules = () => readData('lib.operational-module-registry', 'modules');
export const getOperationalNavigationGroups = () => readData('lib.operational-module-registry', 'groups');
export const getOperationalNavigationDomains = () => readData('lib.operational-module-registry', 'domains');

export function getOperationalModule(id) {
    if (!id) return undefined;
    const cleanId = String(id).toLowerCase().replace(/-/g, '_');
    return getOperationalModules().find((item) =>
        item.id === id ||
        item.id === cleanId ||
        item.formId?.toLowerCase() === id.toLowerCase() ||
        item.formId?.toLowerCase().replace(/-/g, '_') === cleanId ||
        item.screenId?.toLowerCase() === id.toLowerCase() ||
        item.screenId?.toLowerCase().replace(/-/g, '_') === cleanId
    );
}
