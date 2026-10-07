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
- **Spend from receipts.** Printing enters the ledger from a real receipt, and each runner fee enters it as an agreed rate, labelled as having no receipt. A receipt is confirmed only when the receipt reader takes the photo for a purchase receipt with nothing doubtful on it (no test or void marking, a merchant and a date, a printed total) and the amount read from it matches the amount entered in the same currency; anything else, including a receipt the reader could not check, is disputed with the reason, never silently counted. The reader is advisory: it never writes an amount.
- **Safe to retry.** Every external action has a deterministic key and is persisted before it runs, so a restart reconciles instead of repeating.

## The first real campaign

On 7 October 2026, Maadhav, the founder of CodeDecoders, created and approved a campaign on usedatum.xyz: one QR card for a spot he named at Marina Bay Sands Expo, a budget of SGD 100. A member of the Datum team did the physical work as the local enrolled runner. Datum's evidence verifies that the photo shows that spot's own card; it does not independently verify the photo's location.

| SGT      | What happened                                                                                                                                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19:05    | Maadhav approved the plan                                                                                                                                                                                                                                                             |
| 20:41    | The card was printed at home with no shop receipt. The receipt reader could not read the photo as a purchase receipt, so Datum disputed the SGD 0.50; Maadhav accepted it, which the receipt counts as one manual intervention                                                        |
| 20:47:18 | Spot A, first photo: the QR code was cut off on purpose, labelled on screen as a demo test. Verdict `QR_NOT_FOUND`                                                                                                                                                                    |
| 20:47:52 | Datum evaluated the goal, found Spot A unresolved and moved to recovery                                                                                                                                                                                                               |
| 20:47:56 | The model proposed one trip with a note for the runner, the rules checked it against the budget and the deadline, and attempt 2 was dispatched under the key `campaign:cmp_d1tmstsxkymtjp7n:spot:A:attempt:2`. No human input is recorded between detecting the miss and the dispatch |
| 20:49:19 | Attempt 2 passed. The campaign completed 1/1 and published its Campaign Receipt                                                                                                                                                                                                       |

[The Campaign Receipt](https://usedatum.xyz/campaigns/cmp_d1tmstsxkymtjp7n/receipt): first pass 0/1, 1 automatic recovery, 1 manual intervention, SGD 10.50 of physical cost recorded against the SGD 100.00 budget (the SGD 0.50 home print the customer accepted, plus two SGD 5.00 agreed runner fees, which are owed at an agreed rate and carry no receipt), 1 QR scan, SHA-256 `bfa8a63d33b2d14580fe0ca3b9ccda7a084f6d7eb67cafc3e5d6013a0e1793bf`. This campaign was created on the website, not hired through a Sokosumi Task, so it carries no Masumi payment.

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
- The Goal Loop worker. It evaluates the goal from evidence, and when a spot is missing it gives the model the unresolved spots, the remaining budget and the time left. The model proposes a recovery; the rules check it against the approval and either commission it without the customer or stop at NEEDS_APPROVAL with the extra amount needed. If the model is unavailable or its plan fails the rules, a deterministic plan runs instead. Each campaign is claimed under a Postgres advisory lock and every action carries a deterministic key, so a restarted worker reconciles instead of commissioning twice.
- The live campaign screen, a record of why Datum took each decision, and the Campaign Receipt, stored as canonical JSON with its SHA-256.
- The Masumi seller lifecycle shown above, and the Coworker service that turns a hired Sokosumi Task into a campaign. It reads the brief from the Task and posts the proposal link. It works only after the escrow is funded and the customer has approved. When the campaign ends, the Task result names the Campaign Receipt's SHA-256 and links its exact bytes. Datum commits that result's hash on chain, completes the Task and verifies its own collection.

Not done yet:

- A campaign with several spots. The first real campaign had one.
- A print run with a shop receipt. The first campaign was printed at home, so its print cost was accepted by the customer instead of confirmed from a receipt.
- A hired Sokosumi Task carried through a real campaign to collection. The paid-Task lifecycle itself is proven above, with a one-line result.

## Honest labels

- Physical work in this build is done by a **local enrolled runner**. No external worker marketplace was used.
- Masumi pays **Datum** as the Coworker. Printing is recorded from a receipt and each runner fee is an agreed rate recorded when a placement completes, with no receipt; neither is paid through Masumi.
- A QR in a photo proves that the expected spot-specific card appears in the evidence. It is not a cryptographic proof of location.
- Any staged failure in a demo is labelled on screen.
- Providers: Sokosumi and the Masumi Payment Service on Cardano Preprod, Blockfrost for chain reads, the Anthropic API for planning and receipt reading.

## Known limits

- **No accounts yet.** A campaign's link is its authority. The campaign ID also appears in each card's QR URL, so anyone who scans a placed card can learn it. The customer actions (raising the budget, accepting a disputed receipt) are checked against the campaign's state, not against who is asking, and `approvedBy` and `acceptedBy` are names the customer typed, not verified identities. The next step is a per-campaign owner key, derived on the server and carried in the link the customer is given.
- **A runner's purchase is checked after the fact.** Datum checks the budget before it commissions each step, and the print task tells the runner the approved maximum and to stop rather than pay more. Nothing enforces that at the till: what the runner paid is only known when the receipt arrives.
- **Evidence photos have no access check.** The public Campaign Receipt links them, so each is served to anyone who has its random 128-bit filename.
- **One Task at a time.** The Coworker works its Sokosumi Tasks one after another, so a slow model call delays the others.

## Inside

A TypeScript pnpm workspace:

```
packages/core     the contract and the pure engine: money, budget, evidence, goal, state machine, recovery, receipt
packages/db       Postgres schema; invariants enforced by constraints
packages/masumi   Sokosumi and Masumi clients, the resumable paid-Task lifecycle, on-chain verification
apps/api          campaigns, planner, cards, runners, evidence, expenses, the Goal Loop, receipts, scan redirects
apps/worker       the durable Goal Loop process
apps/coworker     the always-on Sokosumi Coworker: hired Task → campaign → paid result
apps/web          founder screens, the Campaign Receipt and the runner's phone pages
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
