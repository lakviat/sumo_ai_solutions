const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').trim();

function getSubmission() {
  const host = read('CNAME');
  const site = new URL('https://' + host);
  const key = read('indexnow-key.txt');
  const urlList = [...read('sitemap.xml').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(match => match[1]);
  if (site.hostname !== host || site.port || site.pathname !== '/' || site.search || site.hash) {
    throw new Error('CNAME must contain only the canonical hostname.');
  }
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error('Invalid IndexNow ownership key.');
  if (!urlList.length || new Set(urlList).size !== urlList.length) {
    throw new Error('The sitemap must contain a nonempty list of unique URLs.');
  }
  for (const url of urlList) {
    const page = new URL(url);
    if (page.origin !== site.origin || page.search || page.hash) {
      throw new Error('Sitemap URL is not canonical: ' + url);
    }
  }
  return { host, key, keyLocation: site.origin + '/indexnow-key.txt', urlList };
}

async function submitIndexNow(fetchRequest = fetch) {
  const submission = getSubmission();
  const proof = await fetchRequest(submission.keyLocation, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  });
  if (!proof.ok) {
    throw new Error('IndexNow key is not live (HTTP ' + proof.status + '). Deploy the site before submitting.');
  }
  if ((await proof.text()).trim() !== submission.key) {
    throw new Error('The deployed IndexNow key does not match indexnow-key.txt.');
  }
  const response = await fetchRequest('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(submission),
    signal: AbortSignal.timeout(15000)
  });
  if (response.status !== 200 && response.status !== 202) {
    throw new Error('IndexNow submission failed (HTTP ' + response.status + '): ' + (await response.text()).slice(0, 500));
  }
  return { status: response.status, count: submission.urlList.length };
}

if (require.main === module) {
  submitIndexNow().then(({ status, count }) => {
    console.log('IndexNow received ' + count + ' URLs' + (status === 202 ? '; ownership verification is pending.' : '.'));
    console.log('Receipt is not a guarantee of crawling, indexing, ranking, or AI citations.');
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { getSubmission, submitIndexNow };
