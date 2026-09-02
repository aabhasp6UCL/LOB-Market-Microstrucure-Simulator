#include <iostream>
#include <queue>
#include <map>
#include <string>
#include "../include/SimulateMarketEvents.h"
#include "../include/Order.h"
#include "../include/MatchingEngine.h"

class Order_book {
    private:
        MatchingEngine match;
    
    public:
        std::map<double, std::queue<Order>, std::greater<double>> bid;
        std::map<double, std::queue<Order>> ask;

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
        void cancelOrder(Order order);
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


void Order_book::cancelOrder(long id){

    double price = order.price;
    Side side = order.side;
    long id = order.id; 

    std::queue<Order> removed;
    
    if (side == Side::BUY) {
        while (!bid[price].empty()) {
            if (bid[price].front().id != id) {
                removed.push(bid[price].front());
            }
            bid[price].pop();
        }
        bid[price] = removed;
    } 
    else {
        while (!ask[price].empty()) {
            if (ask[price].front().id != id) {
                removed.push(ask[price].front());
            }
            ask[price].pop();
        }
        ask[price] = removed;
    }
}

void Order_book::editOrder(Order order){
}

void Order_book::processEvent(MarketEvent event){
    if (event.type == EventType::NEW_ORDER){
        addOrder(event.order);}
    else if (event.type == EventType::CANCEL_ORDER){
        cancelOrder(event.order);}
    else{
        editOrder(event.order);}   
}