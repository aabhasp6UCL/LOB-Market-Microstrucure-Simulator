#include <iostream>
#include <deque>
#include <map>
#include <string>
#include <stdexcept>

#include "../include/OrderBook.h"
#include "../include/snapshot.h"
#include "../include/MarketEvents.h"
#include "../include/Order.h"
#include "../include/MatchingEngine.h"


OrderBook ob;

std::map<double, std::deque<Order>, std::greater<double>>& OrderBook::getBid() {
    return bid;
}

MatchingEngine match;

std::map<double, std::deque<Order>>&OrderBook::getAsk() {
    return ask;
}

OrderBook::OrderBook(
    std::map<double, std::deque<Order>, std::greater<double>> bid,
    std::map<double, std::deque<Order>> ask
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
                    bid[price_].push_back(order);
                }
                else {
                    std::deque<Order> new_deque;
                    new_deque.push_back(order);
                    bid[price_] = new_deque;
                }
            }
        }
        else if (order.side == Side::SELL) {
            if (!bid.empty() && bid.begin()->first >= price_) {
                match.MatchOrder(order, bid, ask);
            }
            else {
                if (ask.count(price_) > 0) {
                    ask[price_].push_back(order);
                }
                else {
                    std::deque<Order> new_deque;
                    new_deque.push_back(order);
                    ask[price_] = new_deque;
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


Order& OrderBook::returnOrderBasedOnId(long ids) {

    for (auto& pair : bid) {
        std::deque<Order>& hold = pair.second;
        auto iter = hold.begin();
        while (iter != hold.end()) {
            Order& item = *iter;
            long check = item.id;
            if (check == ids) {
                return item;
            }
            iter++;
        }
    }

    for (auto& pair : ask) {
        std::deque<Order>& hold = pair.second;
        auto iter = hold.begin();
        while (iter != hold.end()) {
            Order& item = *iter;
            long check = item.id;
            if (check == ids) {
                return item;
            }
            iter++;
        }
    }

    throw std::runtime_error("Order ID not found");
}


template <typename MapType>
void OrderBook::remove(MapType& type,double price,long ids) {
    std::deque<Order> removed;
    while (!type[price].empty()) {
        if (type[price].front().id != ids) {
            removed.push_back(type[price].front());
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

void OrderBook::editOrder(long ids, double newPrice, int newQuant){
    Order ord = returnOrderBasedOnId(ids);
    Order newOrder = Order(ids,OrderType::LIMIT,ord.side,newPrice,newQuant);
    cancelOrder(ids);
    addOrder(newOrder);
}

void OrderBook::partialCancellation(long ids, int newQuant){

    Order& ord = returnOrderBasedOnId(ids);
    ord.quantity = newQuant;

}

void OrderBook::processEvent(MarketEvent event) {

    if (event.type == EventType::NEW_ORDER) {
        addOrder(event.order);
    }
    else if (event.type == EventType::CANCEL_ORDER) {
        cancelOrder(event.order.id);
    }
    else if (event.type == EventType::MODIFY_ORDER) {
        partialCancellation(event.order.id,event.order.quantity);
    } 
}