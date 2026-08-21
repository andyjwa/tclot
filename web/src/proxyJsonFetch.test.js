import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchProxyJson } from './proxyJsonFetch.js';

function res({ ok = true, status = 200, contentType = 'application/json', body = '{}' }) {
  return {
    ok,
    status,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

test('fetchProxyJson — returns parsed JSON on success', async () => {
  const fetchImpl = async () => res({ body: '{"content":[{"id":777}]}' });
  const out = await fetchProxyJson('http://x/pulselive/competitions', 'Pulselive', {
    fetchImpl,
  });
  assert.deepEqual(out, { content: [{ id: 777 }] });
});

test('fetchProxyJson — HTML 404 is reported as a proxy routing/stale-deploy problem', async () => {
  /** Reproduces the observed failure: the Worker lacked the `pulselive/` route, so the
   *  request fell through to fantasy.premierleague.com and Django returned an HTML 404. */
  const fetchImpl = async () =>
    res({
      ok: false,
      status: 404,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><body>Not Found</body></html>',
    });
  await assert.rejects(
    () =>
      fetchProxyJson('http://x/pulselive/competitions/1/compseasons', 'Pulselive c/1', {
        fetchImpl,
      }),
    (e) => {
      assert.match(e.message, /HTTP 404/);
      assert.match(e.message, /proxy returned HTML/i);
      assert.match(e.message, /__health/);
      assert.match(e.message, /redeploy/i);
      return true;
    },
  );
});

test('fetchProxyJson — HTML detected by body sniff even without an HTML content-type', async () => {
  const fetchImpl = async () =>
    res({ ok: false, status: 404, contentType: '', body: '<html>nope</html>' });
  await assert.rejects(
    () => fetchProxyJson('http://x/espn/summary', 'ESPN summary', { fetchImpl }),
    /proxy returned HTML/i,
  );
});

test('fetchProxyJson — non-HTML error keeps the plain status message', async () => {
  const fetchImpl = async () =>
    res({ ok: false, status: 403, contentType: 'application/json', body: '{"e":1}' });
  await assert.rejects(
    () => fetchProxyJson('http://x/pulselive/fixtures/1', 'Pulselive fixtures/1', { fetchImpl }),
    (e) => {
      assert.equal(e.message, 'Pulselive fixtures/1 HTTP 403');
      return true;
    },
  );
});

test('fetchProxyJson — 200 with non-JSON content type is rejected', async () => {
  const fetchImpl = async () =>
    res({ ok: true, status: 200, contentType: 'text/html', body: '<html></html>' });
  await assert.rejects(
    () => fetchProxyJson('http://x/pulselive/fixtures', 'Pulselive fixtures', { fetchImpl }),
    /instead of JSON/i,
  );
});
