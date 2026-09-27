#ifndef MATCHING_ENGINE_H
#define MATCHING_ENGINE_H

#include <map>
#include <deque>
#include "Order.h"
#include "Trade.h"

class MatchingEngine {

public:

    MatchingEngine() = default;

    template <typename Compare1, typename Compare2>
    void MatchOrder(
        Order& order,
        std::map<double, std::deque<Order>, Compare1>& type,
        std::map<double, std::deque<Order>, Compare2>& opp_type
    );
};

#endif