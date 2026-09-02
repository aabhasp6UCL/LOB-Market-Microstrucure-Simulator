#include "../include/MatchingEngine.h"
#include "../include/OrderBook.h"

class MatchingEngine{
    public:
        void MatchOrder(Order& order, std::map<double, std::queue<Order>>& type);
        OrderBook ob;
};

void MatchingEngine :: MatchOrder(Order& order, std::map<double, std::queue<Order>>& type){

    double price_ = order.price;
    int quant = order.quantity;
    Side side = order.side;
    long id = order.id;

    int remaining = quant;

    while (remaining != 0 && !type.empty()){
        std::queue<Order>& queue = type.begin()->second;
        if (queue.empty() == true){
            type.erase(type.begin());
            if (!type.empty()){
                std::queue<Order>& queue = type.begin()->second;
                if (order.type == OrderType::LIMIT ){
                    if (side == Side::BUY && ob.getAsk().begin()->first > price_){
                        break;
                    }
                    if (side == Side::SELL && ob.getBid().begin()->first < price_ ){
                        break;
                    }
                }
            }
        }
        if (remaining >= queue.front().quantity){
            remaining -= queue.front().quantity;
            queue.pop();
        }
        else{
            queue.front().quantity -= remaining;
            remaining = 0;
            break;
        }
    }
}