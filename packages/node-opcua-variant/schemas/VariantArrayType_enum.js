"use strict";

var factories = require("node-opcua-factory");

var VariantArrayType_Schema = {
    name:"VariantArrayType",
    enumValues: {
        Scalar: 0x00,
        Array:  0x01,
        Matrix:  0x02
    }
};

exports.VariantArrayType = factories.registerEnumeration(VariantArrayType_Schema);
