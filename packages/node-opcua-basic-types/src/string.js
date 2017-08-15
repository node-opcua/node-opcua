"use strict";

var getRandomInt = require("./utils").getRandomInt;

exports.isValidString = function (value) {
    return typeof value === "string";
};
exports.randomString = function () {
    var nbCar = getRandomInt(1, 20);
    var cars = [];
    for (var i = 0; i < nbCar; i++) {
        cars.push(String.fromCharCode(65 + getRandomInt(0, 26)));
    }
    return cars.join("");
};

exports.decodeString = function (stream) {
    return stream.readString();
};
exports.encodeString = function (value, stream) {
    stream.writeString(value);
};
