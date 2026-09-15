// class-validator decorators need the Reflect metadata API even outside a Nest context.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export interface AppConfig {
  port: number;
  corsOrigin?: string;
  /** Address of the UI, used for links in emails. No trailing slash. */
  publicUrl: string;
  databasePath: string;
  github: {
    endpoint: string;
    token: string;
  };
  email: {
    apiKey?: string;
    from?: string;
    subject: string;
  };
}

class EnvironmentVariables {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  PUBLIC_URL?: string;

  @IsOptional()
  @IsString()
  DATABASE_PATH?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  GITHUB_ENDPOINT?: string;

  @IsString()
  @IsNotEmpty()
  TOKEN!: string;

  @IsOptional()
  @IsString()
  SENDGRID_API_KEY?: string;

  @IsOptional()
  @IsEmail()
  EMAIL_FROM?: string;

  @IsOptional()
  @IsString()
  EMAIL_SUBJECT?: string;
}

/** `KEY=` in an env file means "not set", not "set to an empty string". */
const withoutEmptyValues = (env: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));

export function loadConfig(env: Record<string, unknown>): AppConfig {
  const vars = plainToInstance(EnvironmentVariables, withoutEmptyValues(env), {
    enableImplicitConversion: true,
  });
  const errors = validateSync(vars);
  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return {
    port: vars.PORT ?? 3288,
    corsOrigin: vars.CORS_ORIGIN,
    publicUrl: (vars.PUBLIC_URL ?? 'http://localhost:8080').replace(/\/+$/, ''),
    databasePath: vars.DATABASE_PATH ?? 'data/package-validator.db',
    github: {
      endpoint: vars.GITHUB_ENDPOINT ?? 'https://api.github.com/graphql',
      token: vars.TOKEN,
    },
    email: {
      apiKey: vars.SENDGRID_API_KEY,
      from: vars.EMAIL_FROM,
      subject: vars.EMAIL_SUBJECT ?? 'Dependency report',
    },
  };
}
