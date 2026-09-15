import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { DependencyCheckerService } from '../src/dependencies/dependency-checker.service.js';
import { EmailService } from '../src/email/email.service.js';
import { GithubService } from '../src/github/github.service.js';

describe('API (e2e)', () => {
  const github = { repositoryExists: vi.fn(), getPackageJson: vi.fn() };
  const dependencyChecker = { findOutdated: vi.fn() };
  const email = { sendReport: vi.fn() };
  let app: INestApplication;

  beforeAll(async () => {
    vi.stubEnv('TOKEN', 'ghp_e2e');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GithubService)
      .useValue(github)
      .overrideProvider(DependencyCheckerService)
      .useValue(dependencyChecker)
      .overrideProvider(EmailService)
      .useValue(email)
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  beforeEach(() => vi.resetAllMocks());

  it('GET /health', () => request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' }));

  describe('isValid', () => {
    it('GET /repo/isValid/:owner/:repo', async () => {
      github.repositoryExists.mockResolvedValue(true);

      await request(app.getHttpServer()).get('/repo/isValid/mmayadag/package-validator').expect(200, { valid: true });
      expect(github.repositoryExists).toHaveBeenCalledWith({ owner: 'mmayadag', repo: 'package-validator' });
    });

    it('POST /repo/isValid', async () => {
      github.repositoryExists.mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/repo/isValid')
        .send({ owner: 'mmayadag', repo: 'missing' })
        .expect(200, { valid: false });
    });

    it('rejects names GitHub would not accept', async () => {
      await request(app.getHttpServer()).post('/repo/isValid').send({ owner: '-bad', repo: 'x' }).expect(400);
      expect(github.repositoryExists).not.toHaveBeenCalled();
    });

    it('rejects unknown body fields', () =>
      request(app.getHttpServer()).post('/repo/isValid').send({ owner: 'a', repo: 'b', admin: true }).expect(400));
  });

  describe('GET /repo/details/:owner/:repo', () => {
    it('returns the report', async () => {
      github.repositoryExists.mockResolvedValue(true);
      github.getPackageJson.mockResolvedValue('{"dependencies":{"express":"^4.0.0"}}');
      dependencyChecker.findOutdated.mockResolvedValue({
        dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0' }],
      });

      const { body } = await request(app.getHttpServer()).get('/repo/details/mmayadag/app').expect(200);

      expect(body).toMatchObject({ owner: 'mmayadag', repo: 'app', outdated: { dependencies: [{ name: 'express' }] } });
      expect(body.html).toContain('<td>express</td>');
    });

    it('returns 404 for an unknown repository', async () => {
      github.repositoryExists.mockResolvedValue(false);

      await request(app.getHttpServer()).get('/repo/details/mmayadag/missing').expect(404);
    });

    it('returns 422 when there is no package.json', async () => {
      github.repositoryExists.mockResolvedValue(true);
      github.getPackageJson.mockResolvedValue(null);

      await request(app.getHttpServer()).get('/repo/details/mmayadag/go-app').expect(422);
    });
  });

  describe('POST /repo/schedule', () => {
    const body = { owner: 'mmayadag', repo: 'app', email: 'dev@example.com', period: 24 };

    it('returns the report and whether it was emailed', async () => {
      github.repositoryExists.mockResolvedValue(true);
      github.getPackageJson.mockResolvedValue('{}');
      dependencyChecker.findOutdated.mockResolvedValue({});
      email.sendReport.mockResolvedValue(false);

      const response = await request(app.getHttpServer()).post('/repo/schedule').send(body).expect(200);

      expect(response.body).toMatchObject({ owner: 'mmayadag', repo: 'app', emailSent: false });
      expect(email.sendReport).toHaveBeenCalledWith('dev@example.com', { owner: 'mmayadag', repo: 'app' }, expect.anything());
    });

    it.each([
      ['an invalid email', { email: 'nope' }],
      ['an unsupported period', { period: 7 }],
    ])('rejects %s', async (_, override) => {
      await request(app.getHttpServer())
        .post('/repo/schedule')
        .send({ ...body, ...override })
        .expect(400);
    });
  });
});
