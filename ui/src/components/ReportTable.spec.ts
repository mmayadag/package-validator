import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { ScheduledReport } from '../lib/api';
import ReportTable from './ReportTable.svelte';

const report = (overrides: Partial<ScheduledReport> = {}): ScheduledReport => ({
  owner: 'mmayadag',
  repo: 'app',
  outdated: {
    dependencies: [
      { name: 'express', current: '^4.0.0', latest: '^5.1.0', change: 'major' },
      { name: 'semver', current: '^7.5.0', latest: '^7.8.0', change: 'minor' },
    ],
    devDependencies: [{ name: 'vitest', current: '5.0.0', latest: '5.0.1', change: 'patch' }],
  },
  generatedAt: '2026-09-16T10:00:00.000Z',
  emailSent: true,
  subscription: { status: 'pending', periodHours: 24, nextReportAt: null },
  ...overrides,
});

describe('ReportTable', () => {
  it('summarises the outdated packages and the major jumps', () => {
    render(ReportTable, { report: report() });

    expect(screen.getByRole('heading', { name: 'mmayadag/app' })).toBeInTheDocument();
    expect(screen.getByText(/3 outdated dependencies, 1 with a major version jump\./)).toBeInTheDocument();
  });

  it('lists one table per section with a badge for the kind of change', () => {
    render(ReportTable, { report: report() });

    const tables = screen.getAllByRole('table');
    expect(tables.map((table) => within(table).getByRole('caption').textContent)).toEqual([
      'dependencies',
      'devDependencies',
    ]);

    const express = within(tables[0]).getByRole('row', { name: /express/ });
    expect(within(express).getByRole('link', { name: 'express' })).toHaveAttribute(
      'href',
      'https://www.npmjs.com/package/express',
    );
    expect(within(express).getByText('major')).toHaveAttribute('data-kind', 'major');
    expect(within(tables[1]).getByText('patch')).toHaveAttribute('data-kind', 'patch');
  });

  it('tells a pending subscriber to confirm by email', () => {
    render(ReportTable, { report: report() });

    expect(screen.getByText(/confirm the subscription to receive this report every 24 hours/)).toBeInTheDocument();
  });

  it('explains when email delivery is not configured', () => {
    render(ReportTable, { report: report({ emailSent: false }) });

    expect(screen.getByText(/Email delivery is not configured on this server/)).toBeInTheDocument();
  });

  it('says so when nothing is outdated', () => {
    render(ReportTable, {
      report: report({ outdated: {}, subscription: { status: 'active', periodHours: 6, nextReportAt: null } }),
    });

    expect(screen.getByText(/All dependencies are up to date\./)).toBeInTheDocument();
    expect(screen.getByText(/will follow every 6 hours/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
