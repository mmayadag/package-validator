import { describe, expect, it } from 'vitest';
import { parseRepository } from './git-url';

const expected = { owner: 'mmayadag', repo: 'package-validator' };

describe('parseRepository', () => {
  it.each([
    'mmayadag/package-validator',
    'https://github.com/mmayadag/package-validator',
    'https://github.com/mmayadag/package-validator.git',
    'https://github.com/mmayadag/package-validator/',
    'github.com/mmayadag/package-validator',
    'git@github.com:mmayadag/package-validator.git',
    '  mmayadag/package-validator  ',
  ])('parses %j', (input) => {
    expect(parseRepository(input)).toEqual(expected);
  });

  it('keeps dots in repository names', () => {
    expect(parseRepository('https://github.com/vercel/next.js')).toEqual({ owner: 'vercel', repo: 'next.js' });
  });

  it.each(['', 'mmayadag', 'https://gitlab.com/mmayadag/package-validator', '-bad/repo', 'a/b/c'])(
    'rejects %j',
    (input) => {
      expect(parseRepository(input)).toBeNull();
    },
  );
});
