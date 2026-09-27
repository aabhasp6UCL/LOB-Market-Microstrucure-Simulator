#include "../include/MatchingEngine.h"
#include "../include/Order.h"
#include "../include/OrderBook.h"

class metrics {
    public:
       double bestBid();
       double bestAsk();
       double midPrice();
       double spread();
       std::pair<double, double> getVolume(const OrderBook& orderBook);
       double getTotalDepth(const OrderBook& orderBook);
       double getOrderBookImbalance(const OrderBook& orderBook);

};
extern OrderBook ob;

double metrics::bestBid(){
    return ob.getAsk().begin()->second.front().price;
}

double metrics::bestAsk(){
    return ob.getBid().begin()->second.front().price;
}

double metrics::midPrice(){
    return (bestBid()+bestAsk())/2;
}

double metrics::spread(){
    return bestAsk() - bestBid();
}

std::pair<double, double> metrics:: getVolume(const OrderBook& orderBook){

    double bidVolume = 0;
    double askVolume = 0;

    for (const auto& [price, orders] : ob.getBid()) {
        std::deque<Order> deque = orders;
        while (!deque.empty()) {
            bidVolume += deque.front().quantity;
            deque.pop_front();
        }
    }

    for (const auto& [price, orders] : ob.getAsk()) {
        std::deque<Order> deque = orders;
        while (!deque.empty()) {
            askVolume += deque.front().quantity;
            deque.pop_front();
        }
    }
    return {bidVolume, askVolume};
}

double metrics:: getTotalDepth(const OrderBook& orderBook){
    auto [bidVolume, askVolume] = getVolume(orderBook);
    return bidVolume + askVolume;
}

double metrics:: getOrderBookImbalance(const OrderBook& orderBook) {
    auto [bidVolume, askVolume] = getVolume(orderBook);
    double totalVolume = bidVolume + askVolume;
    if (totalVolume == 0) {
        return 0;
    }
    return (bidVolume - askVolume) / totalVolume;
}
