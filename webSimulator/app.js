const state = {
    levels: 14,
    playing: false,
    timer: null,
    speed: 5,
    eventId: 1,
    lastPrice: 100.02,
    mid: 100.025,
    bestBid: 100.02,
    bestAsk: 100.03,
    bids: [],
    asks: [],
    trades: [],
    prices: [],
    eventType: "LIMIT_ADD",
    simSeconds: 34201.244,
    buyVolume: 12840,
    sellVolume: 10971
};


class MockMarketAdapter {

    reset() {

        const b = 100.02;
        const a = 100.03;

        state.bids = Array.from(
            { length: 20 },
            (_, i) => ({
                price: +(b - i * 0.01).toFixed(2),
                volume: Math.floor(130 + Math.random() * 650),
                orders: Math.floor(2 + Math.random() * 14)
            })
        );

        state.asks = Array.from(
            { length: 20 },
            (_, i) => ({
                price: +(a + i * 0.01).toFixed(2),
                volume: Math.floor(130 + Math.random() * 650),
                orders: Math.floor(2 + Math.random() * 14)
            })
        );

        state.bestBid = state.bids[0].price;
        state.bestAsk = state.asks[0].price;

        state.mid = +(
            (state.bestBid + state.bestAsk) / 2
        ).toFixed(4);

        state.lastPrice = state.bestBid;

        state.trades = Array.from(
            { length: 9 },
            () => this.randomTrade()
        );

        state.prices = Array.from(
            { length: 80 },
            (_, i) =>
                +(
                    100 +
                    Math.sin(i / 7) * 0.025 +
                    (Math.random() - 0.5) * 0.022
                ).toFixed(4)
        );
    }


    randomTrade() {

        const buy = Math.random() > 0.48;

        const p = buy
            ? state.bestAsk
            : state.bestBid;

        return {
            time: formatTime(state.simSeconds),
            price: +p.toFixed(2),
            size: Math.floor(10 + Math.random() * 220),
            side: buy ? "BUY" : "SELL"
        };
    }


    next() {

        const side = Math.random() > 0.5
            ? "bid"
            : "ask";

        const book = side === "bid"
            ? state.bids
            : state.asks;

        const idx = Math.floor(
            Math.random() * Math.min(7, book.length)
        );

        const roll = Math.random();

        let type;
        let message;


        if (roll < 0.52) {

            const delta = Math.floor(
                20 + Math.random() * 140
            );

            book[idx].volume += delta;
            book[idx].orders += 1;

            type = "LIMIT_ADD";

            message =
                `${side === "bid" ? "BUY" : "SELL"} limit added: ` +
                `${delta} @ ${book[idx].price.toFixed(2)}`;
        }


        else if (
            roll < 0.76 &&
            book[idx].volume > 40
        ) {

            const delta = Math.min(
                book[idx].volume - 1,
                Math.floor(10 + Math.random() * 100)
            );

            book[idx].volume -= delta;

            type = "CANCEL";

            message =
                `${side === "bid" ? "BUY" : "SELL"} cancelled: ` +
                `${delta} @ ${book[idx].price.toFixed(2)}`;
        }


        else {

            const trade = this.randomTrade();

            state.trades.unshift(trade);

            state.trades = state.trades.slice(0, 9);

            const target =
                trade.side === "BUY"
                    ? state.asks[0]
                    : state.bids[0];

            target.volume = Math.max(
                0,
                target.volume - trade.size
            );

            if (trade.side === "BUY") {
                state.buyVolume += trade.size;
            } else {
                state.sellVolume += trade.size;
            }

            type = "TRADE";

            message =
                `${trade.side} market trade: ` +
                `${trade.size} @ ${trade.price.toFixed(2)}`;
        }


        if (Math.random() < 0.13) {

            const shift = Math.random() > 0.5
                ? 0.01
                : -0.01;

            state.bids.forEach(x => {
                x.price = +(
                    x.price + shift
                ).toFixed(2);
            });

            state.asks.forEach(x => {
                x.price = +(
                    x.price + shift
                ).toFixed(2);
            });

            state.bestBid = state.bids[0].price;
            state.bestAsk = state.asks[0].price;
        }


        state.mid = +(
            (state.bestBid + state.bestAsk) / 2
        ).toFixed(4);

        state.lastPrice =
            state.trades[0]?.price ??
            state.bestBid;

        state.prices.push(state.mid);

        state.prices =
            state.prices.slice(-110);

        state.eventType = type;

        return {
            type,
            message
        };
    }
}


