#include <iostream>
#include "../include/Order.h"
#include <vector>

struct Trade {

    double price;
    long buy_id;
    long sell_id;
    Side side;
    int trade_quantity;

};

std:: vector<Trade> trades;
void storeTrade(Trade trade){
    trades.push_back(trade);
}