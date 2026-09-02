#pragma once

#include "Order.h"

enum class EventType {
    NEW_ORDER = 1,
    MODIFY_ORDER = 2,
    CANCEL_ORDER = 3,

};

struct MarketEvent {
    EventType type;
    long timestamp;
    Order order;
};