# LOB Market Microstructure Simulator

A C++ limit order book (LOB) and matching engine that replays real, order-level exchange data and streams the reconstructed book state into a browser-based trading terminal for visual replay.

The project has two halves that work together:

1. **A C++ simulation engine** that parses [LOBSTER](https://lobsterdata.com/)-format historical message data, replays it through a price-time-priority order book, and serializes a window of book snapshots to JSON.
2. **A web terminal** (`webSimulator/`) — a static HTML/CSS/JS front end styled like an exchange terminal — that reads those JSON snapshots and replays them: live depth-of-book, best bid/ask, spread, VWAP, book imbalance, and a moving mid-price chart.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Repository Structure](#repository-structure)
- [Data Format](#data-format)
- [Requirements](#requirements)
- [Building From Source](#building-from-source)
- [Running the Simulator](#running-the-simulator)
  - [Step 1 — Generate the simulation data (C++ engine)](#step-1--generate-the-simulation-data-c-engine)
  - [Step 2 — Launch the web terminal](#step-2--launch-the-web-terminal)
- [Using the Web Terminal](#using-the-web-terminal)
- [Output File Reference](#output-file-reference)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## Overview

Rather than working from aggregated OHLC bars, this project reconstructs a limit order book **message by message** from real historical order flow: every new order and every cancellation is fed through an actual matching engine, so the resulting book state at any point in time reflects genuine price-time priority — not an approximation of it.

The included dataset is a real trading day of AAPL order flow (June 21, 2012, in LOBSTER format), and the engine ships with a working end-to-end pipeline: **CSV → order book → JSON snapshots → browser replay**.

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

The C++ engine and the web terminal are **decoupled by the JSON files** — the engine only needs to be re-run when you want to regenerate or change the simulated data; the web terminal simply reads whatever `Simulation.json` currently contains.

## Features

**C++ engine**
- **Limit Order Book** — bid/ask sides implemented as price-ordered maps (`std::map<double, std::queue<Order>>`) of FIFO order queues, preserving price-time priority.
- **Matching Engine** — walks the opposite side of the book against an incoming order, generating trades until the order is filled or no crossing liquidity remains; unfilled limit quantity rests on the book.
- **Order Management** — new order insertion and cancellation by order ID.
- **LOBSTER Message Parsing** — reads real timestamp/event/order data and replays it into the book event-by-event.
- **JSON Snapshotting** — serializes the top 20 price levels per side (via [nlohmann/json](https://github.com/nlohmann/json)) for consumption by the web terminal.

**Web terminal** (`webSimulator/`)
- **Level II depth-of-book** — live bid/ask ladder, 14 levels per side, with visual flash highlighting on size changes.
- **Market metrics** — best bid, best ask, mid-price, spread, top-5 VWAP, and order book imbalance (with a bid/ask imbalance bar).
- **Mid-price chart** — a canvas line chart that plots the mid-price for every event replayed so far, colored green/red for rising/falling, with high/low/change readouts.
- **Replay controls** — step forward/back one event at a time, play/pause continuous replay, adjustable replay speed (0.25×–10×), and reset.
- **Manual order entry** — an "Add Order" form lets you place a hypothetical buy/sell limit order directly into the visible book to see how it would sit in the depth ladder (client-side only — see [Known Limitations](#known-limitations)).

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
│   ├── Order.cpp              # Not currently part of the linked build (see note below)
│   ├── Trade.cpp               # Not currently part of the linked build (see note below)
│   ├── OrderBook.cpp            # Book maintenance, order insertion/cancellation, defines the global `ob`
│   ├── MatchingEngine.cpp        # Empty translation unit — matching logic lives in the header
│   ├── MarketEventSimulator.cpp   # main() — CSV parsing, replay driver, JSON snapshot writer
│   └── LOB_Metrics.cpp             # Reserved for engine-side metrics; currently commented out (see note below)
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

The included file contains AAPL order flow for June 21, 2012 (09:30–16:00 trading session, ~118,000 rows). The engine currently only acts on **event types `1` (new order) and `3` (full cancellation)** — partial cancellations and execution rows are skipped on read, so the reconstructed book reflects order arrivals and cancellations rather than replaying LOBSTER's own execution messages (trades are instead whatever the engine's own matching logic produces when a new order crosses the book).

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

This compiles all six `.cpp` files in `src/` against the headers in `include/` and the vendored JSON library in `external/`, and produces a `simulator` executable in the repository root. (`MatchingEngine.cpp` contributes no symbols — the matching logic is header-only — and `Order.cpp`/`Trade.cpp` currently declare local, unused duplicate types rather than being part of the active data model; they still compile cleanly and are harmless to include.)

## Running the Simulator

Running the project has two distinct steps, because the C++ engine and the web terminal are two separate programs connected only by the JSON files in `webSimulator/`.

### Step 1 — Generate the simulation data (C++ engine)

The compiled binary must be run **from the repository root**, since it reads and writes paths relative to the current working directory:

```bash
./simulator
```

What this does:
- Reads `Order_book_file/AAPL_2012-06-21_34200000_57600000_message_1.csv` from the start of the trading day.
- Replays the first 8,000 qualifying messages into the order book as a "warm-up" period (so the book has realistic depth before visualization begins), then writes that book state to `webSimulator/OrderBook.json`.
- Continues replaying messages 8,001–9,000, writing a book snapshot after each one, and saves the resulting 1,000-event sequence to `webSimulator/Simulation.json`.

The run is fast (well under a second) and deterministic — re-running it regenerates byte-identical output. You only need to re-run this step if you change the input data, the replay window (`SIMULATION_END` in `src/MarketEventSimulator.cpp`), or the engine logic itself. The repository already includes a pre-generated `Simulation.json` / `OrderBook.json`, so **Step 2 works out of the box even if you skip Step 1.**

### Step 2 — Launch the web terminal

The web terminal fetches `Simulation.json` over `fetch()`, which browsers block against the `file://` protocol — so it must be served over HTTP, not opened directly by double-clicking `index.html`.

From the `webSimulator/` directory:

```bash
cd webSimulator
python3 -m http.server 8000
```

Then open **`http://localhost:8000`** in a browser. Any other static file server (`npx serve`, VS Code's Live Server extension, `php -S`, etc.) works equally well — the only requirement is that it's serving the `webSimulator/` directory itself, since `index.html`, `app.js`, `style.css`, and `Simulation.json` are all fetched via relative paths.

## Using the Web Terminal

Once loaded, the terminal opens paused on the first snapshot in `Simulation.json`:

| Control | Effect |
|---|---|
| **▶ Play / Pause** | Continuously steps through events at the current speed |
| **◀ Previous / Next Event ▶** | Steps one event at a time |
| **Reset** | Reloads `Simulation.json` from scratch and returns to event 1 |
| **Simulation speed slider** | 0.25×–10× replay speed |
| **+ Add Order** | Opens a form to place a hypothetical BUY/SELL limit order into the visible book (price/size validated against the current best bid/ask so it can't be placed crossing the spread) |

The order book panel shows 14 price levels per side with live depth bars; the mid-price chart panel on the right plots every mid-price seen so far in the replay, colored green when trending up and red when trending down.

## Output File Reference

**`webSimulator/OrderBook.json`** — a flat array of up to 20 `{ bid_price, bid: {size, orders}, ask_price, ask: {size, orders} }` rows, representing the book state at the end of the warm-up period. Currently generated but not read by `app.js` (reserved for future use, e.g. an initial-state view).

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

`app.js` reads this array in order, updating the depth ladder, market metrics, and mid-price chart from each `orderBook` snapshot as it steps or plays through the replay.

## Roadmap

- Compute microstructure metrics on the C++ side (reviving `LOB_Metrics.cpp`) rather than in the browser
- Extend the replay window to the full trading session, with pagination/streaming rather than one large JSON file
- Reconcile `Order.cpp`/`Trade.cpp` with the canonical types in `include/`, or remove them
- Add a CMake build so the project doesn't depend on a hand-written `g++` invocation
- Add unit tests around matching logic and book invariants (empty-book edge cases, partial fills, price-time priority under ties)
- Extend metrics (queue position, realized volatility from the mid-price series, volume-weighted execution quality)

## License

No license has been specified yet. All rights reserved by the author until a license is added.

## Acknowledgements

- Order-level market data format from [LOBSTER](https://lobsterdata.com/), Humboldt-Universität zu Berlin.
- JSON serialization via [nlohmann/json](https://github.com/nlohmann/json).