const adapter = new MockMarketAdapter();

const $ = id => document.getElementById(id);


function pad(n, d = 2) {

    return String(n).padStart(d, "0");
}


function formatTime(sec) {

    const h = Math.floor(sec / 3600);

    const m = Math.floor(
        (sec % 3600) / 60
    );

    const s = sec % 60;

    const si = Math.floor(s);

    const ms = Math.floor(
        (s - si) * 1000
    );

    return `${pad(h)}:${pad(m)}:${pad(si)}.${pad(ms, 3)}`;
}


function fmt(n, d = 2) {

    return Number(n).toFixed(d);
}


function renderBook() {

    const bids =
        state.bids.slice(
            0,
            state.levels
        );

    const asks =
        state.asks.slice(
            0,
            state.levels
        );

    const maxVol = Math.max(
        ...bids.map(x => x.volume),
        ...asks.map(x => x.volume),
        1
    );


    $("bidBook").innerHTML = "";
    $("askBook").innerHTML = "";
    $("priceBook").innerHTML = "";


    for (
        let i = 0;
        i < Math.max(bids.length, asks.length);
        i++
    ) {

        if (i < bids.length) {

            $("bidBook").appendChild(
                bookRow(
                    bids[i],
                    maxVol,
                    "bid"
                )
            );
        }


        if (i < asks.length) {

            $("askBook").appendChild(
                bookRow(
                    asks[i],
                    maxVol,
                    "ask"
                )
            );
        }


        const p =
            i < bids.length
                ? bids[i].price
                : (asks[i]?.price ?? state.mid);


        const r = document.createElement("div");

        r.className =
            "price-row" +
            (i === 0 ? " inside" : "");

        r.textContent = fmt(p);

        $("priceBook").appendChild(r);
    }


    const mid =
        document.createElement("div");

    mid.className = "price-row mid";

    mid.innerHTML =
        `${fmt(state.mid, 4)} ` +
        `<span class="mid-price-tag">MID</span>`;


    const rows =
        $("priceBook").children;


    if (rows[1]) {

        $("priceBook").insertBefore(
            mid,
            rows[1]
        );

    } else {

        $("priceBook").appendChild(mid);
    }


    const bid5 =
        bids
            .slice(0, 5)
            .reduce(
                (a, x) => a + x.volume,
                0
            );


    const ask5 =
        asks
            .slice(0, 5)
            .reduce(
                (a, x) => a + x.volume,
                0
            );


    const total = bid5 + ask5;

    const imb =
        total
            ? ((bid5 - ask5) / total) * 100
            : 0;


    const spread =
        state.bestAsk - state.bestBid;


    $("imbalance").textContent =
        `${imb >= 0 ? "+" : ""}${imb.toFixed(1)}%`;

    $("imbalance").style.color =
        imb >= 0
            ? "var(--green)"
            : "var(--red)";


    $("visibleDepth").textContent =
        (bid5 + ask5).toLocaleString();


    $("vwap").textContent =
        fmt(
            (
                state.bestBid * bid5 +
                state.bestAsk * ask5
            ) / (total || 1),
            4
        );


    $("bestBid").textContent =
        fmt(state.bestBid, 4);

    $("bestAsk").textContent =
        fmt(state.bestAsk, 4);

    $("midPrice").textContent =
        fmt(state.mid, 4);

    $("spread").textContent =
        fmt(spread, 4);

    $("lastTrade").textContent =
        fmt(state.lastPrice, 4);

    $("bookMid").textContent =
        fmt(state.mid, 4);

    $("bidDepth").textContent =
        bid5.toLocaleString();

    $("askDepth").textContent =
        ask5.toLocaleString();
}


function bookRow(x, max, side) {

    const d =
        document.createElement("div");

    d.className = "book-row";


    const bar =
        document.createElement("div");

    bar.className = "bar";

    bar.style.width =
        `${Math.max(
            8,
            (x.volume / max) * 100
        )}%`;


    const vol =
        document.createElement("span");

    vol.className = "volume";

    vol.textContent =
        x.volume.toLocaleString();


    const count =
        document.createElement("span");

    count.className = "count";

    count.textContent =
        x.orders;


    if (side === "bid") {

        d.append(
            vol,
            count
        );

    } else {

        d.append(
            count,
            vol
        );
    }


    d.appendChild(bar);

    return d;
}


