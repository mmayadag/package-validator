import { loggerOptions } from './logging.js';

describe('loggerOptions', () => {
  it('logs JSON in production and pretty text elsewhere', () => {
    expect(loggerOptions({ NODE_ENV: 'production' }).json).toBe(true);
    expect(loggerOptions({ NODE_ENV: 'development' }).json).toBe(false);
    expect(loggerOptions({}).json).toBe(false);
  });

  it('caps the verbosity at LOG_LEVEL', () => {
    expect(loggerOptions({ LOG_LEVEL: 'warn' }).logLevels).toEqual(['fatal', 'error', 'warn']);
    expect(loggerOptions({ LOG_LEVEL: 'verbose' }).logLevels).toEqual([
      'fatal',
      'error',
      'warn',
      'log',
      'debug',
      'verbose',
    ]);
  });

  it('falls back to log for a missing or unknown level', () => {
    expect(loggerOptions({}).logLevels).toEqual(['fatal', 'error', 'warn', 'log']);
    expect(loggerOptions({ LOG_LEVEL: 'loud' }).logLevels).toEqual(['fatal', 'error', 'warn', 'log']);
  });
});
