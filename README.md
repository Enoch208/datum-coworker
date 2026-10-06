# Datum

**You set the goal. Datum gets the campaign live.**

Datum is an AI Coworker that owns a measurable physical business outcome, from one approval to proof. Field marketing is its first job: tell it to get a QR campaign live at four approved spots before 5 PM for at most SGD 50, approve the plan once, and it coordinates the printing, the placements, the proof and the fixes until every spot is live, or until it reaches the edge of the authority you gave it.

Live at **[usedatum.xyz](https://usedatum.xyz)**. Built for TOKEN2049 Origins 2026 (Cardano / Masumi / Sokosumi Coworker track).

## Why

A small physical campaign is too small for an agency and too fiddly to do yourself while you are building. The work is easy; the coordination is not: prepare the card, print it, brief someone, place it, get proof, notice the spot that was missed, fix it, track the spend. Existing worker platforms run a task you already defined. Datum starts one level higher, with the outcome, and keeps going until the outcome is true.

## How it works: the Goal Loop

```
brief → AI plan → rules check → one approval → physical tasks → evidence
      → is every approved spot proven live?  yes → Campaign Receipt
                                             no  → plan the smallest recovery
                                                   within budget and deadline → act again
```

- **AI drafts, rules decide.** The planner proposes copy and steps. Deterministic code checks the spots, the copy, the budget and the deadline, prices every step from explicit rates, and decides every state change. The model never does money arithmetic and never decides whether a spot is live.
- **One approval locks the bounds.** The approval stores the exact card version, the spot set, the budget, the deadline and the copy. Changing any of them needs a new approval.
- **Evidence, not status.** Each spot has its own QR code. A spot counts only when a photo submitted through its open task, before the deadline, decodes to that spot's code. The server reads the QR and records every check and the reason for each verdict.
- **Spend from receipts.** Physical costs enter a ledger from real receipts. An expense is confirmed only when the receipt reader takes the photo for a purchase receipt with nothing doubtful on it (no test or void marking, a merchant and a date, a printed total) and the amount read from it matches the amount entered in the same currency; anything else is disputed with the reason, never silently counted. The reader is advisory: it never writes an amount.
- **Safe to retry.** Every external action has a deterministic key and is persisted before it runs, so a restart reconciles instead of repeating.

## Datum gets paid as a Coworker on Cardano

Masumi gives the Coworker its commercial lifecycle: signed terms, escrow, a committed result and settlement. Datum's first paid Sokosumi Task ran end to end on Cardano Preprod on 6 October 2026:

| Step                                          | Evidence                                                                                                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hired through a Sokosumi Task                 | Task `01a1106d-fd53-74ce-bedd-07fbd75d136c`                                                                                                                                                                           |
| Agent registered on the Masumi registry       | [8360ea9c…](https://preprod.cardanoscan.io/transaction/8360ea9c5b61a2cf643bc932ac4d13dc839a4d81e2fbc4c51d201a1705c6590b)                                                                                              |
| Buyer's payment locked in escrow              | [2f04c890…](https://preprod.cardanoscan.io/transaction/2f04c89076e7803a6e2bcf7783366c5d2beb0d1763265e2e463e7b352574938f)                                                                                              |
| Result hash committed on chain                | [1143d3ca…](https://preprod.cardanoscan.io/transaction/1143d3caa49856ef388fbffcdc2673de1c89837b25db662c7d18d19433ec2360), hash `586762430e6e389c13271a7d31307114af60ff320227eef2f4ba1dc500e7fb7e` in the escrow datum |
| Task completed with exactly the hashed result | completion event `01a11071-a9cc-70f9-aa3a-36713d0ccb84`                                                                                                                                                               |
| **Seller collected the payment**              | [0ae460f6…](https://preprod.cardanoscan.io/transaction/0ae460f6d36d76c600dd84287a9d3834754c6d9ea1e56ce3939a00c080b587f9): **+1 tUSDM** to the seller address                                                          |

Datum does not mark itself paid because a Task says COMPLETED. It verifies the collection independently: the collection transaction must spend this payment's own escrow output (the one whose datum carries the result hash), the seller's net gain of tUSDM in that transaction must cover the payment, and Sokosumi's receipt, the payment service and the chain must all name the same transaction.

## What is built and what is not

Built and running at usedatum.xyz:

- Campaign brief, AI-drafted proposal, rule validation, cost estimate, printable cards with one QR per spot (each card is tested to scan back to its own URL), one versioned approval.
- Pre-enrolled local runner: a phone inbox, task pages, photo and receipt upload.
- Server-side QR reading of evidence photos, deterministic verdicts with per-check reasons, a spend ledger.
- The full Masumi seller lifecycle shown above.

In progress:

- The autonomous Goal Loop runtime: detecting an incomplete first pass from evidence and dispatching the recovery without the customer.
- The Campaign Receipt and the live campaign screen.
- The first real physical campaign and an external founder's campaign.

## Honest labels

- Physical work in this build is done by a **local enrolled runner**. No external worker marketplace was used.
- Masumi pays **Datum** as the Coworker. Printing and runner costs are ordinary expenses recorded from receipts; they are not paid through Masumi.
- A QR in a photo proves that the expected spot-specific card appears in the evidence. It is not a cryptographic proof of location.
- Any staged failure in a demo is labelled on screen.
- Providers: Sokosumi and the Masumi Payment Service on Cardano Preprod, Blockfrost for chain reads, the Anthropic API for planning and receipt reading.

## Inside

A TypeScript pnpm workspace:

```
packages/core     the contract and the pure engine: money, budget, evidence, goal, state machine, recovery, receipt
packages/db       Postgres schema; invariants enforced by constraints
packages/masumi   Sokosumi and Masumi clients, the resumable paid-Task lifecycle, on-chain verification
apps/api          campaigns, planner, cards, runners, evidence, expenses, scan redirects
apps/web          founder screens and the runner's phone pages
```

## Running it locally

Node 24, pnpm 10, Postgres 17 (`pnpm db:up` uses Docker).

```
pnpm install
cp apps/api/.env.example apps/api/.env      # fill in the values
pnpm db:migrate
pnpm dev                                    # API and web
pnpm test
```

Open http://localhost:5180. As in production, the web server proxies `/api` (prefix stripped), `/c/`, `/assets/cmp_` and `/evidence/` to the API on port 8790, so `APP_BASE_URL` is the web origin, `http://localhost:5180`, and every QR code, card link and runner link works through it.
