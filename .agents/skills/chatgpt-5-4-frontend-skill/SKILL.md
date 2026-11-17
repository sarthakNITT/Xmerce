---
name: chatgpt-5-4-frontend-skill
description: Use when the task is to design or build a visually distinctive landing page, website, app, dashboard, prototype, demo, or game UI where composition, hierarchy, imagery, brand presence, and motion matter as much as correctness. Apply it to push work away from generic SaaS card grids, weak first screens, noisy copy, and overbuilt layouts, especially for React and Tailwind frontend work.
---

# ChatGPT 5.4 Frontend Skill

Build frontends that feel deliberate, visual, and current. Default toward one strong idea per section, a clear first-screen hierarchy, short copy, real visual anchors, and a small set of intentional motions.

## Workflow

Before building, write three short bullets:

- visual thesis: mood, material, and energy
- content plan: first screen, support, detail, conversion
- motion thesis: 2-3 interactions or transitions worth noticing

Then pick the surface:

- Landing page or marketing site: structure the page as a narrative.
- App, dashboard, or admin UI: start with the working surface, not a marketing hero.
- Existing product or design system: preserve its tokens, components, and visual language; apply this skill to composition, hierarchy, copy, and motion choices.

## Build Rules

- Start with composition and information hierarchy before adding components.
- Make the brand, product, or primary task obvious in the first viewport.
- Use one dominant visual anchor per section.
- Keep supporting copy to a sentence when possible.
- Default to cardless layouts; use cards only when the card is the interaction.
- Limit new systems to two typefaces and one accent color unless the product already has a stronger system.
- Keep fixed or floating UI from covering key text, controls, or charts on any breakpoint.
- Build for desktop and mobile together; do not treat mobile as a later cleanup pass.

## Surface Guidance

### Landing Pages

- Use a clear sequence: hero, support, detail, final CTA.
- Treat the first viewport like a poster: one composition, one message, one action.
- Prefer full-bleed imagery or a full-canvas visual plane over inset promo blocks.
- Keep the hero lightweight: brand, headline, short support, CTA, dominant visual.

### Apps and Dashboards

- Organize around workspace, navigation, secondary context, and one accent for action or state.
- Favor dense but readable layout over mosaics of decorative cards.
- Use utility copy that helps operate, monitor, or decide.
- Remove sections that do not help a user act, understand status, or interpret data.

## Motion

- Add 2-3 intentional motions for visually led work.
- Use motion to improve hierarchy, affordance, or atmosphere.
- Prefer fast, smooth, restrained transitions over constant animation.
- Delete ornamental motion that does not improve scanning or interaction.

## Review Pass

Check the result against these questions:

- Is the first screen unmistakably tied to the brand, product, or task?
- Is there one strong visual anchor?
- Can the page be understood by scanning the headlines and labels?
- Does each section have one job?
- Are cards necessary, or just decoration?
- Does motion improve the experience instead of adding noise?
