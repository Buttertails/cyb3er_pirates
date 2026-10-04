// Current signup company IDs map to the existing sample policy contexts.
// Retain the older fixture company IDs for profiles saved before this UI change.
const COMPANY_EMPLOYEES = {
  'acme-co': 'demo-a-pat',
  'demo-company-2': 'demo-c-lee',
  'demo-company-3': 'demo-a-sam',
  'demo-company-a': 'demo-a-pat',
  'demo-company-c': 'demo-c-lee',
};

export function employeeIdForCompany(companyId) {
  return COMPANY_EMPLOYEES[companyId] || 'demo-a-pat';
}
