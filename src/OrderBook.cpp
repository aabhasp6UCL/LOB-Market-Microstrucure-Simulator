#include <iostream>
#include <queue>
#include <map>
#include <string>
#include <stdexcept>

#include "../include/OrderBook.h"
#include "../include/snapshot.h"
#include "../include/MarketEvents.h"
#include "../include/Order.h"
#include "../include/MatchingEngine.h"


std::map<double, std::queue<Order>, std::greater<double>>& OrderBook::getBid() {
    return bid;
}

MatchingEngine match;

std::map<double, std::queue<Order>>&OrderBook::getAsk() {
    return ask;
}

OrderBook::OrderBook(
    std::map<double, std::queue<Order>, std::greater<double>> bid,
    std::map<double, std::queue<Order>> ask
) {
    this->bid = bid;
    this->ask = ask;
}


void OrderBook::addOrder(Order order) {

    double price_ = order.price;

    if (order.type == OrderType::LIMIT) {
        if (order.side == Side::BUY) {
            if (!ask.empty() && ask.begin()->first <= price_) {
                match.MatchOrder(order, ask, bid);
            }
            else {
                if (bid.count(price_) > 0) {
                    bid[price_].push(order);
                }
                else {
                    std::queue<Order> new_queue;
                    new_queue.push(order);
                    bid[price_] = new_queue;
                }
            }
        }
        else if (order.side == Side::SELL) {
            if (!bid.empty() && bid.begin()->first >= price_) {
                match.MatchOrder(order, bid, ask);
            }
            else {
                if (ask.count(price_) > 0) {
                    ask[price_].push(order);
                }
                else {
                    std::queue<Order> new_queue;
                    new_queue.push(order);
                    ask[price_] = new_queue;
                }
            }
        }
    }
    else if (order.type == OrderType::MARKET) {
        if (order.side == Side::BUY) {
            match.MatchOrder(order, ask, bid);
        }
        else {
            match.MatchOrder(order, bid, ask);
        }
    }
}


Order OrderBook::returnOrderBasedOnId(long ids) {

    for (const auto& pair : bid) {
        std::queue<Order> hold = pair.second;
        while (!hold.empty()) {
            Order item = hold.front();
            if (item.id == ids) {
                return item;
            }
            hold.pop();
        }
    }

    for (const auto& pair : ask) {
        std::queue<Order> hold = pair.second;
        while (!hold.empty()) {
            Order item = hold.front();
            if (item.id == ids) {
                return item;
            }
            hold.pop();
        }
    }

    throw std::runtime_error("Order ID not found");
}


template <typename MapType>
void OrderBook::remove(MapType& type,double price,long ids) {
    std::queue<Order> removed;
    while (!type[price].empty()) {
        if (type[price].front().id != ids) {
            removed.push(type[price].front());
        }
        type[price].pop();
    }
    type[price] = removed;
}


void OrderBook::cancelOrder(long ids) {

    Order cancel_order = returnOrderBasedOnId(ids);
    Side side = cancel_order.side;
    if (side == Side::BUY) {
        remove(bid, cancel_order.price, ids);
    }
    else {
        remove(ask, cancel_order.price, ids);
    }
}

void OrderBook::processEvent(MarketEvent event) {

    if (event.type == EventType::NEW_ORDER) {
        addOrder(event.order);
    }
    else if (event.type == EventType::CANCEL_ORDER) {
        cancelOrder(event.order.id);
    }
}