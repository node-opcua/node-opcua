"use strict";
/* global it,before*/

var should = require("should");
var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;


var DataType = require("node-opcua-variant").DataType;
var Variant = require("node-opcua-variant").Variant;
var DataValue = require("node-opcua-data-value").DataValue;
var StatusCodes = require("node-opcua-status-code").StatusCodes;


var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue https://github.com/node-opcua/node-opcua/issues/449", function () {

    var addressSpace;
    before(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;
            done(err);
        });
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    it("#449 should be possible to access this in UAVariable get/set value accessor", function (done) {

        var node;
        var counterVar = {
            browseName: "TEST",
            dataType: "String",
            value: {
                get: function () {
                    // in get - this.browseName works great.
                    return new  Variant({
                        dataType: DataType.String,
                        value: this.browseName.toString()
                    });
                },
                set: function (variant) {
                    // in set - it doesn't
                    this.browseName.toString().should.eql("TEST");
                    this.should.eql(node);
                    return StatusCodes.Good;
                }
            }
        };

        node = addressSpace.addVariable(counterVar);

        var dataValue = new DataValue({
            value :{ dataType:"String",value:""}
        });

        node.writeValue(null,dataValue,null,function(err) {
            done(err);
        });

    });
});

