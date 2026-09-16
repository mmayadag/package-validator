import { ConsoleLogger, type ConsoleLoggerOptions, type LogLevel } from '@nestjs/common';
import { currentRequestId } from './common/request-log/request-context.js';

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
    // Structured params ({ requestId, status, ... }) become top-level fields of the JSON line.
    flattenParams: true,
    logLevels: LEVELS.slice(0, (index === -1 ? LEVELS.indexOf('log') : index) + 1),
  };
}

/** ConsoleLogger that stamps every JSON line written during a request with that request's id. */
export class AppLogger extends ConsoleLogger {
  protected override getJsonLogObject(
    message: unknown,
    options: Parameters<ConsoleLogger['getJsonLogObject']>[1],
  ): ReturnType<ConsoleLogger['getJsonLogObject']> {
    const requestId = currentRequestId();
    const logObject = super.getJsonLogObject(message, options);
    return requestId === undefined || 'requestId' in logObject ? logObject : { ...logObject, requestId };
  }
}

export const createLogger = (env: NodeJS.ProcessEnv): AppLogger => new AppLogger(loggerOptions(env));
