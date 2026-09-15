import { ConsoleLogger, type ConsoleLoggerOptions, type LogLevel } from '@nestjs/common';

const LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

/**
 * One JSON object per line in production so container logs can be shipped and
 * queried; the coloured, human-readable format everywhere else.
 * LOG_LEVEL caps verbosity (`warn` keeps fatal, error and warn).
 */
export function loggerOptions(env: NodeJS.ProcessEnv): ConsoleLoggerOptions {
  const level = (env.LOG_LEVEL ?? 'log') as LogLevel;
  const index = LEVELS.indexOf(level);
  return {
    json: env.NODE_ENV === 'production',
    logLevels: LEVELS.slice(0, (index === -1 ? LEVELS.indexOf('log') : index) + 1),
  };
}

export const createLogger = (env: NodeJS.ProcessEnv): ConsoleLogger => new ConsoleLogger(loggerOptions(env));
