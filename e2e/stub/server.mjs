import { createServer } from 'node:http';

// Stubs the GitHub GraphQL API and the npm registry for the browser smoke
// test, so CI does not need a GitHub token or the real npm registry.
const PORT = 9999;
const REPOSITORY = 'sindresorhus/is-plain-obj';

const MANIFEST = {
  name: 'is-plain-obj',
  devDependencies: {
    ava: '^5.0.0',
    tsd: '^0.28.0',
    xo: '^0.54.0',
  },
};

const DIST_TAGS = {
  ava: '6.1.3',
  tsd: '0.31.2',
  xo: '0.60.0',
};

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(payload);
}

function isTargetRepository(variables) {
  const owner = typeof variables?.owner === 'string' ? variables.owner : '';
  const repo = typeof variables?.repo === 'string' ? variables.repo : '';
  return `${owner}/${repo}`.toLowerCase() === REPOSITORY;
}

async function handleGraphql(request, response) {
  let query = '';
  let variables = {};
  try {
    const body = JSON.parse(await readBody(request));
    query = typeof body.query === 'string' ? body.query : '';
    variables = body.variables ?? {};
  } catch {
    sendJson(response, 400, { errors: [{ message: 'Invalid JSON body' }] });
    return;
  }

  if (!isTargetRepository(variables)) {
    sendJson(response, 200, {
      data: { repository: null },
      errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a Repository' }],
    });
    return;
  }

  if (query.includes('object(')) {
    sendJson(response, 200, {
      data: { repository: { name: 'is-plain-obj', object: { text: JSON.stringify(MANIFEST) } } },
    });
    return;
  }

  sendJson(response, 200, { data: { repository: { name: 'is-plain-obj' } } });
}

function handleDistTags(request, response, pathname) {
  const encodedName = pathname.slice('/-/package/'.length, -'/dist-tags'.length);
  const name = decodeURIComponent(encodedName);
  const version = DIST_TAGS[name];

  if (!version) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  sendJson(response, 200, { latest: version });
}

const server = createServer((request, response) => {
  const { method, url } = request;
  const pathname = new URL(url, `http://localhost:${PORT}`).pathname;
  console.log(`${method} ${pathname}`);

  if (method === 'POST' && pathname === '/graphql') {
    handleGraphql(request, response);
    return;
  }

  if (method === 'GET' && pathname.startsWith('/-/package/') && pathname.endsWith('/dist-tags')) {
    handleDistTags(request, response, pathname);
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Stub server listening on port ${PORT}`);
});
