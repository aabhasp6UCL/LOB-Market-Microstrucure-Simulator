#include <iostream>
#include <string>

enum Side {
    BUY,
    SELL
};
enum OrderType {
    MARKET,
    LIMIT
};

struct Order {
    long id;
    OrderType type;
    Side side;
    double price;
    int quantity;
};