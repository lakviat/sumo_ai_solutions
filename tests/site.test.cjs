const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pages = ['index.html', 'portfolio/index.html'];
const origin = 'https://' + read('CNAME').trim();
const meta = (html, name) => html.match(new RegExp('<meta\\s+(?:name|property)="' + name + '"\\s+content="([^"]*)"'))?.[1].replace(/&amp;/g, '&');
const graph = file => JSON.parse(read(file).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
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

  test(file + ': consistent canonical, search, sharing, and page identity', () => {
    const canonical = origin + (file === 'index.html' ? '/' : '/portfolio/');
    const title = html.match(/<title>([^<]+)<\/title>/)[1].replace(/&amp;/g, '&');
    const description = meta(html, 'description');
    assert.ok(title.includes('SUMO AI Solutions'));
    assert.ok(description.includes('SUMO AI Solutions'));
    assert.equal((html.match(/<link rel="canonical"/g) || []).length, 1);
    assert.ok(html.includes('<link rel="canonical" href="' + canonical + '">'));
    assert.equal(meta(html, 'og:url'), canonical);
    assert.equal(meta(html, 'og:site_name'), 'SUMO AI Solutions');
    for (const prefix of ['og', 'twitter']) {
      assert.equal(meta(html, prefix + ':title'), title);
      assert.equal(meta(html, prefix + ':description'), description);
      assert.ok(meta(html, prefix + ':image:alt').includes('SUMO AI Solutions'));
    }
    assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
    assert.equal(meta(html, 'twitter:image'), meta(html, 'og:image'));
    const image = new URL(meta(html, 'og:image'));
    assert.equal(image.origin, origin);
    const png = fs.readFileSync(path.join(root, image.pathname.slice(1)));
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.equal(Number(meta(html, 'og:image:width')), png.readUInt32BE(16));
    assert.equal(Number(meta(html, 'og:image:height')), png.readUInt32BE(20));
    assert.match(meta(html, 'robots'), /\bindex\b/);
    for (const agent of ['robots', 'googlebot', 'bingbot']) {
      assert.doesNotMatch(meta(html, agent) || '', /\b(noindex|nofollow|none|nosnippet)\b/i);
    }
    const page = graph(file).find(node => node['@id'] === canonical + '#page');
    assert.equal(page.url, canonical);
    assert.equal(page.name, title);
    assert.equal(page.description, description);
    assert.equal(page.inLanguage, 'en');
    assert.equal(page.isPartOf['@id'], origin + '/#website');
    assert.equal(page.about['@id'], origin + '/#organization');
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

test('homepage connects the brand, website, page, and visible service offerings', () => {
  const nodes = graph('index.html');
  const organization = nodes.find(node => node['@id'] === origin + '/#organization');
  const website = nodes.find(node => node['@id'] === origin + '/#website');
  const page = nodes.find(node => node['@id'] === origin + '/#page');
  const services = nodes.find(node => node['@id'] === origin + '/#service');
  assert.equal(organization['@type'], 'Organization');
  assert.equal(organization.name, 'SUMO AI Solutions');
  assert.equal(organization.url, origin + '/');
  assert.equal(organization.location.name, 'Miami, Florida');
  assert.ok(!organization.sameAs?.includes(organization.url));
  assert.equal(website['@type'], 'WebSite');
  assert.equal(website.name, organization.name);
  assert.equal(website.url, organization.url);
  assert.equal(website.publisher['@id'], organization['@id']);
  assert.equal(page['@type'], 'WebPage');
  assert.equal(page.mainEntity['@id'], services['@id']);
  assert.equal(services['@type'], 'Service');
  assert.equal(services.provider['@id'], organization['@id']);
  const cards = [...read('index.html').matchAll(/<button class="service-card" id="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
  const offers = services.hasOfferCatalog.itemListElement;
  assert.equal(offers.length, cards.length);
  for (const [index, offer] of offers.entries()) {
    const service = offer.itemOffered;
    assert.equal(offer['@type'], 'Offer');
    assert.equal(service['@type'], 'Service');
    assert.equal(service['@id'], origin + '/#' + cards[index][1]);
    assert.equal(service.url, service['@id']);
    assert.equal(service.provider['@id'], organization['@id']);
    assert.equal(service.description, cards[index][2].match(/class="service-description">([^<]+)<\/span>/)[1]);
  }
  const hero = read('index.html').match(/<div class="hero-copy"[\s\S]*?<\/div>/)[0];
  assert.match(hero, /SUMO AI Solutions builds websites, mobile apps, and practical AI tools for small businesses/);
});

test('portfolio structured data matches the visible projects and breadcrumbs', () => {
  const nodes = graph('portfolio/index.html');
  const page = nodes.find(node => node['@type'] === 'CollectionPage');
  const breadcrumbs = nodes.find(node => node['@type'] === 'BreadcrumbList');
  const cards = [...read('portfolio/index.html').matchAll(/<article class="work-card" id="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
  assert.equal(page.publisher['@id'], origin + '/#organization');
  assert.equal(page.breadcrumb['@id'], breadcrumbs['@id']);
  assert.deepEqual(breadcrumbs.itemListElement.map(item => item.item), [origin + '/', origin + '/portfolio/']);
  assert.equal(page.mainEntity['@type'], 'ItemList');
  assert.equal(page.mainEntity.numberOfItems, cards.length);
  assert.deepEqual(page.mainEntity.itemListElement, cards.map((card, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: card[2].match(/<h2 class="h3">([^<]+)<\/h2>/)[1],
    url: origin + '/portfolio/#' + card[1]
  })));
});

test('public content remains open to conventional and AI search crawlers', () => {
  const robots = read('robots.txt');
  const agents = [...robots.matchAll(/^User-agent:\s*(.+)$/gim)].map(match => match[1].trim());
  assert.deepEqual(agents, ['*']);
  assert.match(robots, /^Allow:\s*\/\s*$/im);
  assert.doesNotMatch(robots, /^Disallow:[^\S\r\n]*\S+/im);
  const sitemaps = [...robots.matchAll(/^Sitemap:\s*(.+)$/gim)].map(match => match[1].trim());
  assert.deepEqual(sitemaps, [origin + '/sitemap.xml']);
});

test('short service-first homepage without duplicate portfolio cards', () => {
  const html = read('index.html');
  const body = html.split('<body>')[1];
  assert.equal((body.match(/class="service-card"/g) || []).length, 6);
  for (const match of body.matchAll(/<button class="service-card"[^>]+>/g)) assert.ok(match[0].includes('data-open-consultation'));
  assert.doesNotMatch(body, /enterprise|corporat/i);
  assert.ok(body.indexOf('id="services"') < body.indexOf('id="work"'));
  assert.doesNotMatch(body, /data-picker|class="work-card"|showcase-badge/);
  assert.equal((body.match(/data-showcase-desktop/g) || []).length, 6);
  assert.equal((body.match(/data-showcase-mobile/g) || []).length, 6);
  assert.equal((body.match(/data-showcase-tab /g) || []).length, 6);
  assert.match(body, /data-showcase-pause/);
  assert.doesNotMatch(body, /<iframe/);
});

test('published pages have unified branding and accessible navigation', () => {
  for (const file of pages) {
    const html = read(file);
    const header = html.match(/<header[\s\S]*?<\/header>/)[0];
    assert.match(header, /SUMO AI Solutions/);
    assert.match(header, /Services/);
    assert.match(header, /Portfolio/);
    assert.match(header, /Contact/);
    assert.doesNotMatch(html, /kyrgyz/i);
  }
  assert.doesNotMatch(read('style.css'), /\.site-nav\s*\{\s*display:\s*none/);
  assert.doesNotMatch(read('style.css'), /#ffc3a7|#ffd2bb/i);
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
  const sitemap = read('sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(urls, ['https://sumoaisolutions.com/', 'https://sumoaisolutions.com/portfolio/']);
  const dates = [...sitemap.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map(m => m[1]);
  assert.equal(dates.length, urls.length);
  for (const date of dates) {
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Date.parse(date) <= Date.now(), 'Sitemap lastmod must not be in the future');
  }
  assert.equal(read('googlebb0f81e2e8e23f9a.html').trim(), 'google-site-verification: googlebb0f81e2e8e23f9a.html');
  assert.ok(read('script.js').includes('AW-17948229197/VZTvCKPwzogcEM38sO5C'));
});