function renderTape() {

    $("tapeBody").innerHTML =
        state.trades
            .map(
                t => `
                    <div class="tape-row">
                        <span>${t.time}</span>
                        <span>${fmt(t.price)}</span>
                        <span>${t.size.toLocaleString()}</span>
                        <span class="tape-side ${
                            t.side === "BUY"
                                ? "trade-up"
                                : "trade-down"
                        }">${t.side}</span>
                    </div>
                `
            )
            .join("");


    const t = state.trades[0];


    $("lastTradeSize").textContent =
        t
            ? `${t.size} @ ${t.time}`
            : "--";
}


function renderChart() {

    const canvas =
        $("priceChart");

    const rect =
        canvas.getBoundingClientRect();

    const dpr =
        window.devicePixelRatio || 1;


    canvas.width =
        Math.max(
            1,
            rect.width * dpr
        );

    canvas.height =
        Math.max(
            1,
            rect.height * dpr
        );


    const ctx =
        canvas.getContext("2d");


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    const w = rect.width;
    const h = rect.height;

    const p = state.prices;


    const min =
        Math.min(...p) - 0.008;

    const max =
        Math.max(...p) + 0.008;


    const x =
        i =>
            8 +
            (w - 24) *
            i /
            (p.length - 1 || 1);


    const y =
        v =>
            8 +
            (h - 18) *
            (
                1 -
                (v - min) /
                (max - min || 1)
            );


    ctx.clearRect(
        0,
        0,
        w,
        h
    );


    ctx.beginPath();


    p.forEach(
        (v, i) => {

            if (i) {

                ctx.lineTo(
                    x(i),
                    y(v)
                );

            } else {

                ctx.moveTo(
                    x(i),
                    y(v)
                );
            }
        }
    );


    ctx.lineWidth = 1.5;

    ctx.strokeStyle =
        "#d6dee9";

    ctx.stroke();


    const last =
        p[p.length - 1];


    ctx.beginPath();

    ctx.arc(
        x(p.length - 1),
        y(last),
        3.2,
        0,
        Math.PI * 2
    );


    ctx.fillStyle = "#fff";

    ctx.fill();


    $("yLabels").innerHTML =
        [max, (max + min) / 2, min]
            .map(
                v =>
                    `<span>${v.toFixed(4)}</span>`
            )
            .join("");


    $("chartLow").textContent =
        `LOW ${min.toFixed(4)}`;

    $("chartHigh").textContent =
        `HIGH ${max.toFixed(4)}`;


    const ch =
        ((last - p[0]) / p[0]) * 100;


    $("chartChange").textContent =
        `${ch >= 0 ? "+" : ""}${ch.toFixed(3)}%`;


    $("chartChange").style.color =
        ch >= 0
            ? "var(--green)"
            : "var(--red)";
}


function setOrderFormSide(side) {

    $("buyOrderBtn")
        .classList.toggle(
            "active",
            side === "bid"
        );

    $("sellOrderBtn")
        .classList.toggle(
            "active",
            side === "ask"
        );


    const submit =
        $("submitOrderBtn");


    submit.classList.toggle(
        "buy",
        side === "bid"
    );

    submit.classList.toggle(
        "sell",
        side === "ask"
    );


    submit.textContent =
        side === "bid"
            ? "PLACE BUY ORDER"
            : "PLACE SELL ORDER";
}


