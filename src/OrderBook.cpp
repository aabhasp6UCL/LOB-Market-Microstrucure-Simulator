#include <iostream>
#include <queue>
#include <map>
#include <string>
#include "../include/MarketEvents.h"
#include "../include/Order.h"
#include "../include/MatchingEngine.h"

class Order_book {
    private:
        MatchingEngine match;
    
    public:
        std::map<double, std::queue<Order>, std::greater<double>> bid;
        std::map<double, std::queue<Order>, std::less<double>> ask;

        std::map<double, std::queue<Order>, std::greater<double>>& getBid(){
            return bid;
        };
        
        std::map<double, std::queue<Order>>& getAsk(){
            return ask;
        };

        Order_book(std::map<double, std::queue<Order>, std::greater<double>> bid, std::map<double, std::queue<Order>> ask) {
            this->bid = bid;
            this->ask = ask;
        }

        void addOrder(Order order);
        
        template <typename MapType>
        void remove(MapType& type, double price, long id) {
        Order returnOrderBasedOnId(long ids);
        void cancelOrder(long id);

        void editOrder(Order order);
        void processEvent(MarketEvent event);
};


void Order_book::addOrder(Order order){

    double price_ = order.price;
    int quant = order.quantity;

    if (order.type == OrderType::LIMIT){
        if (order.side == Side::BUY){
            if (!ask.empty() && ask.begin()->first <= price_){
                match.MatchOrder(order, ask);}
            else{
                if (bid.count(price_) > 0){
                    bid[price_].push(order);
                }
                else{
                    std::queue<Order> new_queue;
                    new_queue.push(order);
                    bid[price_] = new_queue;
                }
            }
        }
        else if (order.side == Side::SELL){
            if (!bid.empty() && bid.begin()->first >= price_){
                match.MatchOrder(order, reinterpret_cast<std::map<double, std::queue<Order>>&>(bid));}
            else{
                if (ask.count(price_) > 0){
                    ask[price_].push(order);
                }
                else{
                    std::queue<Order> new_queue;
                    new_queue.push(order);
                    ask[price_] = new_queue;
                }
            }
        }
    }
    else if (order.type == OrderType::MARKET){
        if (order.side == Side::BUY){
            match.MatchOrder(order, ask);}
        else{
            match.MatchOrder(order, reinterpret_cast<std::map<double, std::queue<Order>>&>(bid));}
    }
}

Order Order_book::returnOrderBasedOnId(long ids){

    for (const auto& pair : bid) {
        std::queue<Order> hold = pair.second;
        while (!hold.empty()) {
            Order item = hold.front();
            if (item.id == ids) {
                return item;}
            hold.pop();
        }
    }
    
    for (const auto& pair : ask) {
        std::queue<Order> hold = pair.second;
        while (!hold.empty()) {
            Order item = hold.front();
            if (item.id == ids) {
                return item;}
            hold.pop();
        }
    }
}

template <typename MapType>
void Order_book:: remove(MapType& type, double price, long ids) {

    std::queue<Order> removed;
    while (!type[price].empty()) {
        if (type[price].front().id != ids) {
            removed.push(type[price].front());
        }
        type[price].pop();
    }
    type[price] = removed;
}

void Order_book::cancelOrder(long ids){

    Order cancel_order = returnOrderBasedOnId(ids);
    Side side = cancel_order.side;
    double price = cancel_order.price;

    std::map<double, std::queue<Order>, std::greater<double>> type = {};

    if (side == Side ::BUY){
        remove(bid, cancel_order.price, ids);
    }
    else {
        remove(bid, cancel_order.price, ids);
    } 
}

void Order_book::editOrder(long ids){
}

void Order_book::processEvent(MarketEvent event){
    if (event.type == EventType::NEW_ORDER){
        addOrder(event.order);
    }
    else if (event.type == EventType::CANCEL_ORDER){
        cancelOrder(event.order.id);
    }
    else{
        editOrder(event.order.id);
    }   
}