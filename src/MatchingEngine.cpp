#include "../include/MatchingEngine.h"
#include "../include/OrderBook.h"
#include "../include/Trade.h"

#include <map>
#include <deque>
#include <vector>
#include "Order.h"
#include "Trade.h"

template <typename Compare,typename Compare1>
void MatchingEngine::MatchOrder(Order& order, std::map<double, std::deque<Order>, Compare>& type, std::map<double, std::deque<Order>, Compare1>& opp_type){
    
    std::vector<Trade> store_trades;
        
    double price_ = order.price;
    int quant = order.quantity;
    Side side = order.side;
    long id = order.id;

    int remaining = quant;

    while (remaining != 0 && !type.empty()){

        std::deque<Order>& dq = type.begin()->second;

        if (dq.empty() == true){
            type.erase(type.begin());
            continue;
        }
        if (!type.empty()){
            if (order.type == OrderType::LIMIT ){
                if (side == Side::BUY && opp_type.begin()->first > price_){
                    Order new_order = Order(id,OrderType::LIMIT,Side::BUY,price_,remaining);
                    opp_type[price_].push_back(new_order);
                    break;
                }
                if (side == Side::SELL && opp_type.begin()->first < price_ ){
                    Order new_order = Order(id,OrderType::LIMIT,Side::SELL,price_,remaining);
                    opp_type[price_].push_back(new_order);
                    break;
                }
            }
        }

        Trade trade;
        if (side == Side::BUY){
            trade = Trade(dq.front().price,id,dq.front().id,dq.front().quantity);    
        }
        else{
            trade = Trade(dq.front().price,dq.front().id,id,dq.front().quantity);
        }

        if (remaining >= dq.front().quantity){
            remaining -= dq.front().quantity;
            dq.pop_front();
            store_trades.push_back(trade);
        }
        else{
            store_trades.push_back(trade);
            dq.front().quantity -= remaining;
            remaining = 0;
            break;
        }
    }
}

// Template Instantiation

template void MatchingEngine::MatchOrder<std::less<double>,
std::greater<double>>(Order&,std::map<double, std::deque<Order>,
std::less<double>>&,std::map<double, std::deque<Order>, std::greater<double>>&);

template void MatchingEngine::MatchOrder<std::greater<double>,
std::less<double>>(Order&,std::map<double, std::deque<Order>, std::greater<double>>&,
std::map<double, std::deque<Order>, std::less<double>>&);