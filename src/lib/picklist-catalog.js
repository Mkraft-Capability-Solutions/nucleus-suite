import { readData } from '../services/workspace-data.mjs';

const catalog = readData('picklists.catalog') || { picklists: [] };
const picklistsList = catalog.picklists || [];
const picklistMap = new Map(picklistsList.map((pl) => [pl.code, pl]));

export function getPicklist(code) {
  return picklistMap.get(code) || null;
}

export function getPicklistValues(code) {
  const pl = picklistMap.get(code);
  return pl ? pl.values : [];
}

export function getPicklistOptions(code) {
  const values = getPicklistValues(code);
  return values.map((val) => ({ value: val, label: val }));
}

export function getAllPicklists() {
  return picklistsList;
}

export function searchPicklists(query) {
  if (!query) return picklistsList;
  const q = query.toLowerCase();
  return picklistsList.filter(
    (pl) =>
      pl.code.toLowerCase().includes(q) ||
      pl.name.toLowerCase().includes(q) ||
      pl.seededBy.toLowerCase().includes(q) ||
      pl.values.some((v) => v.toLowerCase().includes(q))
  );
}
