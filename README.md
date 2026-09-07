# LOB Market Microstructure Simulator

A C++ implementation of a limit order book (LOB) and matching engine, built to reconstruct and study market microstructure dynamics from real historical exchange data.

## Overview

This project models the core mechanics of an electronic exchange: a price-time priority order book, an engine that matches incoming limit and market orders against resting liquidity, and a set of microstructure metrics (spread, mid-price, depth, order book imbalance) computed directly from book state. It replays real order-level data (LOBSTER-format AAPL messages) to reconstruct book dynamics tick by tick, rather than relying on aggregated bar data.

The goal is to provide a foundation for studying order flow, liquidity, and price formation, and eventually for testing simple trading logic against realistic book dynamics.

## Features

- **Limit Order Book** — separate bid/ask sides implemented as price-ordered maps of FIFO order queues, preserving price-time priority.
- **Matching Engine** — matches new limit and market orders against the opposite side of the book, generating trades and resting any unfilled quantity.
- **Order Management** — support for new order insertion and order cancellation by ID.
- **Market Event Simulation** — reads and parses LOBSTER-style message data (timestamp, event type, order ID, size, price, direction) to drive the book from historical exchange data.
- **Microstructure Metrics** — best bid/ask, mid-price, spread, bid/ask volume, total depth, and order book imbalance.
- **Book Snapshots** — a `LOBSnapshot` structure for capturing point-in-time book state (timestamp, best bid/ask, mid-price, spread, volumes, imbalance).

## Repository Structure

```
.
├── include/
│   ├── Order.h            # Order struct, Side and OrderType enums
│   ├── Trade.h             # Trade struct
│   ├── MarketEvents.h      # Market event types and event struct
│   ├── OrderBook.h         # Order book interface
│   ├── MatchingEngine.h    # Matching engine interface
│   └── snapshot.h          # Point-in-time book snapshot struct
├── src/
│   ├── Order.cpp
│   ├── Trade.cpp
│   ├── OrderBook.cpp           # Book maintenance, order insertion/cancellation
│   ├── MatchingEngine.cpp      # Order matching / trade generation logic
│   ├── MarketEventSimulator.cpp # LOBSTER message file parsing and replay
│   └── LOB_Metrics.cpp          # Spread, mid-price, depth, imbalance calculations
└── Order_book_file/
    └── AAPL_2012-06-21_*_message_1.csv   # Sample LOBSTER message data
```

## Data Format

The simulator is built around [LOBSTER](https://lobsterdata.com/)-style message files, where each row of the CSV represents a single order book event:

| Column | Field | Description |
|---|---|---|
| 1 | Timestamp | Seconds after midnight, with nanosecond precision |
| 2 | Event Type | `1` = new limit order, `2` = partial cancellation, `3` = full cancellation/deletion |
| 3 | Order ID | Unique order identifier |
| 4 | Size | Order quantity (shares) |
| 5 | Price | Price in tenths of a cent (divided by 10,000 to get dollars) |
| 6 | Direction | `1` = buy, `-1` = sell |

The included sample file contains AAPL order flow for June 21, 2012, covering the 09:30–16:00 trading session.

## Core Design

- **`Order`** — a single order with ID, price, quantity, side (`BUY`/`SELL`), and type (`LIMIT`/`MARKET`).
- **`OrderBook`** — maintains bids (sorted descending by price) and asks (sorted ascending by price) as `std::map<double, std::queue<Order>>`, so each price level preserves FIFO time priority.
- **`MatchingEngine`** — walks the resting side of the book against an incoming order, generating `Trade` records until the order is filled or no more crossing liquidity remains; any unfilled limit quantity is added to the book.
- **`metrics`** — derives standard LOB analytics (best bid/ask, mid-price, spread, bid/ask volume, depth, imbalance) from the current book state.

## Project Status

This project is under active development. Current focus areas:

- [x] Core order book data structures (bid/ask maps, FIFO queues)
- [x] Order insertion and matching logic
- [x] Order cancellation
- [x] LOBSTER message file parsing
- [x] Basic microstructure metrics
- [ ] Order modification (partial amends)
- [ ] Build system (CMake/Makefile) and a runnable entry point
- [ ] Automated tests
- [ ] End-to-end replay driver tying the event simulator to the order book and metrics output

Because there is no build system or `main` entry point yet, the components are currently best explored by including the relevant headers/sources directly into your own driver code.

## Roadmap

- Wire up a full replay pipeline: read LOBSTER events → feed the order book → emit snapshots/metrics over time
- Add CMake-based build configuration
- Add unit tests around matching logic and book invariants
- Extend metrics (e.g. volume-weighted average price, queue position, realized volatility from mid-price series)

## Contributing

This is a research/learning project. Issues and pull requests that improve correctness, add tests, or extend functionality are welcome.

## License

No license has been specified yet. All rights reserved by the author until a license is added.
