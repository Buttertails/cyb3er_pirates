import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DentistResults } from './components.jsx';
import { Header } from './components.jsx';
import { MemoryRouter } from 'react-router-dom';

describe('sample dentist result cards', () => {
  it('shows the office details and a map pin with clear sample labels', () => {
    const html = renderToStaticMarkup(<DentistResults result={{
      status: 'ok', message: 'Sample in-network offices near your saved ZIP.',
      offices: [{ id: 'cary-c0', name: 'Sample Cary Family Dental',
        address: '100 Demo Way, Cary, NC 27519', rating: 4.7,
        phone: '919-555-0101', distance_miles: 1.2,
        maps_url: 'https://www.google.com/maps/search/?api=1&query=35.8102%2C-78.8832' }],
    }} />);
    expect(html).toContain('Sample Cary Family Dental');
    expect(html).toContain('100 Demo Way, Cary, NC 27519');
    expect(html).toContain('Sample rating');
    expect(html).toContain('4.7');
    expect(html).toContain('919-555-0101');
    expect(html).toContain('1.2');
    expect(html).toContain('Open in Maps');
    expect(html).toContain('35.8102%2C-78.8832');
    expect(html).toContain('fictional');
    expect(html).toContain('unverified');
  });

  it('shows the relevant message without old offices for an empty or failed lookup', () => {
    for (const status of ['missing_zip', 'unsupported_zip', 'unknown_plan', 'no_offices', 'error']) {
      const html = renderToStaticMarkup(<DentistResults result={{
        status, message: `Directory ${status}`, offices: [{ id: 'stale', name: 'Stale Office' }],
      }} />);
      expect(html).toContain(`Directory ${status}`);
      expect(html).not.toContain('Stale Office');
    }
  });
});

describe('site navigation', () => {
  it('keeps account navigation without a duplicate Assistant link', () => {
    const storage = { user: JSON.stringify('pat@example.com') };
    globalThis.sessionStorage = { getItem: (key) => storage[key] ?? null };
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/profile.html']}><Header /></MemoryRouter>);
    expect(html).toContain('href="/chat"');
    expect(html).not.toContain('>Assistant<');
    expect(html).toContain('aria-current="page"');
  });
});
