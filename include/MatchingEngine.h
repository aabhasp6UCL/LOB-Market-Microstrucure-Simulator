#ifndef MATCHING_ENGINE_H
#define MATCHING_ENGINE_H

#include <map>
#include <queue>
#include "Order.h"

class MatchingEngine {

public:

    MatchingEngine() = default;

    template <typename Compare,typename Compare1>
    void MatchOrder(Order& order, std::map<double, std::queue<Order>, Compare>& type,
std::map<double, std::queue<Order>, Compare1>& opp_type);
};

#endif