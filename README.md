# SUMO AI Solutions

![SUMO AI Solutions: websites, apps, and AI for small businesses](assets/social-preview.png)

**A better website. A smarter business.**

We help small businesses get online, bring app ideas to life, and spend less time on repetitive work. Based in **Miami, Florida**, we work with clients everywhere.

[Visit our website](https://sumoaisolutions.com/) | [Explore the portfolio](https://sumoaisolutions.com/portfolio/)

## What We Do

| Service | How we help |
| --- | --- |
| **Websites & web apps** | Business websites, landing pages, online stores, booking tools, customer portals, and custom web applications. |
| **Mobile apps** | iPhone and Android apps for customers, teams, and new business ideas. |
| **AI for your business** | Customer assistants, AI-powered tools, and practical help using AI in everyday work. |
| **Business automation** | Connect your tools, simplify follow-ups, reduce manual tasks, and save time. |
| **IT consulting & support** | Clear advice, troubleshooting, software improvements, system integration, and hands-on implementation. |
| **IT recruiting & talent support** | Find developers and IT specialists, define roles, source candidates, and strengthen your team. |

We can start from scratch or improve what you already have. You don't need a technical brief to start a conversation.

## How We Work

1. **Tell us your idea.** A conversation about your business and what you need.
2. **Get a clear plan.** Agree on the scope, price, and timing before building.
3. **Bring it to life.** Design, build, review together, and launch.

Every service card and consultation button opens the same inquiry form. It accepts a name, email, optional phone number, project description, and optional attachments. Reference links can go directly in the description.

## Portfolio

Our project gallery currently features **TV Mount 360** and **Jobs in Kyrgyzstan**. The separate inspiration gallery credits independent personal website designs; these are **not represented as SUMO projects**.

Project links were checked on **November 16, 2026**:

| Website | Result | Presentation |
| --- | --- | --- |
| TV Mount 360 | HTTP 200; expected site present | Local thumbnail, on-demand live preview |
| Jobs in Kyrgyzstan | HTTP 200; expected site present | Local thumbnail, on-demand live preview |
| Indi Harris | HTTP 200; embedding restricted | Credited inspiration, scrollable image preview |
| Ollivere | HTTP 200; embedding restricted | Credited inspiration, scrollable image preview |
| Nick Velten | HTTP 200; expected site present | Credited inspiration, scrollable image preview |
| Chicago Appliance Repair | HTTP 404, GitHub Pages "Site not found" | Removed from the gallery and sitemap |

Preview images are stored locally, rather than loading several external websites when someone opens the page. Every preview includes an **Open Live Site** link. External sites can change or restrict embedding, so check them again before new ad campaigns.

The homepage's illustrated website and mobile screen are explicitly labeled **design concepts**, not client projects.

## Website Setup

A build-free static website hosted on GitHub Pages. No application server or production package installation is required.

| File | Purpose |
| --- | --- |
| `index.html` | Small-business homepage, service cards, portfolio highlights, consultation form |
| `portfolio/index.html` | Project gallery, independent inspiration, preview dialogs |
| `style.css` | Shared design, responsive layouts, dialog styles, reduced-motion rules |
| `script.js` | Dot-grid animation, dialogs, attachment handling, form submission, conversion event |
| `assets/portfolio/` | Locally stored project thumbnails and full-page inspiration previews |
| `assets/fonts/` | Self-hosted Manrope font and its SIL Open Font License |
| `assets/social-preview.png` | Social sharing image; editable SVG source sits alongside it |
| `backend/consultation-handler.gs` | Existing Google Apps Script backend |
| `sitemap.xml`, `robots.txt` | Search-engine discovery |
| `CNAME` | Existing custom domain |
| `googlebb0f81e2e8e23f9a.html` | Google site verification |
| `tests/site.test.cjs` | Dependency-free structure and integration checks |

### Local Preview

From the repository root:

```sh
python3 -m http.server 9090
```

Open [the homepage](http://localhost:9090/) or [the portfolio](http://localhost:9090/portfolio/).

### Checks

```sh
node --check script.js
node --test tests/site.test.cjs
```

Also review desktop and mobile layouts, keyboard navigation, reduced-motion mode, all consultation triggers, and every portfolio preview. Test form responses with a mocked endpoint to avoid sending test emails or recording artificial ad conversions.

### Preserved Integrations

- Google Ads base tag: `AW-17948229197`, present on both public pages.
- Existing lead conversion destination: `AW-17948229197/VZTvCKPwzogcEM38sO5C`.
- Existing form payload, attachment limits, Google Apps Script endpoint, and submission flow.
- Existing search keywords, canonical URLs, structured service data, and Google verification file.
- Existing desktop pointer interaction and lightweight touch-screen ambient motion.

The redesign does not install a Meta Pixel, add WhatsApp contact information, or change ad-account configuration. Those need the relevant account details and contact number.

### Deployment

Publish the repository root from `main` using the existing GitHub Pages configuration. Both HTML files use the same versioned CSS and JavaScript URLs; update those versions together when changing shared assets. The sitemap includes only the two published page routes.

Core content renders without waiting for JavaScript. Fonts and preview images are served with the site; third-party websites load only after a visitor requests a live preview. Motion respects reduced-motion preferences and pauses when the tab is hidden.

## Start a Conversation

Use **Book a Consultation** on [sumoaisolutions.com](https://sumoaisolutions.com/). Tell us what you're building, what needs improving, or where you could use a hand.
