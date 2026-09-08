#include "MarketEvents.h"
#include "../include/Order.h"
#include "../include/OrderBook.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

OrderBook ob;
static std::vector<std::string> split(const std::string& line, char delimiter){
    
    std::vector<std::string> fields;
    std::stringstream stream(line);
    std::string field;

    while (std::getline(stream, field, delimiter)) {
        fields.push_back(field);
    }

    return fields;
}

json parseOrder(Order order) {
    json j;
    j["id"] = order.id;
    j["price"] = order.price;
    j["quantity"] = order.quantity;

    j["side"] =
        (order.side == Side::BUY)
        ? "BUY"
        : "SELL";

    j["orderType"] =
        (order.type == OrderType::LIMIT)
        ? "LIMIT"
        : "MARKET";

    return j;
} 

json parseEvent(MarketEvent event){
    json j;
    j["order"] = parseOrder(event.order);
    j["timestamp"] = event.timestamp;

    if (event.type == EventType::NEW_ORDER) {
        j["type"] = "NEW_ORDER";
    }
    else if (event.type == EventType::CANCEL_ORDER) {
        j["type"] = "CANCEL_ORDER";
    }
    return j; 
}

json bidSize(std::map<double, std::queue<Order>, std::greater<double>>&bid, double bid_price){
    json j;
    int bidVolume = 0;
    int orders = 0;
    auto iter = bid.find(bid_price);
    std::queue<Order> level = iter->second;
    if (iter == bid.end())
{
    j["size"] = 0;
    j["orders"] = 0;
    return j;
}
    while (!level.empty()) {
        bidVolume += level.front().quantity;
        level.pop();
        orders++;
    }
    j["size"] = bidVolume;
    j["orders"] = orders;
    return j;
}

json askSize(std::map<double, std::queue<Order>, std::less<double>>& ask, double ask_price){
    json j;
    int askVolume = 0;
    int orders = 0;
    auto iter = ask.find(ask_price);
    std::queue<Order> level = iter->second;
    if (iter == ask.end())
{
    j["size"] = 0;
    j["orders"] = 0;
    return j;
}
    while (!level.empty()) {
        askVolume += level.front().quantity;
        level.pop();
        orders++;
    }
    j["size"] = askVolume;
    j["orders"] = orders;
    return j;
}

json parseRow(std::map<double, std::queue<Order>, std::greater<double>>& bid,
        std::map<double, std::queue<Order>, std::less<double>>& ask, double bid_price, double ask_price){
            
            json j;
            j["bid"] = bidSize(bid,bid_price);
            j["bid_price"] = bid_price;
            j["ask_price"] = ask_price;
            j["ask"] = askSize(ask,ask_price);
            return j;
} 

void parseOrderBook(std::map<double, std::queue<Order>, std::greater<double>>& bid,
        std::map<double, std::queue<Order>, std::less<double>>& ask){

    json OrderBook = json::array();
    auto bid_it = bid.begin();
    auto ask_it = ask.begin();


    while (bid_it != bid.end() && ask_it != ask.end()){
        
        json row = parseRow(bid,ask,bid_it->first,ask_it->first);
        OrderBook.push_back(row);
        bid_it++;
        ask_it++;
    }
    std::ofstream file("webSimulator/OrderBook.json");    
    file << OrderBook.dump(4);
    file.close();
}

static void readMarketEvents() {
    std::ifstream file("AAPL_2012-06-21_34200000_57600000_message_1.csv");
    std::string line;

    int i = 0;
    while (std::getline(file, line)) {

        std::vector<std::string> row = split(line, ',');
        double timestamp = std::stod(row[0]);
        EventType eventType = static_cast<EventType>(std::stoi(row[1]));
        long orderId = std::stol(row[2]);
        int quantity = std::stoi(row[3]);
        double price = std::stod(row[4]) / 10000.0;

        if (eventType != static_cast<EventType>(3) || eventType != static_cast<EventType>(1) ) {
            continue;
        }

        Side direction = (std::stoi(row[5]) == 1) ? Side::BUY : Side::SELL;
        Order order(orderId, price, quantity, direction, OrderType::LIMIT);
        parseOrder(order);
        MarketEvent event(eventType,timestamp,order);
        parseEvent(event);
        ob.processEvent(event);
        
        i++;

        if (i == 1000){
            break;
        }
    }
    parseOrderBook(ob.getBid(),ob.getAsk());
}

int main()
{
    readMarketEvents();

    return 0;
}