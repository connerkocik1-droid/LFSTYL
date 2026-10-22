# LFSTYL

One app for tasks, goals and a per-paycheck budget, so every task, purchase and goal moves the same money. It is a mobile-first PWA: install it to the home screen and it opens full screen with its own icon and no browser bar.

Built with Next.js (App Router), React 19 and TypeScript. It deploys to Vercel as static files. Data stays on the device unless Supabase sync is configured.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

### Demo screens

`/?demo=<screen>` opens the app on one of the design's flow steps with the sample data and "today" pinned to Wed 21 Oct 2026. Nothing is saved in demo mode. Add `&theme=light` or `&theme=dark` to force a theme.

`today` `tasks` `money` `goals` `library` `add` `np` `np-buy` `np-drag` `price-unlinked` `price-linked` `bought-proj` `bought` `paycheck` `review` `money-new` `goal` `goal-card` `done1` `done2` `expense` `expense-done` `income` `place` `over` `wean` `setup` `setup-inc` `setup-bill`

## What's in it

The design is the 1c "Lens + panes" direction: thick glass on the money hero, the pouch +1, the tab bar and the + button, and thin frosted panes for lists. It follows the light or dark system theme. The background drifts with the time of day, and its lower color field follows budget health (green when healthy, amber when a category is over, red when the paycheck is over). Reduced motion stops the drift, and reduced transparency switches to solid surfaces.

- **Today:** left this paycheck, pouches against today's limit, budget status, and Next up (overdue, then due within 3 days, then up to two open-ended tasks untouched for 14+ days, with a buy step listed before its action).
- **Tasks:** tier filters, open and done, project cards, and tasks grouped by due date.
- **Projects:** ordered steps; drag ⋮⋮ to reorder, and a buy step moves with its action. Buy steps come out of the linked goal, or out of a paycheck category if the project has no goal.
- **Money:** the current period with categories, goal contributions, bills taken off the top and expenses. Swipe the hero or use ‹ › for past periods.
- **Paycheck review:** on payday, Today shows the paycheck. The review prefills categories and goals from last period, and confirming opens the new period.
- **Goals:** savings goals count contributions, project goals count purchases. When a goal completes, you choose where its per-paycheck amount goes.
- **Income and bills:** income sources and fixed bills. Changes apply from the next paycheck.
- **Quick add (+):** expense, income, pouch +1, project and task.

Not built yet, matching the design: weight detail, Library document and event detail, the task edit sheet, and the desktop layout. The Library tab shows the design's sample folders and events.

## Sync with Supabase

The app syncs with the LFSTYL Supabase project (`pocxcrqwlacfomucrjpy`). Its URL and publishable key are built in as defaults in `src/lib/persist.ts`. Both are public values that ship to every browser, and row-level security keeps each user's row private. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` override them; set either one to `off` to keep data on the device only.

You sign in once with your email. The app then saves every change locally right away and to Supabase shortly after, and on launch it uses whichever copy is newer.

**Email templates:** sign-in uses a 6-digit code, because inside the installed app a link would open the browser instead. In Supabase, go to **Authentication → Email Templates** and add `{{ .Token }}` to both **Magic Link** and **Confirm signup** (your first sign-in uses Confirm signup). The link in those emails still works if you open the app in a browser.

The schema is in `supabase/migrations/0001_lfstyl_state.sql` and has already been applied.

## Icons

`npm run icons` re-renders `public/icons/*` with Playwright from `scripts/make-icons.mjs`.
