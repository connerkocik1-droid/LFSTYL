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
- **Budget plan:** Money → Budget plan sets how much of each paycheck goes to each category, and shows pay minus bills, categories and goals, with what's left unassigned. Paycheck reviews start from the plan, and you can apply it to the current paycheck.
- **Budget items:** on the Budget plan, + ADD ITEM creates your own category with a fixed amount each paycheck (e.g. Dog food, $50). Tap any item to rename it or change its amount. An item can be deleted once it has no spending in the current paycheck.
- **Fixing mistakes:** tap an expense on Money to edit its amount, note, date or category, or delete it. Extra income entries are listed on Money and can be edited or deleted; if some was already placed, **Take back** moves money from categories or goals back to Unassigned first.
- **Before the first paycheck:** Money offers **Add money on hand** so spending before payday has a budget.
- **Placing unassigned money:** Place it (Money) and extra income can be split across any number of categories and goals. Tap a row to give it what's left, or type amounts; anything not placed stays in Unassigned.
- **Savings goals:** Goals → + NEW GOAL. Fund a goal by a deadline (how many paychecks until you need it) or with a fixed amount. A deadline goal takes *what's left ÷ paychecks left* (rounded up to whole dollars), recalculated every paycheck, so extra money or a skipped paycheck re-spreads over the rest.
- **Subscriptions:** Money → Subscriptions. Each one has an amount, how often it repeats (weekly, monthly, yearly), the next charge date and a category. Every charge is logged as an expense on its date, including charges that came due while the app was closed.
- **Income and bills:** income sources and fixed bills. Changes apply from the next paycheck.
- **Quick add (+):** expense, income, pouch +1, project and task.
- **Editing tasks and projects:** tap a task (Tasks or Today) to change its title, due date, tier and notes, or delete it. In a project, tap a step to edit it (a buy step's estimate and category too), and **EDIT** renames the project or deletes it. Deleting an action deletes its buy step; a bought buy step must be unmarked first.
- **Weight:** Goals → Weight logs weigh-ins (one per day), sets a target and shows the trend.
- **Safe to spend today:** on Today, what's left this paycheck divided by the days to payday.
- **Settings:** the ··· button on Today. Track nicotine, shortcut links and sign out.
- **Shortcuts:** `/?do=expense`, `/?do=pouch`, `/?do=task` and `/?do=income` open straight to that action. They're also manifest shortcuts (long-press the icon on Android); on iPhone, use them with **Open URL** in the Shortcuts app.

Not built yet: Library document and event detail, and the desktop layout. The Library tab shows the design's sample folders and events.

## Accounts and sync

You create an account with your first name, last name and a 4-digit PIN (entered twice), and sign in on other devices with the same three. Email can be linked later.

- **New accounts start empty:** no tasks, projects, goals, income, bills, wean-off plan or weigh-ins, and the Library folders are empty. The five starter categories exist at $0; rename, delete or add to them on the Budget plan. The first budget period runs from sign-up until the first pay date you set under Money → Income and bills. The design's sample data appears only in `?demo=` screens.
- **Sync:** the app saves every change on the device right away and to Supabase shortly after. On launch it uses whichever copy is newer; if the device has changes the server never got, it sends them. A save is only accepted on top of the copy that device last saw (`lfstyl_save_v2`), so an out-of-date device can't overwrite newer data: its save is refused and it reloads the server copy. Coming back to the app also picks up changes from other devices. Offline, it opens with what's on the device.
- **Security:** PINs are stored as bcrypt hashes. Five wrong PINs lock the account for 15 minutes. The tables are closed to the public API key; the app can only call `lfstyl_sign_up`, `lfstyl_sign_in`, `lfstyl_load` and `lfstyl_save`, which check the PIN or a session token first. A 4-digit PIN is still a short secret, so link an email or move to a longer secret before storing anything sensitive.
- **Project:** the Supabase URL and publishable key are built in as defaults in `src/lib/persist.ts` (both are public values). `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` override them; set either to `off` to keep data on the device only.
- **Schema:** `supabase/migrations/0002_pin_accounts.sql`, already applied. `0003` adds the conflict-checked save. `0001` (email sign-in) is superseded; its empty `lfstyl_state` table is unused.

## Icons

`npm run icons` re-renders `public/icons/*` with Playwright from `scripts/make-icons.mjs`.
