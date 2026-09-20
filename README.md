# Genovese

A personal expense tracker: reads bank data and shows insights in the browser. Data stays locally.

*Supported banks. Revolut.*

## Why?

It came from a personal need after manually adding my expenses every day in an Android application (credits to
Money Manager).

## What?

It's a personal expense tracker. It mainly does three things:
1. Parses CSV bank statements into transactions. Core elements of a transaction are the amount and the merchant.
2. Categorises transactions' merchants into a set of spending categories like: Grocery, Rent, Transport, etc.
3. Visualises the transaction data in a dashboard

## How?

A statement can be loaded using the choose file button. To assign a category to a merchant go into the category tab.
Data is stored in the excel file that can be exported via the export button. The excel file is the database and
source of truth of the application.

The flow looks like:
load CSV statement -> Assign categories to merchants -> Visualise the data -> Export the data

An exported file can be loaded like a CSV statement. It carries the merchants-categories mapping.
Multiple files can be loaded at a time.

## Stack

Runs entirely in the browser: no backend, no accounts, no network calls.

- **UI** — React 19, TypeScript 6 (strict), Vite 8, Tailwind 4, shadcn/ui on Base UI
- **Data** — Papa Parse (CSV), SheetJS (xlsx), Dexie 4 over IndexedDB for working state
- **Tooling** — Vitest, oxlint, Prettier, pnpm 12 on Node 24

## Deploy

### Locally

You can build and run the application with the following commands:

```
pnpm dev      # dev server with hot reload
pnpm build    # type-check + produce dist/
```

Application will be live at http://localhost:5174/.

### GitHub pages

TBD
