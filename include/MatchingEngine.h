#ifndef MATCHING_ENGINE_H
#define MATCHING_ENGINE_H

#include <map>
#include <deque>
#include <vector>
#include "Order.h"
#include "Trade.h"


class MatchingEngine {

public:

    MatchingEngine() = default;

    template <typename Compare,typename Compare1>
    void MatchOrder(Order& order, std::map<double, std::deque<Order>, Compare>& type, std::map<double, std::deque<Order>, Compare1>& opp_type){

        std::vector<Trade> store_trades;
        
        double price_ = order.price;
        int quant = order.quantity;
        Side side = order.side;
        long id = order.id;

        int remaining = quant;

        while (remaining != 0 && !type.empty()){
            if (type.begin()->second.empty() == true){
                type.erase(type.begin());
                continue;
            }
            if (!type.empty()){
                if (order.type == OrderType::LIMIT ){
                    if (side == Side::BUY && opp_type.begin()->first > price_){
                        //Order new_order = Order(id,OrderType::LIMIT,Side::BUY,price_,remaining);
                        //ob.addOrder(new_order);
                        break;
                    }
                    if (side == Side::SELL && opp_type.begin()->first < price_ ){
                        //Order new_order = Order(id,OrderType::LIMIT,Side::SELL,price_,remaining);
                        //ob.addOrder(new_order);
                        break;
                    }
                }
            }

            std::deque<Order>& deque = type.begin()->second;

            Trade trade;
            if (side == Side::BUY){
                trade = Trade(deque.front().price,id,deque.front().id,deque.front().quantity);    
            }
            else{
                trade = Trade(deque.front().price,deque.front().id,id,deque.front().quantity);
            }

            if (remaining >= deque.front().quantity){
                remaining -= deque.front().quantity;
                deque.pop_front();
                store_trades.push_back(trade);
            }
            else{
                store_trades.push_back(trade);
                deque.front().quantity -= remaining;
                remaining = 0;
                break;
            }
        }
    }
};

#endif