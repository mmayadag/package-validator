import { loadConfig } from './configuration.js';

describe('loadConfig', () => {
  it('applies defaults when only the GitHub token is set', () => {
    expect(loadConfig({ TOKEN: 'ghp_test' })).toEqual({
      port: 3288,
      corsOrigin: undefined,
      publicUrl: 'http://localhost:8080',
      databasePath: 'data/package-validator.db',
      npmRegistry: 'https://registry.npmjs.org',
      docsEnabled: true,
      github: { endpoint: 'https://api.github.com/graphql', token: 'ghp_test' },
      email: { apiKey: undefined, from: undefined, subject: 'Dependency report' },
    });
  });

  it('treats empty values as unset', () => {
    const config = loadConfig({ TOKEN: 'ghp_test', EMAIL_FROM: '', SENDGRID_API_KEY: '' });

    expect(config.email).toEqual({ apiKey: undefined, from: undefined, subject: 'Dependency report' });
  });

  it('converts PORT to a number', () => {
    expect(loadConfig({ TOKEN: 'ghp_test', PORT: '4000' }).port).toBe(4000);
  });

  it('turns the documentation off only with the literal false', () => {
    expect(loadConfig({ TOKEN: 'ghp_test', DOCS_ENABLED: 'false' }).docsEnabled).toBe(false);
    expect(loadConfig({ TOKEN: 'ghp_test', DOCS_ENABLED: 'true' }).docsEnabled).toBe(true);
    expect(() => loadConfig({ TOKEN: 'ghp_test', DOCS_ENABLED: 'no' })).toThrow('DOCS_ENABLED');
  });

  it('rejects a missing token', () => {
    expect(() => loadConfig({})).toThrow(/Invalid environment configuration/);
  });

  it('rejects an invalid sender address', () => {
    expect(() => loadConfig({ TOKEN: 'ghp_test', EMAIL_FROM: 'not-an-email' })).toThrow(/EMAIL_FROM/);
  });
});
