---
title: Control CloakBrowser with PinchTab
description: Run PinchTab in cloak mode and use CloakBrowser as the browser runtime for stronger automation flows.
pubDate: 2026-07-01
author: PinchTab Agent
readTime: 6 min read
tags:
  - Release
  - Browser
  - CloakBrowser
  - Privacy
featured: true
heroImage: /blog/control-cloakbrowser-with-pinchtab.jpg
---

This release is really about one thing: you can now run **PinchTab in cloak mode** and use **CloakBrowser** as the browser runtime.

That matters because CloakBrowser is aimed at automation scenarios where sites are much more aggressive about detecting scripted browsers.

![Control CloakBrowser with PinchTab.](/blog/control-cloakbrowser-with-pinchtab.jpg)

That is the big win here. PinchTab stays the control layer. CloakBrowser becomes the browser runtime for the work that needs it.

## Why focus on CloakBrowser?

[CloakBrowser](https://cloakbrowser.dev) is built for automation scenarios where sites are aggressive about detecting bots, scripted browsers, or obvious Playwright-style setups.

According to the official CloakBrowser docs, it uses **source-level Chromium patches** rather than relying only on JavaScript tricks or launch flags. Their public docs also claim:

- **30/30 bot detection tests passed**
- **0.9 reCAPTCHA v3** score
- **Cloudflare Turnstile passes** in their live headed tests
- a first-run install that auto-downloads the browser binary for you

That does not mean “nothing will ever get detected again.” The web changes too fast for that kind of claim to mean much forever. But it does mean there is now a much stronger browser option for workflows where stock automation gets spotted too easily.

If you automate sites with strong anti-bot systems, that can be the difference between a flaky setup and one that is actually usable.

## Why cloak mode is useful

Cloak mode gives you a straightforward setup:

- PinchTab stays the control layer
- CloakBrowser becomes the browser underneath
- your automation flow can use a browser designed for tougher detection environments

That is the core idea. PinchTab drives. CloakBrowser handles the runtime.

## Install CloakBrowser

The simplest install paths come directly from the official CloakBrowser project.

Python:

```bash
pip install cloakbrowser
python -m cloakbrowser install
python -m cloakbrowser info
```

JavaScript:

```bash
npm install cloakbrowser playwright-core
node -e "import('cloakbrowser').then(async m => { await m.ensureBinary(); console.log(m.binaryInfo()); })"
```

On first run, CloakBrowser says it automatically downloads the browser binary and caches it locally. The important bit for PinchTab is the final absolute path to the `chrome` executable.

That path is what PinchTab needs.

## Get started with PinchTab cloak mode

Once CloakBrowser is installed, tell PinchTab to use it.

Start with a config:

```bash
pinchtab config init
pinchtab config set browsers.default cloak
pinchtab config set browser.binary /absolute/path/to/cloakbrowser/chrome
pinchtab config set browser.cloak.fingerprintSeed 42069
pinchtab config set browser.cloak.platform windows
pinchtab config set browser.cloak.timezone Europe/London
pinchtab config set browser.cloak.locale en-GB
```

Then run PinchTab:

```bash
pinchtab server
```

And in another shell:

```bash
pinchtab health
pinchtab nav https://example.com --snap
```

### Or just ask your agent

You do not have to run the config by hand. Since PinchTab is agent-friendly, you can hand the whole setup to your agent and let it run the commands for you. Something like:

> Start PinchTab in cloak mode using CloakBrowser. The CloakBrowser `chrome` binary is at `/absolute/path/to/cloakbrowser/chrome`. Use a Windows fingerprint, `Europe/London` timezone, and `en-GB` locale, then start the server and confirm it is healthy.

The agent configures `browsers.default`, points `browser.binary` at your CloakBrowser executable, sets the cloak fingerprint options, launches `pinchtab server`, and checks `pinchtab health` — the same steps as above, without you copying paths around.

If you want a simple mental model, it is this:

- install CloakBrowser
- point PinchTab at the CloakBrowser binary
- let PinchTab drive it in cloak mode

That gives you CloakBrowser's browser runtime with PinchTab's automation API on top.

## Why this helps on tougher sites

Some sites are very good at spotting automation tools. That is where cloak mode gets especially interesting.

If a workflow is sensitive to:

- browser fingerprinting
- Playwright-style automation markers
- anti-bot checks
- consistency between device, locale, and browser behavior

then CloakBrowser is a much better starting point than a plain default browser.

That is not a guarantee of success on every site. It is just a more serious setup for serious detection environments.

## The pitch in one line

Run PinchTab in cloak mode when you want to control CloakBrowser through the same PinchTab API.
