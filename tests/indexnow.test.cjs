const test = require('node:test');
const assert = require('node:assert/strict');
const { getSubmission, submitIndexNow } = require('../scripts/submit-indexnow.cjs');

test('IndexNow payload uses the canonical sitemap and public ownership file', () => {
  const submission = getSubmission();
  assert.equal(submission.host, 'sumoaisolutions.com');
  assert.match(submission.key, /^[a-zA-Z0-9-]{8,128}$/);
  assert.equal(submission.keyLocation, 'https://sumoaisolutions.com/indexnow-key.txt');
  assert.deepEqual(submission.urlList, [
    'https://sumoaisolutions.com/',
    'https://sumoaisolutions.com/portfolio/'
  ]);
});

for (const status of [200, 202]) {
  test('IndexNow checks the live ownership key before sending URLs (HTTP ' + status + ')', async () => {
    const submission = getSubmission();
    const calls = [];
    const result = await submitIndexNow(async (url, options) => {
      calls.push({ url, options });
      assert.ok(options.signal instanceof AbortSignal);
      if (calls.length === 1) {
        assert.equal(url, submission.keyLocation);
        assert.equal(options.redirect, 'error');
        return new Response(submission.key + '\n', { status: 200 });
      }
      assert.equal(url, 'https://api.indexnow.org/indexnow');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['Content-Type'], 'application/json; charset=utf-8');
      assert.deepEqual(JSON.parse(options.body), submission);
      return new Response('', { status });
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(result, { status, count: submission.urlList.length });
  });
}

for (const [status, body, message] of [
  [404, 'Not found', /key is not live \(HTTP 404\)/],
  [200, 'A stale ownership key', /deployed IndexNow key does not match/]
]) {
  test('IndexNow does not submit before the correct key is deployed (HTTP ' + status + ')', async () => {
    let calls = 0;
    await assert.rejects(submitIndexNow(async () => {
      calls += 1;
      return new Response(body, { status });
    }), message);
    assert.equal(calls, 1);
  });
}

for (const status of [400, 403, 422, 429, 500]) {
  test('IndexNow reports rejected submissions (HTTP ' + status + ')', async () => {
    let calls = 0;
    await assert.rejects(submitIndexNow(async () => {
      calls += 1;
      return calls === 1
        ? new Response(getSubmission().key, { status: 200 })
        : new Response('Request rejected', { status });
    }), new RegExp('IndexNow submission failed \\(HTTP ' + status + '\\): Request rejected'));
    assert.equal(calls, 2);
  });
}

for (const failingRequest of [1, 2]) {
  test('IndexNow propagates connection failures on request ' + failingRequest, async () => {
    const error = new Error('Connection refused');
    let calls = 0;
    await assert.rejects(submitIndexNow(async () => {
      calls += 1;
      if (calls === failingRequest) throw error;
      return new Response(getSubmission().key, { status: 200 });
    }), error);
    assert.equal(calls, failingRequest);
  });
}
