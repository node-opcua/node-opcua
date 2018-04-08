"use strict";
/* global describe,it,before*/

const should = require("should");

const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;
const NumericRange = require("node-opcua-numeric-range").NumericRange;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("Testing bug found in #337", function () {

    let addressSpace = null;
    before(function (done) {
        get_mini_address_space(function (err, data) {
            addressSpace = data;
            done(err);
        });
    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should handle Matrix ", function () {

        const n = addressSpace.addVariable({
            organizedBy: addressSpace.rootFolder.objects,
            nodeId: "ns=1;s=Position",
            browseName: "position",
            dataType: "Double",
            valueRank: 2,
            arrayDimensions: [3, 3],
            value: {
                get: function () {
                    return new Variant({
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Matrix,
                        dimensions: [3, 3],
                        value: [1, 2, 3, 4, 5, 6, 7, 8, 9]
                    });
                }
            }
        });

        const dataValue = n.readValue(null, new NumericRange());
        dataValue.isValid().should.eql(true);
        dataValue.value.arrayType.should.eql(VariantArrayType.Matrix);
        dataValue.value.dimensions.should.eql([3, 3]);

    });

});
