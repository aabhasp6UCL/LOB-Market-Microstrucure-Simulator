#ifndef ORDERBOOK_H
#define ORDERBOOK_H

#include <functional>
#include <map>
#include <queue>
#include <vector>
#include "Order.h"
#include "Trade.h"

class OrderBook {
private:
    std::map<double, std::queue<Order>, std::greater<double>> bid;
    std::map<double, std::queue<Order>> ask;

    std::vector<trade> trades;

public:
    OrderBook() = default;
    OrderBook(std::map<double, std::queue<Order>, std::greater<double>> bid,
              std::map<double, std::queue<Order>> ask);

    std::map<double, std::queue<Order>, std::greater<double>>& getBid();
    std::map<double, std::queue<Order>>& getAsk();

    void addOrder(Order order);
    void cancelOrder(Order order);
    void editOrder(Order order);
};

#endif