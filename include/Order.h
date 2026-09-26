#ifndef ORDER_H
#define ORDER_H

enum class Side {
    BUY,
    SELL
};

enum class OrderType {
    LIMIT,
    MARKET
};

struct Order {
    long id;
    OrderType type;
    Side side;
    double price;
    int quantity;
};

#endif