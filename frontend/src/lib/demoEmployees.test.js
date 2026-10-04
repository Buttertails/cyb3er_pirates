import { describe, expect, it } from 'vitest';
import { employeeIdForCompany } from './demoEmployees.js';

describe('company policy context', () => {
  it('uses the company already chosen during sign-up', () => {
    expect(employeeIdForCompany('acme-co')).toBe('demo-a-pat');
    expect(employeeIdForCompany('demo-company-2')).toBe('demo-c-lee');
    expect(employeeIdForCompany('demo-company-3')).toBe('demo-a-sam');
  });

  it('keeps older company identifiers working', () => {
    expect(employeeIdForCompany('demo-company-a')).toBe('demo-a-pat');
    expect(employeeIdForCompany('demo-company-c')).toBe('demo-c-lee');
    expect(employeeIdForCompany('other')).toBe('demo-a-pat');
  });
});