function addUserOrder() {

    const side =
        $("buyOrderBtn")
            .classList.contains("active")
            ? "bid"
            : "ask";


    const price =
        Number(
            $("orderPrice").value
        );


    const size =
        Number(
            $("orderSize").value
        );


    const message =
        $("orderFormMessage");


    if (
        !Number.isFinite(price) ||
        price <= 0
    ) {

        message.textContent =
            "Enter a valid price.";

        message.className =
            "order-form-message error";

        return;
    }


    if (
        !Number.isInteger(size) ||
        size <= 0
    ) {

        message.textContent =
            "Enter a valid integer size.";

        message.className =
            "order-form-message error";

        return;
    }


    const roundedPrice =
        +price.toFixed(2);


    if (
        side === "bid" &&
        roundedPrice >= state.bestAsk
    ) {

        message.textContent =
            `BUY price must be below best ask ${
                fmt(state.bestAsk, 4)
            }.`;

        message.className =
            "order-form-message error";

        return;
    }


    if (
        side === "ask" &&
        roundedPrice <= state.bestBid
    ) {

        message.textContent =
            `SELL price must be above best bid ${
                fmt(state.bestBid, 4)
            }.`;

        message.className =
            "order-form-message error";

        return;
    }


    const book =
        side === "bid"
            ? state.bids
            : state.asks;


    const level =
        book.find(
            x =>
                x.price === roundedPrice
        );


    if (level) {

        level.volume += size;
        level.orders += 1;

    } else {

        book.push({
            price: roundedPrice,
            volume: size,
            orders: 1
        });
    }


    if (side === "bid") {

        book.sort(
            (a, b) =>
                b.price - a.price
        );

    } else {

        book.sort(
            (a, b) =>
                a.price - b.price
        );
    }


    state.bestBid =
        state.bids[0].price;

    state.bestAsk =
        state.asks[0].price;


    state.mid =
        +(
            (state.bestBid +
                state.bestAsk) / 2
        ).toFixed(4);


    state.lastPrice =
        state.lastPrice;


    state.eventId += 1;

    state.eventType =
        "USER_LIMIT_ADD";

    state.simSeconds += 0.001;


    state.prices.push(
        state.mid
    );

    state.prices =
        state.prices.slice(-110);


    renderState();


    message.textContent =
        `${side === "bid" ? "BUY" : "SELL"} order added: ` +
        `${size.toLocaleString()} @ ` +
        `${roundedPrice.toFixed(2)}`;


    message.className =
        "order-form-message success";


    $("orderPrice").value = "";
    $("orderSize").value = "";
}


function renderState() {

    $("eventId").textContent =
        pad(state.eventId, 6);

    $("simTime").textContent =
        formatTime(state.simSeconds);

    $("footerTime").textContent =
        formatTime(state.simSeconds);


    renderBook();
    renderTape();
    renderChart();
}


function nextEvent() {

    state.simSeconds +=
        0.027 +
        Math.random() * 0.21;

    adapter.next();

    state.eventId++;

    renderState();
}


function stop() {

    if (state.timer) {

        clearInterval(
            state.timer
        );

        state.timer = null;
    }


    state.playing = false;

    $("playButton").textContent =
        "▶ PLAY";
}


function start() {

    stop();

    state.playing = true;

    $("playButton").textContent =
        "❚❚ PAUSE";


    const delay =
        Math.max(
            35,
            700 / state.speed
        );


    state.timer =
        setInterval(
            nextEvent,
            delay
        );
}


function reset() {

    stop();

    state.eventId = 1;

    state.simSeconds =
        34201.244;

    adapter.reset();

    state.eventType =
        "RESET";

    renderState();
}


$("nextEvent")
    .addEventListener(
        "click",
        nextEvent
    );


$("previousEvent")
    .addEventListener(
        "click",
        () => {}
    );


$("playButton")
    .addEventListener(
        "click",
        () =>
            state.playing
                ? stop()
                : start()
    );


$("resetButton")
    .addEventListener(
        "click",
        reset
    );


$("speedSlider")
    .addEventListener(
        "input",
        e => {

            state.speed =
                Number(e.target.value);


            $("speedValue").textContent =
                `${state.speed
                    .toFixed(2)
                    .replace(/0$/, "")}x`;


            if (state.playing) {
                start();
            }
        }
    );


$("addOrderBtn")
    .addEventListener(
        "click",
        () => {

            $("orderForm")
                .classList.toggle(
                    "hidden"
                );

            $("orderFormMessage")
                .textContent = "";
        }
    );


$("closeOrderForm")
    .addEventListener(
        "click",
        () => {

            $("orderForm")
                .classList.add(
                    "hidden"
                );
        }
    );


$("buyOrderBtn")
    .addEventListener(
        "click",
        () =>
            setOrderFormSide("bid")
    );


$("sellOrderBtn")
    .addEventListener(
        "click",
        () =>
            setOrderFormSide("ask")
    );


$("submitOrderBtn")
    .addEventListener(
        "click",
        addUserOrder
    );


window.addEventListener(
    "resize",
    renderChart
);


adapter.reset();

renderState();