import type { INestApplication } from '@nestjs/common';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { RateLimitGuard } from '../src/common/rate-limit/rate-limit.guard.js';
import { DependencyCheckerService } from '../src/dependencies/dependency-checker.service.js';
import { EmailService } from '../src/email/email.service.js';
import { GithubService } from '../src/github/github.service.js';
import { ReportService } from '../src/report/report.service.js';
import { SubscriptionsRepository } from '../src/subscriptions/subscriptions.repository.js';

describe('API (e2e)', () => {
  const github = { repositoryExists: vi.fn(), getPackageJson: vi.fn() };
  const dependencyChecker = { findOutdated: vi.fn() };
  const email = { sendReport: vi.fn(), sendConfirmation: vi.fn() };
  const logged = vi.fn();
  let moduleRef: TestingModule;
  let app: INestApplication;

  beforeAll(async () => {
    vi.stubEnv('TOKEN', 'ghp_e2e');
    vi.stubEnv('DATABASE_PATH', ':memory:');
    vi.stubEnv('PUBLIC_URL', 'https://pv.example.com/');
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GithubService)
      .useValue(github)
      .overrideProvider(DependencyCheckerService)
      .useValue(dependencyChecker)
      .overrideProvider(EmailService)
      .useValue(email)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    // Only the request log is observed; everything else stays silent.
    app.useLogger({ log: logged, error: () => {}, warn: () => {} });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  // Every test starts with empty mocks, no cached report and fresh rate-limit windows,
  // so the suite passes in any order (see vitest.config.e2e.ts, which shuffles it).
  beforeEach(() => {
    vi.resetAllMocks();
    moduleRef.get(ReportService).clearCache();
    moduleRef.get(RateLimitGuard).reset();
  });

  const givenValidRepository = () => {
    github.repositoryExists.mockResolvedValue(true);
    github.getPackageJson.mockResolvedValue('{}');
    dependencyChecker.findOutdated.mockResolvedValue({});
  };

  it('GET /health', () => request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' }));

  describe('request log', () => {
    it('answers every request with an id and logs one line per request', async () => {
      const { headers } = await request(app.getHttpServer()).post('/v1/subscriptions/not-a-token/confirm').expect(400);

      expect(headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(logged).toHaveBeenCalledTimes(1);
      expect(logged).toHaveBeenCalledWith(
        expect.stringMatching(/^POST \/v1\/subscriptions\/not-a-token\/confirm 400 \d+ms$/),
        expect.objectContaining({ requestId: headers['x-request-id'], status: 400, ip: expect.any(String) }),
        'HTTP',
      );
    });

    it('keeps the id a caller sends', async () => {
      const { headers } = await request(app.getHttpServer()).get('/health').set('X-Request-Id', 'trace-42').expect(200);

      expect(headers['x-request-id']).toBe('trace-42');
      expect(logged).not.toHaveBeenCalled();
    });
  });

  describe('OpenAPI', () => {
    it('serves the document with every route', async () => {
      const { body } = await request(app.getHttpServer()).get('/docs/openapi.json').expect(200);

      expect(body.info.title).toBe('Package Validator API');
      expect(Object.keys(body.paths).sort()).toEqual([
        '/health',
        '/v1/repositories/{owner}/{repo}',
        '/v1/repositories/{owner}/{repo}/report',
        '/v1/subscriptions',
        '/v1/subscriptions/{token}',
        '/v1/subscriptions/{token}/confirm',
      ]);
      expect(body.components.schemas.ScheduledReportDto.properties.subscription).toBeDefined();
      expect(body.paths['/v1/subscriptions'].post.tags).toEqual(['subscriptions']);
      expect(body.paths['/v1/repositories/{owner}/{repo}/report'].get.tags).toEqual(['repositories']);
    });

    it('serves Swagger UI with a CSP that allows its inline bootstrap', async () => {
      const { headers } = await request(app.getHttpServer()).get('/docs').expect(200);

      expect(headers['content-type']).toContain('text/html');
      expect(headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
    });
  });

  it('sends security headers on every response', async () => {
    const { headers } = await request(app.getHttpServer()).get('/health').expect(200);

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("script-src 'self';");
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['x-powered-by']).toBeUndefined();
  });

  it('registers the hourly report delivery job', () => {
    const job = moduleRef.get(SchedulerRegistry).getCronJob('send-due-reports');

    expect(job.cronTime.source).toBe(CronExpression.EVERY_HOUR);
  });

  it('does not answer the old unversioned routes', async () => {
    await request(app.getHttpServer()).get('/repo/isValid/mmayadag/package-validator').expect(404);
    await request(app.getHttpServer()).get('/repositories/mmayadag/package-validator').expect(404);
  });

  describe('GET /v1/repositories/:owner/:repo', () => {
    it('reports whether the repository exists', async () => {
      github.repositoryExists.mockResolvedValue(true);

      await request(app.getHttpServer())
        .get('/v1/repositories/mmayadag/package-validator')
        .expect(200, { valid: true });
      expect(github.repositoryExists).toHaveBeenCalledWith({ owner: 'mmayadag', repo: 'package-validator' });
    });

    it('reports a missing repository as invalid', async () => {
      github.repositoryExists.mockResolvedValue(false);

      await request(app.getHttpServer()).get('/v1/repositories/mmayadag/missing').expect(200, { valid: false });
    });

    it('rejects names GitHub would not accept', async () => {
      await request(app.getHttpServer()).get('/v1/repositories/-bad/x').expect(400);
      expect(github.repositoryExists).not.toHaveBeenCalled();
    });
  });

  describe('GET /v1/repositories/:owner/:repo/report', () => {
    it('returns the report', async () => {
      github.repositoryExists.mockResolvedValue(true);
      github.getPackageJson.mockResolvedValue('{"dependencies":{"express":"^4.0.0"}}');
      dependencyChecker.findOutdated.mockResolvedValue({
        dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0', change: 'major' }],
      });

      const { body } = await request(app.getHttpServer()).get('/v1/repositories/mmayadag/app/report').expect(200);

      expect(body).toMatchObject({ owner: 'mmayadag', repo: 'app', outdated: { dependencies: [{ name: 'express' }] } });
      expect(body.html).toContain('<td>express</td>');
    });

    it('returns 404 for an unknown repository', async () => {
      github.repositoryExists.mockResolvedValue(false);

      await request(app.getHttpServer()).get('/v1/repositories/mmayadag/missing/report').expect(404);
    });

    it('returns 422 when there is no package.json', async () => {
      github.repositoryExists.mockResolvedValue(true);
      github.getPackageJson.mockResolvedValue(null);

      await request(app.getHttpServer()).get('/v1/repositories/mmayadag/go-app/report').expect(422);
    });
  });

  describe('POST /v1/subscriptions', () => {
    const body = { owner: 'mmayadag', repo: 'app', email: 'dev@example.com', period: 24 };

    it('returns the report and asks a new address to confirm', async () => {
      givenValidRepository();
      email.sendConfirmation.mockResolvedValue(true);

      const response = await request(app.getHttpServer()).post('/v1/subscriptions').send(body).expect(201);

      expect(response.body).toMatchObject({
        owner: 'mmayadag',
        repo: 'app',
        emailSent: true,
        subscription: { status: 'pending', periodHours: 24, nextReportAt: null },
      });
      expect(response.body.subscription).not.toHaveProperty('token');
      expect(email.sendReport).not.toHaveBeenCalled();
      expect(email.sendConfirmation).toHaveBeenCalledWith(
        'dev@example.com',
        { owner: 'mmayadag', repo: 'app' },
        24,
        expect.stringMatching(/^https:\/\/pv\.example\.com\/\?confirm=[A-Za-z0-9_-]{32}$/),
      );
    });

    it('keeps one subscription per email and repository', async () => {
      givenValidRepository();
      email.sendConfirmation.mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .send({ ...body, repo: 'dedupe', period: 6 })
        .expect(201);
      await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .send({ ...body, repo: 'Dedupe', period: 12 })
        .expect(201);

      const stored = moduleRef
        .get(SubscriptionsRepository)
        .find({ owner: 'mmayadag', repo: 'dedupe', email: body.email });
      expect(stored?.periodHours).toBe(12);
    });

    it.each([
      ['an invalid email', { email: 'nope' }],
      ['an unsupported period', { period: 7 }],
      ['an owner GitHub would not accept', { owner: '-bad' }],
      ['unknown body fields', { admin: true }],
    ])('rejects %s', async (_, override) => {
      await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .send({ ...body, ...override })
        .expect(400);
    });
  });

  const confirmLinkToken = () => new URL(email.sendConfirmation.mock.calls[0][3] as string).searchParams.get('confirm');

  describe('POST /v1/subscriptions/:token/confirm', () => {
    it('activates the subscription, sends the first report and is idempotent', async () => {
      givenValidRepository();
      email.sendConfirmation.mockResolvedValue(true);
      email.sendReport.mockResolvedValue(true);
      const key = { owner: 'mmayadag', repo: 'confirm-me', email: 'dev@example.com' };
      await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .send({ ...key, period: 12 })
        .expect(201);
      const token = confirmLinkToken();

      const { body } = await request(app.getHttpServer()).post(`/v1/subscriptions/${token}/confirm`).expect(200);

      expect(body).toEqual({
        ...key,
        subscription: { status: 'active', periodHours: 12, nextReportAt: expect.any(String) },
      });
      expect(email.sendReport).toHaveBeenCalledWith(
        'dev@example.com',
        { owner: 'mmayadag', repo: 'confirm-me' },
        expect.anything(),
        `https://pv.example.com/?unsubscribe=${token}`,
      );
      expect(moduleRef.get(SubscriptionsRepository).findDue(Date.now())).toEqual([]);

      await request(app.getHttpServer()).post(`/v1/subscriptions/${token}/confirm`).expect(200);
      expect(email.sendReport).toHaveBeenCalledTimes(1);
    });

    it('sends the report straight away when a confirmed address subscribes again', async () => {
      givenValidRepository();
      email.sendConfirmation.mockResolvedValue(true);
      email.sendReport.mockResolvedValue(true);
      const key = { owner: 'mmayadag', repo: 'again', email: 'dev@example.com' };
      await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .send({ ...key, period: 6 })
        .expect(201);
      await request(app.getHttpServer()).post(`/v1/subscriptions/${confirmLinkToken()}/confirm`).expect(200);
      vi.clearAllMocks();
      givenValidRepository();
      email.sendReport.mockResolvedValue(true);

      const { body } = await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .send({ ...key, period: 24 })
        .expect(201);

      expect(body.subscription).toMatchObject({ status: 'active', periodHours: 24 });
      expect(email.sendConfirmation).not.toHaveBeenCalled();
      expect(email.sendReport).toHaveBeenCalledTimes(1);
    });

    it('returns 404 for an unknown token', () =>
      request(app.getHttpServer())
        .post(`/v1/subscriptions/${'a'.repeat(32)}/confirm`)
        .expect(404));
  });

  describe('DELETE /v1/subscriptions/:token', () => {
    it('unsubscribes with the token from the email link', async () => {
      givenValidRepository();
      email.sendConfirmation.mockResolvedValue(true);
      const subscription = { owner: 'mmayadag', repo: 'unsubscribe-me', email: 'dev@example.com' };

      await request(app.getHttpServer())
        .post('/v1/subscriptions')
        .send({ ...subscription, period: 6 })
        .expect(201);
      const token = confirmLinkToken();

      await request(app.getHttpServer()).delete(`/v1/subscriptions/${token}`).expect(204);
      expect(moduleRef.get(SubscriptionsRepository).find(subscription)).toBeNull();
      await request(app.getHttpServer()).delete(`/v1/subscriptions/${token}`).expect(404);
    });

    it('returns 404 for an unknown token', () =>
      request(app.getHttpServer())
        .delete(`/v1/subscriptions/${'a'.repeat(32)}`)
        .expect(404));

    it('rejects a malformed token', () =>
      request(app.getHttpServer()).delete('/v1/subscriptions/not-a-token').expect(400));
  });

  describe('rate limiting', () => {
    it('answers 429 with Retry-After once a client exceeds the strict limit', async () => {
      github.repositoryExists.mockResolvedValue(false);
      const statuses: number[] = [];
      let limited: request.Response | undefined;

      for (let i = 0; i < 12 && !limited; i += 1) {
        const response = await request(app.getHttpServer()).get('/v1/repositories/mmayadag/flood/report');
        statuses.push(response.status);
        if (response.status === 429) limited = response;
      }

      expect(limited?.headers['retry-after']).toMatch(/^\d+$/);
      expect(limited?.body.message).toBe('Too many requests, please try again later');
      expect(statuses.filter((status) => status === 404).length).toBeLessThanOrEqual(10);
    });

    it('separates clients forwarded by the proxy', async () => {
      github.repositoryExists.mockResolvedValue(false);

      await request(app.getHttpServer())
        .get('/v1/repositories/mmayadag/flood/report')
        .set('X-Forwarded-For', '198.51.100.7')
        .expect(404);
    });

    it('never limits the health check', async () => {
      for (let i = 0; i < 70; i += 1) {
        await request(app.getHttpServer()).get('/health').expect(200);
      }
    });
  });
});

describe('API without documentation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    vi.stubEnv('TOKEN', 'ghp_e2e');
    vi.stubEnv('DATABASE_PATH', ':memory:');
    vi.stubEnv('DOCS_ENABLED', 'false');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('answers 404 for Swagger UI and the OpenAPI document, with the strict CSP', async () => {
    await request(app.getHttpServer()).get('/docs/openapi.json').expect(404);
    const { headers } = await request(app.getHttpServer()).get('/docs').expect(404);

    expect(headers['content-security-policy']).toContain("script-src 'self';");
  });

  it('still serves the API', () => request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' }));
});
