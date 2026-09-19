import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ScheduledReport } from '../lib/api';
import RepositoryCheck from './RepositoryCheck.svelte';

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  isValidRepository: vi.fn(),
  scheduleReport: vi.fn(),
}));

const { isValidRepository, scheduleReport } = vi.mocked(await import('../lib/api'));

const report: ScheduledReport = {
  owner: 'mmayadag',
  repo: 'app',
  outdated: { dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0', change: 'major' }] },
  generatedAt: '2026-09-16T10:00:00.000Z',
  emailSent: true,
  subscription: { status: 'pending', periodHours: 24, nextReportAt: null },
};

/** Types into the repository field and lets the 300 ms debounce elapse. */
async function typeRepository(value: string) {
  await fireEvent.input(screen.getByLabelText('Repository'), { target: { value } });
  await vi.advanceTimersByTimeAsync(300);
}

describe('RepositoryCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not ask the API about input that is not a repository', async () => {
    render(RepositoryCheck);

    await typeRepository('not a repo');

    expect(isValidRepository).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter owner\/repo or a GitHub URL\./)).toBeInTheDocument();
  });

  it('checks a repository once the input settles and reports the result', async () => {
    isValidRepository.mockResolvedValue(true);
    render(RepositoryCheck);

    await fireEvent.input(screen.getByLabelText('Repository'), { target: { value: 'mmayadag/ap' } });
    await typeRepository('https://github.com/mmayadag/app.git');

    expect(isValidRepository).toHaveBeenCalledTimes(1);
    expect(isValidRepository).toHaveBeenCalledWith({ owner: 'mmayadag', repo: 'app' }, expect.any(AbortSignal));
    expect(await screen.findByText('Public repository found.')).toBeInTheDocument();
  });

  it('marks a repository GitHub does not know as invalid', async () => {
    isValidRepository.mockResolvedValue(false);
    render(RepositoryCheck);

    await typeRepository('mmayadag/missing');

    expect(await screen.findByText('Repository not found or not public.')).toBeInTheDocument();
    expect(screen.getByLabelText('Repository')).toHaveAttribute('aria-invalid', 'true');
  });

  it('offers every report period, with the week option labelled distinctly', async () => {
    render(RepositoryCheck);

    const options = screen.getAllByRole('option') as HTMLOptionElement[];

    expect(options).toHaveLength(4);
    expect(options.map((option) => option.textContent?.trim())).toEqual(['6 hours', '12 hours', '24 hours', '1 week']);
  });

  it('enables the button only with a valid repository and an email, then shows the report', async () => {
    isValidRepository.mockResolvedValue(true);
    scheduleReport.mockResolvedValue(report);
    render(RepositoryCheck);
    const button = screen.getByRole('button', { name: 'Analyze dependencies' });

    await typeRepository('mmayadag/app');
    await screen.findByText('Public repository found.');
    expect(button).toBeDisabled();

    await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'dev@example.com' } });
    expect(button).toBeEnabled();

    await fireEvent.click(button);

    expect(scheduleReport).toHaveBeenCalledWith({
      owner: 'mmayadag',
      repo: 'app',
      email: 'dev@example.com',
      period: 24,
    });
    expect(await screen.findByRole('heading', { name: 'mmayadag/app' })).toBeInTheDocument();
    expect(screen.getByText('major')).toBeInTheDocument();
  });

  it('shows the API error message when the request fails', async () => {
    isValidRepository.mockResolvedValue(true);
    scheduleReport.mockRejectedValue(new ApiError('email must be an email', 400));
    render(RepositoryCheck);

    await typeRepository('mmayadag/app');
    await screen.findByText('Public repository found.');
    await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'dev@example.com' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Analyze dependencies' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('email must be an email');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
