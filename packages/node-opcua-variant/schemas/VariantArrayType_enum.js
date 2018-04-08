"use strict";

const factories = require("node-opcua-factory");

const VariantArrayType_Schema = {
    name:"VariantArrayType",
    enumValues: {
        Scalar: 0x00,
        Array:  0x01,
        Matrix:  0x02
    }
};

exports.VariantArrayType = factories.registerEnumeration(VariantArrayType_Schema);
