
import { readData } from '../services/workspace-data.mjs';
import { getOperationalModule } from './operational-module-registry';

const getItemModuleKeys = () => readData("lib.navigation-access", "itemModuleKeys_1");
const getDomainModuleKeys = () => readData("lib.navigation-access", "domainModuleKeys_2");

export function navigationModuleKey(itemId, targetTab) {
    const operational = getOperationalModule(itemId);
    return operational?.primary || getItemModuleKeys()[itemId] || getItemModuleKeys()[targetTab] || targetTab || null;
}

export function canViewNavigationItem({ id, targetTab }, isModuleAllowed, user) {
    if (/^s(10|[1-9])$/i.test(id || '')) return true;
    const moduleKey = navigationModuleKey(id, targetTab);
    return !moduleKey || isModuleAllowed(moduleKey, user?.role, user?.id || user?.email);
}

export function canViewNavigationDomain(domainId, isModuleAllowed, user) {
    // Every signed-in role has at least its self-service console; console-level rules
    // determine which dashboard options appear inside this domain.
    if (domainId === 'dashboard') return true;
    const keys = getDomainModuleKeys()[domainId] || [];
    return keys.length === 0 || keys.some((moduleKey) => isModuleAllowed(moduleKey, user?.role, user?.id || user?.email));
}
