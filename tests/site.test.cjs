const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pages = ['index.html', 'portfolio/index.html'];
const endpoint = 'https://script.google.com/macros/s/AKfycbzSDoKrP5WWN14kzDUCTtE5N9jBej-nVHb2ZEJLPkccyhfFOqykzQCnPzPtrISZbTLETw/exec';

for (const file of pages) {
  const html = read(file);
  test(file + ': preserves advertising and consultation integration', () => {
    assert.equal((html.match(/googletagmanager.com\/gtag\/js\?id=AW-17948229197/g) || []).length, 1);
    assert.match(html, /gtag\('config', 'AW-17948229197'\)/);
    assert.ok(html.includes('data-endpoint="' + endpoint + '"'));
    for (const name of ['first_name', 'last_name', 'email', 'phone', 'project_description', 'attachments']) {
      assert.equal((html.match(new RegExp('name="' + name + '"', 'g')) || []).length, 1);
    }
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.match(html, /name="keywords"/);
    assert.doesNotMatch(html, /gtag\('event'/);
  });

  test(file + ': valid structured data, unique IDs, and working local references', () => {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.equal(JSON.parse(match[1])['@context'], 'https://schema.org');
    }
    for (const match of html.matchAll(/\b(?:src|href|data-preview-image)="([^"]+)"/g)) {
      const url = match[1];
      if (/^(https?:|mailto:|tel:|data:)/.test(url)) continue;
      const [resource, hash] = url.split('#');
      if (!resource) { if (hash) assert.ok(ids.includes(hash), 'Missing anchor ' + hash); continue; }
      const local = path.resolve(root, path.dirname(file), resource.split('?')[0]);
      assert.ok(fs.existsSync(local), 'Missing local file: ' + local);
      if (hash && local.endsWith('.svg')) assert.ok(fs.readFileSync(local, 'utf8').includes('id="' + hash + '"'));
      if (hash && fs.statSync(local).isDirectory()) assert.ok(fs.readFileSync(path.join(local, 'index.html'), 'utf8').includes('id="' + hash + '"'));
    }
  });
}

test('simple service-first homepage with six clickable services', () => {
  const html = read('index.html');
  const body = html.split('<body>')[1];
  assert.equal((body.match(/class="service-card"/g) || []).length, 6);
  for (const match of body.matchAll(/<button class="service-card"[^>]+>/g)) assert.ok(match[0].includes('data-open-consultation'));
  assert.doesNotMatch(body, /enterprise|system panel|Why SUMO|technical depth/i);
  assert.ok(body.indexOf('id="services"') < body.indexOf('id="portfolio-preview"'));
  assert.doesNotMatch(body, /<iframe/);
});

test('portfolio is lightweight and distinguishes outside inspiration', () => {
  const html = read('portfolio/index.html');
  assert.equal((html.match(/class="project-card"/g) || []).length, 5);
  assert.doesNotMatch(html, /chicagoappliance|chicago-appliance/);
  assert.doesNotMatch(html, /<iframe[^>]+src=/);
  assert.equal((html.match(/data-preview-mode="image"/g) || []).length, 6);
  assert.ok(html.includes('Not SUMO projects.'));
});

test('shared assets use one cache version on both pages', () => {
  const versions = pages.flatMap(file => [...read(file).matchAll(/(?:style\.css|script\.js)\?v=([^"\s]+)/g)].map(m => m[1]));
  assert.equal(new Set(versions).size, 1);
  assert.ok(versions.length >= 4);
  assert.ok(read('style.css').includes('prefers-reduced-motion'));
});

test('sitemap includes only deployed pages and site verification remains intact', () => {
  const urls = [...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(urls, ['https://sumoaisolutions.com/', 'https://sumoaisolutions.com/portfolio/']);
  assert.equal(read('googlebb0f81e2e8e23f9a.html').trim(), 'google-site-verification: googlebb0f81e2e8e23f9a.html');
  assert.ok(read('script.js').includes('AW-17948229197/VZTvCKPwzogcEM38sO5C'));
});
