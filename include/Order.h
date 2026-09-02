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
    double price;
    int quantity;
    Side side;
    OrderType type;
};

#endif