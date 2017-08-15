"use strict";

var _FIRST_INTERNAL_ID = 0xFFFE0000;

var _next_available_id = _FIRST_INTERNAL_ID;
exports.generate_new_id = function () {
    _next_available_id += 1;
    return _next_available_id;
};

exports.next_available_id = function () {
    return -1;
};
exports.is_internal_id = function (value) {
    return value >= _FIRST_INTERNAL_ID;
};


