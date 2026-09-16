import { AppLogger, loggerOptions } from './logging.js';
import { requestContext } from './common/request-log/request-context.js';

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

describe('AppLogger', () => {
  const lines: string[] = [];
  const logger = new AppLogger({ json: true, colors: false, flattenParams: true });

  beforeEach(() => {
    lines.length = 0;
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('stamps lines written during a request with its id and flattens params', () => {
    requestContext.run({ requestId: 'req-1' }, () => logger.log('hello', { status: 200 }, 'HTTP'));

    expect(JSON.parse(lines[0])).toMatchObject({ message: 'hello', context: 'HTTP', status: 200, requestId: 'req-1' });
  });

  it('leaves lines outside a request without an id', () => {
    logger.log('booting', 'Bootstrap');

    expect(JSON.parse(lines[0])).not.toHaveProperty('requestId');
  });
});
