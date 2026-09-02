#ifndef MATCHING_ENGINE_H
#define MATCHING_ENGINE_H

#include <map>
#include <queue>
#include "Order.h"

class OrderBook;   // forward declaration

class MatchingEngine {
public:
    MatchingEngine() = default;

    void MatchOrder(Order& order, std::map<double, std::queue<Order>>& type);
};

#endif