# LOB Market Microstructure Simulator

A C++ limit order book (LOB) and matching engine that reconstructs real market microstructure — message by message — from historical exchange data, with a browser-based terminal for visualizing the replay.

This document leans heavily into how the **order book engine itself** actually works internally: its data structures, its order-matching algorithm, its complexity characteristics, and — because understanding a matching engine means understanding what it actually does, not just what it's supposed to do — two concrete, reproduced behaviors in the current matching logic that anyone building on this code should know about.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [The Order Book Engine](#the-order-book-engine)
  - [Data Structures](#data-structures)
  - [Adding an Order](#adding-an-order)
  - [The Matching Algorithm](#the-matching-algorithm)
  - [Verified Matching Behaviors](#verified-matching-behaviors)
  - [Cancelling an Order](#cancelling-an-order)
  - [Market Event Replay](#market-event-replay)
  - [Performance Characteristics](#performance-characteristics)
- [The Web Terminal](#the-web-terminal)
- [Repository Structure](#repository-structure)
- [Data Format](#data-format)
- [Requirements](#requirements)
- [Building From Source](#building-from-source)
- [Running the Simulator](#running-the-simulator)
  - [Step 1 — Generate the simulation data (C++ engine)](#step-1--generate-the-simulation-data-c-engine)
  - [Step 2 — Launch the web terminal](#step-2--launch-the-web-terminal)
- [Output File Reference](#output-file-reference)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## Overview

Rather than working from aggregated OHLC bars, this project reconstructs a limit order book from real, order-level historical data: every new order and every cancellation is fed through an actual matching engine, so the book state at any point in time is *derived*, not approximated.

The included dataset is a real trading day of AAPL order flow (June 21, 2012) in [LOBSTER](https://lobsterdata.com/) format. A thin web terminal is included for visualizing a replay, but the core of the project — and the focus of this document — is the C++ engine that maintains the book and matches orders against it.

## Architecture

```
Order_book_file/*.csv                (raw LOBSTER message data)
        │
        ▼
src/MarketEventSimulator.cpp         (parses messages, drives the book)
        │
        ▼
include/OrderBook.h + MatchingEngine.h   (price-time-priority book, order matching)
        │
        ▼
webSimulator/OrderBook.json          (one warm-up book snapshot, top 20 levels)
webSimulator/Simulation.json         (1,000 sequential book snapshots to replay)
        │
        ▼
webSimulator/index.html + app.js     (fetches the JSON, renders the terminal, replays it)
```

Everything above the JSON files is the engine; everything below is presentation. The engine has no knowledge of the web terminal at all — it just writes JSON.

## The Order Book Engine

### Data Structures

The book (`include/OrderBook.h`) is two ordered maps of FIFO queues:

```cpp
std::map<double, std::queue<Order>, std::greater<double>> bid;  // descending: bid.begin() is the best (highest) bid
std::map<double, std::queue<Order>>                       ask;  // ascending:  ask.begin() is the best (lowest) ask
```

This is the standard shape for a price-time-priority book:

- The **map** orders price levels so the best price on each side is always `.begin()` — an O(log L) lookup/insert/erase per price level, where L is the number of distinct price levels currently resting.
- Each price level is a **queue**, so orders at the same price are matched in strict arrival order (FIFO) — `push()` on arrival, `front()`/`pop()` on execution, which is what actually enforces *time* priority within a price level.

A resting `Order` (`include/Order.h`) is a plain struct — `id`, `price`, `quantity`, `side` (`BUY`/`SELL`), `type` (`LIMIT`/`MARKET`) — with no timestamp field of its own; arrival order is implicit in queue position, not stored explicitly.

### Adding an Order

`OrderBook::addOrder` (`src/OrderBook.cpp`) is the entry point for a new order, and it branches on whether the order is immediately marketable:

- **Limit order, non-crossing** (e.g. a buy priced below the best ask): appended to the back of the queue at its price level — creating a new level in the map if none exists yet at that price, or pushing onto the existing queue if one does. This is the only path that actually rests new liquidity on the book.
- **Limit order, crossing** (its price reaches into the opposite book — a buy priced at or above the best ask, or a sell priced at or below the best bid): handed to the `MatchingEngine` to execute against the opposite side instead of resting.
- **Market order**: always handed to the `MatchingEngine` unconditionally, since a market order has no price to check against.

### The Matching Algorithm

`MatchingEngine::MatchOrder` (`include/MatchingEngine.h`) is a templated method — templated on the two map comparators (`std::greater<double>` for bid, the default `std::less<double>` for ask) — so the same function body handles both a buy walking the ask side and a sell walking the bid side. On each iteration it:

1. Erases and skips any price level whose queue has been emptied out.
2. For a **limit** order, checks whether it should stop matching (see below).
3. Trades against the order at the front of the best remaining price level — a full fill pops that order off the queue, a partial fill decrements its quantity in place and stops.

```cpp
while (remaining != 0 && !type.empty()){
    if (type.begin()->second.empty()) { type.erase(type.begin()); continue; }
    if (order.type == OrderType::LIMIT){
        if (side == Side::BUY  && opp_type.begin()->first > price_) break;
        if (side == Side::SELL && opp_type.begin()->first < price_) break;
    }
    // ... match against type.begin(), the best resting price on the opposite side ...
}
```

`type` is the side actually being executed against (asks, for an incoming buy); `opp_type` is the *same* side as the incoming order (bids, for an incoming buy) — passed in only so a partial fill could theoretically be re-inserted as a new resting order afterward.

### Verified Matching Behaviors

Reading the loop above raises a question: the natural "stop matching" condition for a limit order is *"the best remaining opposite-side price has moved past my own limit price"* — which means checking `type.begin()->first` (the ask book being consumed) against `price_`. Instead, the code checks `opp_type.begin()->first` — the incoming order's *own* side of the book. I didn't want to just flag this as suspicious from a read-through, so I built two minimal, isolated reproductions directly against the compiled engine (a bare `OrderBook` + a handful of `addOrder` calls, no CSV, no web terminal) to see what actually happens:

**1. A limit order can trade through its own limit price.**

Resting asks at `100.00`, `100.05`, `100.10` (50 shares each), plus a resting bid at `99.50` so the same-side book isn't empty. Send a `BUY LIMIT` for 120 shares at a limit of `100.05`:

| Expected | Actual (reproduced) |
|---|---|
| Fills 50 @ 100.00 + 50 @ 100.05 = 100 shares; rests the remaining 20 (100.10 is above its limit) | Fills 50 @ 100.00 + 50 @ 100.05 + **20 @ 100.10** — 120 shares fully filled, 20 of them at a price above the order's own limit |

The symmetric case (a `SELL LIMIT` order trading through a bid price *below* its limit) reproduces identically, since the SELL branch has the same `opp_type`-instead-of-`type` pattern.

**2. An unfilled remainder from a crossing limit order is silently dropped, not rested.**

A single resting ask for 50 shares at `100.00`. Send a `BUY LIMIT` for 500 shares at `100.00`:

| Expected | Actual (reproduced) |
|---|---|
| Fills 50 shares, rests the remaining 450 as a new bid at 100.00 | Fills 50 shares; **the other 450 shares simply vanish** — no bid is created |

The root cause is visible directly in the code: `MatchOrder` takes `Order& order` by reference but only ever mutates a local `remaining` counter — it never writes the leftover quantity back into `order.quantity`, and `addOrder`'s crossing branch never checks for or re-inserts a remainder afterward. The two commented-out lines inside the loop —

```cpp
//Order new_order = Order(id,OrderType::LIMIT,Side::BUY,price_,remaining);
//ob.addOrder(new_order);
```

— show this was the intended fix and was scaffolded in, but never wired up.

Neither of these requires an adversarial setup — both reproduce from a handful of plain `addOrder` calls, and both are one-line-per-branch fixes (compare against `type` instead of `opp_type`; construct and re-add a resting order from any nonzero `remaining` once the loop exits). They're listed first in the [Roadmap](#roadmap) for that reason.

### Cancelling an Order

`OrderBook::cancelOrder` is a two-step process: `returnOrderBasedOnId` does a **linear scan** through every queue on both sides of the book to find the order and determine which side to remove it from, and `remove<MapType>` then rebuilds that price level's queue, filtering out the cancelled ID while preserving the relative order of everything else — which is what keeps time priority intact for the orders that remain. See [Performance Characteristics](#performance-characteristics) for what this costs at scale.

### Market Event Replay

`src/MarketEventSimulator.cpp` drives the book from the LOBSTER CSV rather than from synthetic orders:

- Only **event type `1` (new order)** and **event type `3` (full cancellation)** rows are fed into the book; partial cancellations (`2`) and LOBSTER's own execution messages (`4`–`7`) are skipped on read. Every order constructed from the file is a `LIMIT` order — market orders never appear in historical replay, only in code that calls `addOrder` directly.
- Cancellations for order IDs the engine never saw (e.g. because replay starts partway through the trading day) throw inside `OrderBook::cancelOrder`; the replay loop catches and silently discards these, rather than aborting the whole run.
- The first **8,000** qualifying rows are replayed purely to build up a realistic resting book (a "warm-up" period) — that state is captured once, as `webSimulator/OrderBook.json`. Rows **8,001–9,000** are then replayed one at a time, with a full book snapshot written after each, forming the 1,000-event sequence in `webSimulator/Simulation.json`.
- Each snapshot serializes only the **top 20 price levels per side** (`MAX_LEVELS` in `parseOrderBook`) — since the web terminal only ever displays 14, serializing the full depth of the book on every one of 1,000 snapshots was pure wasted work.

### Performance Characteristics

| Operation | Complexity | Notes |
|---|---|---|
| Add order, non-crossing | O(log L) | L = number of distinct resting price levels on that side |
| Add order, crossing (match) | O(log L + m) | m = number of resting orders consumed across the levels walked |
| Cancel order | **O(N)** | `returnOrderBasedOnId` linearly scans every resting order on both sides; N = total resting orders |
| Snapshot serialization | O(20) per snapshot | Bounded by `MAX_LEVELS`, independent of book depth |

Cancellation is the standout cost here: at real exchange order-cancellation rates, an O(N) scan on every cancel would dominate runtime on a large book. An index from order ID → (side, price level) would take this to O(log L) and is the most impactful single optimization available in the current design (see [Roadmap](#roadmap)).

## The Web Terminal

`webSimulator/` is a static HTML/CSS/JS front end that fetches the engine's JSON output and replays it visually — a live 14-level depth ladder, best bid/ask, mid-price, spread, top-5 VWAP, order book imbalance, a moving mid-price chart, and playback controls (step/play/pause/speed/reset). It also has a client-side "Add Order" form for dropping a hypothetical order into the visible book. None of the terminal's logic feeds back into the C++ engine — it's a pure read-only replay viewer, described further in [Running the Simulator](#running-the-simulator) and [Known Limitations](#known-limitations).

## Repository Structure

```
.
├── include/
│   ├── Order.h              # Order struct, Side and OrderType enums
│   ├── Trade.h               # Trade struct
│   ├── MarketEvents.h        # EventType enum and MarketEvent struct
│   ├── OrderBook.h           # Order book interface
│   ├── MatchingEngine.h      # Templated matching logic (header-only)
│   └── snapshot.h            # Reserved for a future point-in-time snapshot struct (currently unused)
├── src/
│   ├── Order.cpp              # Not currently part of the linked build (see Known Limitations)
│   ├── Trade.cpp               # Not currently part of the linked build (see Known Limitations)
│   ├── OrderBook.cpp            # Book maintenance, order insertion/cancellation, defines the global `ob`
│   ├── MatchingEngine.cpp        # Empty translation unit — matching logic lives in the header
│   ├── MarketEventSimulator.cpp   # main() — CSV parsing, replay driver, JSON snapshot writer
│   └── LOB_Metrics.cpp             # Reserved for engine-side metrics; currently commented out
├── external/
│   └── nlohmann/json.hpp     # Single-header JSON library (vendored)
├── Order_book_file/
│   └── AAPL_2012-06-21_34200000_57600000_message_1.csv   # Full-day LOBSTER message data
├── webSimulator/
│   ├── index.html            # Terminal layout
│   ├── style.css              # Terminal styling (dark trading-terminal theme)
│   ├── app.js                  # Fetches JSON, renders the book/chart, drives replay + order entry
│   ├── OrderBook.json           # Warm-up book snapshot (generated — not currently read by app.js)
│   └── Simulation.json           # Sequential book snapshots to replay (generated)
└── a.exe                     # Prebuilt Windows binary (see Building From Source)
```

## Data Format

The simulator reads [LOBSTER](https://lobsterdata.com/)-style message files, where each CSV row is a single order book event:

| Column | Field | Description |
|---|---|---|
| 1 | Timestamp | Seconds after midnight, with nanosecond precision |
| 2 | Event Type | `1` = new limit order, `2` = partial cancellation, `3` = full cancellation/deletion, `4`–`7` = executions/other LOBSTER event types |
| 3 | Order ID | Unique order identifier |
| 4 | Size | Order quantity (shares) |
| 5 | Price | Price in tenths of a cent (divided by 10,000 to get dollars) |
| 6 | Direction | `1` = buy, `-1` = sell |

The included file contains AAPL order flow for June 21, 2012 (09:30–16:00 trading session, ~118,000 rows). As covered in [Market Event Replay](#market-event-replay) above, only event types `1` and `3` currently drive the book.

## Requirements

- A **C++20** compiler. The struct types in this project (`Order`, `Trade`, `MarketEvent`) are aggregates constructed with `Type name(a, b, c)` call syntax, which requires C++20's parenthesized aggregate initialization (P0960) — **the project will not compile under `-std=c++17`**.
  - Verified with GCC 13.3 (`g++ -std=c++20`) on Linux.
  - The project's own VS Code config (`.vscode/c_cpp_properties.json`) targets `gnu++20` via MSYS2/MinGW-w64 on Windows.
- Python 3 (or any static file server) to serve the web terminal — see [Step 2](#step-2--launch-the-web-terminal) for why this is necessary.
- No external C++ package manager is required — [nlohmann/json](https://github.com/nlohmann/json) is vendored under `external/nlohmann/`.

## Building From Source

The repository ships a prebuilt `a.exe`, but that is a **Windows PE32+ binary** built by the author via MinGW — it will not run on Linux or macOS. Building from source is quick and recommended on any platform:

```bash
g++ -std=c++20 -O2 -Iinclude -Iexternal src/*.cpp -o simulator
```

This compiles all six `.cpp` files in `src/` against the headers in `include/` and the vendored JSON library in `external/`, producing a `simulator` executable in the repository root. (`MatchingEngine.cpp` contributes no symbols — the matching logic is header-only — and `Order.cpp`/`Trade.cpp` currently declare local, unused duplicate types rather than being part of the active data model; they still compile cleanly and are harmless to include.)

## Running the Simulator

Running the project is two distinct steps, because the C++ engine and the web terminal are separate programs connected only by the JSON files in `webSimulator/`.

### Step 1 — Generate the simulation data (C++ engine)

Run the compiled binary **from the repository root**, since it reads and writes paths relative to the current working directory:

```bash
./simulator
```

This replays the CSV as described in [Market Event Replay](#market-event-replay) — the first 8,000 qualifying rows as warm-up (written to `webSimulator/OrderBook.json`), then rows 8,001–9,000 as the 1,000-snapshot replay sequence (written to `webSimulator/Simulation.json`). The run is fast (well under a second) and deterministic — re-running it regenerates byte-identical output. The repository already includes pre-generated JSON, so **Step 2 works out of the box even if you skip this step**; re-run it if you change the input data, the replay window (`SIMULATION_END` in `src/MarketEventSimulator.cpp`), or the engine logic.

### Step 2 — Launch the web terminal

The web terminal fetches `Simulation.json` over `fetch()`, which browsers block against the `file://` protocol — so it must be served over HTTP, not opened directly by double-clicking `index.html`.

From the `webSimulator/` directory:

```bash
cd webSimulator
python3 -m http.server 8000
```

Then open **`http://localhost:8000`** in a browser. Any other static file server (`npx serve`, VS Code's Live Server extension, `php -S`, etc.) works equally well — the only requirement is that it's serving the `webSimulator/` directory itself, since `index.html`, `app.js`, `style.css`, and `Simulation.json` are all fetched via relative paths.

Once loaded: **▶ Play/Pause** and **◀ Previous / Next ▶** step through the replay, **Reset** reloads it from the top, the **speed slider** runs 0.25×–10×, and **+ Add Order** drops a hypothetical limit order into the visible book (validated so it can't be placed crossing the spread).

## Output File Reference

**`webSimulator/OrderBook.json`** — a flat array of up to 20 `{ bid_price, bid: {size, orders}, ask_price, ask: {size, orders} }` rows, the book state at the end of the warm-up period. Currently generated but not read by `app.js`.

**`webSimulator/Simulation.json`** — an array of 1,000 objects:

```json
{
  "eventId": 8001,
  "timestamp": 34215.918273451,
  "orderBook": [
    { "bid_price": 586.28, "bid": {"size": 200, "orders": 2}, "ask_price": 586.30, "ask": {"size": 3, "orders": 1} }
  ]
}
```

## Known Limitations

- **The matching engine's limit-price guard reads from the wrong map** (`opp_type` instead of `type`), letting crossing limit orders trade through their own limit price — see [Verified Matching Behaviors](#verified-matching-behaviors) for a reproduced example.
- **Unfilled remainders of a crossing limit order are silently dropped rather than rested** — also reproduced above; the fix was scaffolded in as commented-out code but never wired up.
- **Order cancellation is O(N)** — `returnOrderBasedOnId` linearly scans every resting order on both sides of the book; see [Performance Characteristics](#performance-characteristics).
- **`src/LOB_Metrics.cpp` and `include/snapshot.h` are currently commented out.** Every market metric shown in the terminal (mid-price, spread, VWAP, imbalance) is computed client-side in `app.js` from the raw depth snapshots, not by the engine.
- **`src/Order.cpp` and `src/Trade.cpp` currently declare local, unused duplicate types** rather than implementations of `include/Order.h` / `include/Trade.h` — they compile but contribute nothing to the running program.
- **The replay window is a fixed 1,000-event slice** (rows 8,001–9,000 of the trading day), not the full session.
- **The "Add Order" feature in the web terminal is a client-side visual simulation only** — it never reaches the C++ engine.
- **No automated tests** currently cover the matching engine or book invariants — the reproductions above were done ad hoc, not via a test suite.
- **No license file** is currently included in the repository (see [License](#license)).

## Roadmap

- Fix the limit-price guard in `MatchingEngine::MatchOrder` to check `type.begin()->first` instead of `opp_type.begin()->first` on both the BUY and SELL branches
- Rest the unfilled remainder of a partially-filled crossing limit order instead of discarding it (wire up the commented-out re-insertion logic)
- Replace `returnOrderBasedOnId`'s linear scan with an order-ID index (`unordered_map<long, {side, price}>`) to bring cancellation down to O(log L)
- Add a unit test suite around the matching engine specifically — price-time priority under ties, partial fills, empty-book edge cases, and regression tests for the two issues above
- Compute microstructure metrics on the C++ side (reviving `LOB_Metrics.cpp`) rather than in the browser
- Extend the replay window to the full trading session, with pagination/streaming rather than one large JSON file
- Add a CMake build so the project doesn't depend on a hand-written `g++` invocation

## License

No license has been specified yet. All rights reserved by the author until a license is added.

## Acknowledgements

- Order-level market data format from [LOBSTER](https://lobsterdata.com/), Humboldt-Universität zu Berlin.
- JSON serialization via [nlohmann/json](https://github.com/nlohmann/json).
