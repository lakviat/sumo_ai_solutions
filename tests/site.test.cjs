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

test('service-first homepage with six clickable services and an interactive picker', () => {
  const html = read('index.html');
  const body = html.split('<body>')[1];
  assert.equal((body.match(/class="service-card"/g) || []).length, 6);
  for (const match of body.matchAll(/<button class="service-card"[^>]+>/g)) assert.ok(match[0].includes('data-open-consultation'));
  assert.doesNotMatch(body, /enterprise|corporat/i);
  assert.ok(body.indexOf('id="needs"') < body.indexOf('id="services"'));
  assert.ok(body.indexOf('id="services"') < body.indexOf('id="work"'));
  assert.equal((body.match(/data-picker-tab/g) || []).length, (body.match(/data-picker-panel/g) || []).length);
  assert.doesNotMatch(body, /<iframe/);
});

test('portfolio shows only real projects, with filters and image previews', () => {
  const html = read('portfolio/index.html');
  const cards = [...html.matchAll(/<article class="work-card" id="([^"]+)" data-category="([^"]+)"/g)];
  assert.equal(cards.length, 6);
  const filters = [...html.matchAll(/data-filter="([^"]+)"/g)].map(m => m[1]).filter(f => f !== 'all');
  for (const [, , category] of cards) assert.ok(filters.includes(category), 'No filter for ' + category);
  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, /chicagoappliance|chicago-appliance/);
  for (const match of html.matchAll(/data-preview-image="([^"]+)"/g)) assert.match(match[1], /^\.\.\/assets\/portfolio\/[a-z-]+-full\.jpg$/);
});

test('only approved portfolio projects ship with the site', () => {
  const approved = ['fridge-repair', 'grill-on-wheel', 'imperial-towers', 'chicago-cleaning', 'image-converter', 'json-diff'];
  const assets = fs.readdirSync(path.join(root, 'assets/portfolio'));
  for (const name of assets) {
    assert.ok(approved.includes(name.replace(/(-full|-mobile)?\.jpg$/, '')), 'Unexpected portfolio asset ' + name);
  }
  const ids = [...read('portfolio/index.html').matchAll(/<article class="work-card" id="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids.sort(), [...approved].sort());
});

test('consultation form keeps the same payload fields and adds the interest choice', () => {
  const js = read('script.js');
  for (const key of ['firstName', 'lastName', 'fullName', 'email', 'phone', 'message', 'projectDescription', 'attachments']) {
    assert.ok(js.includes(key + ':'), 'payload key ' + key);
  }
  for (const file of pages) assert.equal((read(file).match(/name="interest"/g) || []).length, 4);
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
