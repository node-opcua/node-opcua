"use strict";
/* global describe,it,before*/

var should = require("should");

var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var VariantArrayType = require("node-opcua-variant").VariantArrayType;
var NumericRange = require("node-opcua-numeric-range").NumericRange;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("Testing bug found in #337", function () {

    var addressSpace = null;
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

        var n = addressSpace.addVariable({
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

        var dataValue = n.readValue(null, new NumericRange());
        dataValue.isValid().should.eql(true);
        dataValue.value.arrayType.should.eql(VariantArrayType.Matrix);
        dataValue.value.dimensions.should.eql([3, 3]);

    });

});
