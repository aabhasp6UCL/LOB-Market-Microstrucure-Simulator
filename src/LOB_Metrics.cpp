#include "../include/MatchingEngine.h"
#include "../include/Order.h"
#include "../include/OrderBook.h"

class metrics {
    public:
       OrderBook ob;
       double bestBid();
       double bestAsk();
       double midPrice();
       double spread();
       std::pair<double, double> getVolume(const OrderBook& orderBook);
       double getTotalDepth(const OrderBook& orderBook);
       double getOrderBookImbalance(const OrderBook& orderBook);

};
OrderBook ob;

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
        std::queue<Order> queue = orders;
        while (!queue.empty()) {
            bidVolume += queue.front().quantity;
            queue.pop();
        }
    }

    for (const auto& [price, orders] : ob.getAsk()) {
        std::queue<Order> queue = orders;
        while (!queue.empty()) {
            askVolume += queue.front().quantity;
            queue.pop();
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
