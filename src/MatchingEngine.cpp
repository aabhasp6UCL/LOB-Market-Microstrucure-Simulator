#include "../include/MatchingEngine.h"
#include "../include/OrderBook.h"
#include "../include/Trade.h"
#include <vector>

class MatchingEngine{
    public:

        OrderBook ob;
        std::vector<Trade> store_trades;

        template <typename Compare>
        void MatchOrder(Order& order, std::map<double, std::queue<Order>, Compare>& type); 
};

template <typename Compare>
void MatchingEngine :: MatchOrder(Order& order, std::map<double, std::queue<Order>, Compare>& type){

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
                if (side == Side::BUY && ob.getAsk().begin()->first > price_){
                    new_order = Order(id,OrderType::LIMIT,Side::BUY,price_,remaining);
                    ob.addOrder(new_order);
                    break;
                }
                if (side == Side::SELL && ob.getBid().begin()->first < price_ ){
                    new_order = Order(id,OrderType::LIMIT,Side::SELL,price_,remaining);
                    ob.addOrder(new_order);
                    break;
                }
            }
        }

        std::queue<Order>& queue = type.begin()->second;

        Trade trade;
        if (side == Side::BUY){
            trade = Trade(queue.front().price,id,queue.front().id,queue.front().quantity);    
        }
        else{
            trade = Trade(queue.front().price,queue.front().id,id,queue.front().quantity);
        }

        if (remaining >= queue.front().quantity){
            remaining -= queue.front().quantity;
            queue.pop();
            store_trades.push_back(trade);
        }
        else{
            store_trades.push_back(trade);
            queue.front().quantity -= remaining;
            remaining = 0;
            break;
        }
    }
}