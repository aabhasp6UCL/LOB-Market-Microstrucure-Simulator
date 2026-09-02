#include "SimulateMarketEvents.h"
#include "../include/Order.h"
#include <fstream>
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

static std::vector<std::string> split(const std::string& line, char delimiter)
{
    std::vector<std::string> fields;
    std::stringstream stream(line);
    std::string field;

    while (std::getline(stream, field, delimiter)) {
        fields.push_back(field);
    }

    return fields;
}

static void readMarketEvents()
{
    std::ifstream file("AAPL_2012-06-21_34200000_57600000_message_1.csv");
    std::string line;

    while (std::getline(file, line)) {

        std::vector<std::string> row = split(line, ',');
        double timestamp = std::stod(row[0]);
        EventType eventType = static_cast<EventType>(std::stoi(row[1]));
        long orderId = std::stol(row[2]);
        int quantity = std::stoi(row[3]);
        double price = std::stod(row[4]) / 10000.0;

        if (eventType > static_cast<EventType>(4)) {
            continue;
        }

        Side direction = (std::stoi(row[5]) == 1) ? Side::BUY : Side::SELL;
        Order order(orderId, price, quantity, direction, OrderType::LIMIT);
    }
}