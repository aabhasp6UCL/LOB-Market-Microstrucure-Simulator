#include "MarketEvents.h"
#include "../include/Order.h"
#include "../include/OrderBook.h"
#include <fstream>
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

static std::vector<std::string> split(const std::string& line, char delimiter){
    
    OrderBook ob;
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
        (order.direction == Side::BUY)
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
    else if (event.type == EventType::MODIFY_ORDER) {
        j["type"] = "MODIFY_ORDER";
    }
    else if (event.type == EventType::CANCEL_ORDER) {
        j["type"] = "CANCEL_ORDER";
    }
    return j; 
}

json bidSize(std::map<double, std::queue<Order>, std::greater<double>> bid_price){
    json j;
    bidVolume = 0;
    orders = 0;
    std:: queue<Order> level = bid.begin()->second;
    while (!level.empty()) {
        bidVolume += level.front().quantity;
        level.pop();
        orders++;
    }
    j["size"] = bidVolume;
    j["orders"] = orders;
    return j;
}

json askSize(std::map<double, std::queue<Order>, std::greater<double>> ask, double ask_price){
    json j;
    askVolume = 0;
    orders = 0;
    std:: queue<Order> level = ask[price];
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
            j["BID"] = "BID";
            j["bid"] = bidSize(bid,bid_price);
            j["bid_price"] = bid_price;
            j["ask_price"] = ask_price;
            j["ask"] = askSize(ask,ask_price);
            j["ASK"] = "ASK";
            return j;
} 

void parseOrderBook(std::map<double, std::queue<Order>, std::greater<double>>& bid,
        std::map<double, std::queue<Order>, std::less<double>>& ask){

    json OrderBook = json::array();
    auto bid_it = bid.begin();
    auto ask_it = ask.begin();

    while (bid_it != bid.end() || ask_it != ask.end()){
        
        json row = parseRow(bid,ask,bid_it->first,ask_it->first);
        OrderBook.push_back(row);
        bid_it++;
        ask_it++;
        if (ask_it != ask.end() || bid_it != bid.end()){
            break;
        } 

    }
    std::ofstream file("OrderBook.json");
    file << OrderBook.dump(4);
    file.close();
}

static void readMarketEvents() {
    std::ifstream file("AAPL_2012-06-21_34200000_57600000_message_1.csv");
    std::string line;

    while (std::getline(file, line)) {

        std::vector<std::string> row = split(line, ',');
        double timestamp = std::stod(row[0]);
        EventType eventType = static_cast<EventType>(std::stoi(row[1]));
        long orderId = std::stol(row[2]);
        int quantity = std::stoi(row[3]);
        double price = std::stod(row[4]) / 10000.0;

        if (eventType > static_cast<EventType>(3)) {
            continue;
        }
        Side direction = (std::stoi(row[5]) == 1) ? Side::BUY : Side::SELL;
        Order order(orderId, price, quantity, direction, OrderType::LIMIT);
        parseOrder(order);
        MarketEvent event(eventType,timestamp,order);
        parseEvent(event);
        ob.processEvent(event);


    }
}