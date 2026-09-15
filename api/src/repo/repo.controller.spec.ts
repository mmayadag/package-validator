import { RepoService } from './repo.service';
import { RepoController } from './repo.controller';
import { GithubService } from '../services/index';

describe('Repo Controller', () => {
  let repoController: RepoController;
  let res: { json: jest.Mock };

  beforeEach(() => {
    repoController = new RepoController(new RepoService());
    res = { json: jest.fn(body => body) };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /repo/isValid/:owner/:repo', () => {
    it('returns valid=true when GitHub knows the repository', async () => {
      jest
        .spyOn(GithubService.prototype, 'isValidGithubRepo')
        .mockResolvedValue(true);

      await repoController.isValide('mmayadag', 'fx-rates', res);

      expect(res.json).toHaveBeenCalledWith({ valid: true });
    });

    it('returns valid=false when the GitHub lookup fails', async () => {
      jest
        .spyOn(GithubService.prototype, 'isValidGithubRepo')
        .mockRejectedValue(new Error('network'));

      await repoController.isValide('mmayadag', 'missing', res);

      expect(res.json).toHaveBeenCalledWith({ valid: false });
    });
  });
});
