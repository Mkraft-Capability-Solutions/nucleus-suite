import { readData } from '../services/workspace-data.mjs';

export const operationalModules = readData('lib.operational-module-registry', 'modules');
export const operationalNavigationGroups = readData('lib.operational-module-registry', 'groups');
export const operationalNavigationDomains = readData('lib.operational-module-registry', 'domains');

export function getOperationalModule(id) {
    return operationalModules.find((item) => item.id === id);
}
