#ifndef ORDERBOOK_H
#define ORDERBOOK_H

#include <functional>
#include <map>
#include <deque>
#include <vector>
#include "Order.h"
#include "Trade.h"
#include "MarketEvents.h"
#include "MatchingEngine.h"


class OrderBook {
public:
    std::map<double, std::deque<Order>, std::greater<double>> bid;
    std::map<double, std::deque<Order>> ask;

    std::vector<Trade> trades;

    MatchingEngine match;

public:
    OrderBook() = default;
    OrderBook(std::map<double, std::deque<Order>, std::greater<double>> bid,
              std::map<double, std::deque<Order>> ask);

    std::map<double, std::deque<Order>, std::greater<double>>& getBid();
    std::map<double, std::deque<Order>>& getAsk();

    void addOrder(Order order);
    void editOrder(long ids, double newPrice, int newQuant);
    void partialCancellation(long ids, int newQuant);
    void processEvent(MarketEvent event);
    Order& returnOrderBasedOnId(long ids);
    template <typename MapType>
    void remove(MapType& type,double price,long ids);
    void cancelOrder(long ids);

};

#endif