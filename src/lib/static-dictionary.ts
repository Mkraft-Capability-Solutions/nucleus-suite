export function readData(dictionaryType: string, key?: string): any {
  return { sheets: {} };
}

export const saveDashboardPreferences = async (...args: any[]): Promise<any> => {};
export const validateFormFNominees = () => true;
export const validateGLBatchBalance = () => true;
export const FORM_F_TEMPLATES = {};
export const generateSapIdocXml = () => {};
export const generateNetSuiteCsv = () => {};
export const generateTallyXml = () => {};
export const generateTallyPrimeXml = () => {};
export const generateFormFDeclaration = () => {};
import { sanitizePreferences } from '@/lib/dashboard-layout';

export const loadDashboardPreferences = async (identity: any, definitions: any, fallback: any): Promise<any> => ({
  preferences: fallback ? sanitizePreferences(null, definitions, fallback) : { layouts: [], activeId: '' },
  warning: ''
});
export const loadWorkspaceData = async () => {};
export const SAMPLE_FORM_F_TEMPLATES = [
  {
    templateName: 'Standard Family Gratuity Nomination (Form F)',
    description: '100% distribution to primary legal spouse as designated nominee',
    nominees: [
      {
        nomineeName: 'Primary Nominee',
        relationship: 'Spouse',
        age: 32,
        proportion: 100,
        address: 'Residential Address as per Record'
      }
    ]
  }
];
