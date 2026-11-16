# SUMO AI Solutions

![SUMO AI Solutions: websites, apps, and AI for small businesses](assets/social-preview.png)

**Websites and apps that bring you more customers.**

We help small businesses get online, bring app ideas to life, and spend less time on repetitive work. Based in **Miami, Florida**, we work with clients everywhere.

[Visit our website](https://sumoaisolutions.com/) | [See our work](https://sumoaisolutions.com/portfolio/)

## What We Do

| Service | How we help |
| --- | --- |
| **Websites & web apps** | Business websites, landing pages, redesigns, online stores, booking and quote tools, and custom web apps. |
| **Mobile apps** | iPhone and Android apps for customers, teams, and new business ideas. |
| **AI for your business** | AI assistants that answer customer questions and practical AI tools for everyday work. |
| **Business automation** | Connected tools, automatic follow-ups, and less manual work. |
| **IT consulting & support** | Honest advice, troubleshooting, and hands-on implementation. |
| **Tech hiring help** | Defining roles and finding developers and IT specialists. |

## How We Work

1. **Tell us your idea.** A quick message about your business. No technical brief needed.
2. **Get a clear plan.** Scope, price, and timing agreed before any work starts.
3. **We build and launch.** You review along the way; we launch when you're happy.

## The Website

The site is built for people arriving from social ads, most of them on phones. It's designed to answer "what do you do, can I trust you, and how do I start?" within a few scrolls.

**Homepage sections**

| Section | Purpose |
| --- | --- |
| Hero + project showcase | Clear promise, two calls to action, and a rotating browser/phone preview of real projects. |
| "What does your business need?" | Interactive picker. Visitors choose a goal and see what they get, who it's for, and a matching call to action. |
| Services | Six clickable cards. Each opens the inquiry form with the topic pre-selected. |
| Our work | Two featured projects with hover-to-scroll previews and a link to the full portfolio. |
| Built in, not extra | What every website includes. |
| How it works | Three-step process. |
| FAQ | Common questions from first-time website buyers. |
| Call to action | Final prompt to get in touch. |

On phones, a sticky "Get started" bar appears after the first screen.

**Portfolio** (`/portfolio/`) has filter chips (Home services, Restaurants, Real estate, Web apps), hover-to-scroll previews, full-page previews in a dialog, "Visit live site" links, and a "Build something similar" button on every project.

### Portfolio projects

| Project | Type | Live link |
| --- | --- | --- |
| The Fridge Repair | Home services, South Florida | https://www.thefridgerepair.com/ |
| Grill on Wheel | Restaurant, Hallandale Beach | https://lakviat.github.io/greelonwheel/ |
| Imperial Towers | Real estate (website concept) | https://lakviat.github.io/imperial_towers/ |
| Chi Cleaning Co. | Home services, Chicago | https://lakviat.github.io/chicago_cleaning_services-/ |
| Fast Image Converter | Web app | https://convertjpgs.com/ |
| JSON Diff | Web app | https://www.jsondiff.info/ |

Screenshots in `assets/portfolio/` were rendered from each project's own repository: `<id>.jpg` (desktop, 1200×750), `<id>-mobile.jpg` (390×844), and `<id>-full.jpg` (full page, used for hover-scroll and the preview dialog). Some third-party photos (such as stock images loaded from external hosts) don't appear in the renders, so a few full-page screenshots are cropped above those sections. Re-capture screenshots when a project's design changes. Check every live link before launching new ad campaigns.

## Website Setup

A build-free static website hosted on GitHub Pages. No application server or package installation is required.

| File | Purpose |
| --- | --- |
| `index.html` | Homepage, inquiry form, project preview dialog |
| `portfolio/index.html` | Project gallery with filters and previews |
| `style.css` | Shared design, responsive layouts, dialogs, reduced-motion rules |
| `script.js` | Project showcase, needs picker, filters, dialogs, scroll reveals, form submission, conversion event |
| `assets/icons.svg` | Shared icon sprite |
| `assets/portfolio/` | Project screenshots (desktop, mobile, full page) |
| `assets/fonts/` | Self-hosted Manrope font and its SIL Open Font License |
| `assets/social-preview.png` | Social sharing image; editable SVG source sits alongside it |
| `backend/consultation-handler.gs` | Google Apps Script backend for the inquiry form |
| `sitemap.xml`, `robots.txt` | Search-engine discovery |
| `CNAME` | Custom domain |
| `googlebb0f81e2e8e23f9a.html` | Google site verification |
| `tests/site.test.cjs` | Dependency-free structure and integration checks |

### Brand

Colors come from the existing brand palette: navy `#183552`, ink `#173b44`, cream `#f9faf5` / `#f6f4ef`, peach accent `#ffc3a7`, cyan `#a9e3ee`, and the logo mark (`assets/favicon-sumo-mark.svg`). Type is Manrope.

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

Also review desktop and mobile layouts, keyboard navigation (picker and showcase tabs support arrow keys), reduced-motion mode, every consultation trigger, and every portfolio preview. Test the form with a mocked endpoint to avoid sending test emails or recording artificial ad conversions.

### Inquiry Form

Every "Get started", service card, picker answer, and "Build something similar" button opens the same form. Buttons can pre-select an interest (website, mobile app, AI & automation, something else). The payload keeps all previous fields (`firstName`, `lastName`, `fullName`, `email`, `phone`, `message`, `projectDescription`, `attachments`, `source`, `pageUrl`) and adds `interest` and `topic`. The chosen interest and starting point are also written at the top of `message`, so they show up in the existing email without backend changes.

### Preserved Integrations

- Google Ads base tag `AW-17948229197` on both public pages.
- Lead conversion `AW-17948229197/VZTvCKPwzogcEM38sO5C`, fired after a successful submission.
- Google Apps Script endpoint, attachment limits, and submission flow.
- Canonical URLs, structured data, sitemap, and Google verification file.

The site does not include a Meta Pixel. If you're running Instagram ads, adding the Meta Pixel (and a `Lead` event alongside the Google conversion) will let Meta optimize for form submissions. That needs the Pixel ID from Meta Events Manager.

### Deployment

Publish the repository root from `main` using the existing GitHub Pages configuration. Both HTML files use the same versioned CSS and JavaScript URLs (`?v=…`); update them together when changing shared assets.

## Start a Conversation

Use **Get started** on [sumoaisolutions.com](https://sumoaisolutions.com/). Tell us what you're building, what needs improving, or where you could use a hand.
