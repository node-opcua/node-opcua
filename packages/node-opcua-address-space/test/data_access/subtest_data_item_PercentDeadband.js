"use strict";
var async = require("async");
var should = require("should");

var DataValue =  require("node-opcua-data-value").DataValue;
var Variant = require("node-opcua-variant").Variant;
var DataType = require("node-opcua-variant").DataType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;

var standardUnits = require("node-opcua-data-access").standardUnits;

var SessionContext = require("../..").SessionContext;
var context = SessionContext.defaultContext;

var AddressSpace = require("../../").AddressSpace;

module.exports = function (maintest) {

    describe("PercentDeadband", function () {

        var addressSpace;
        before(function() {
            addressSpace = maintest.addressSpace;
            should(addressSpace).be.instanceof(AddressSpace);
        });

        it("should provide a mechanism to operate PercentDeadband ", function (done) {

            var objectsFolder = addressSpace.findNode("ObjectsFolder");

            var analogItem = addressSpace.addAnalogDataItem({
                organizedBy: objectsFolder,
                browseName: "TemperatureSensor",
                definition: "(tempA -25) + tempB",
                valuePrecision: 0.5,
                engineeringUnitsRange: {low: -2000, high: 2000},
                instrumentRange: {low: -100, high: 200},
                engineeringUnits: standardUnits.degree_celsius,
                dataType: "Double",
                value: new Variant({dataType: DataType.Double, value: 10.0})
            });


            var dataValue = new DataValue({value: new Variant({dataType: DataType.Double, value: -1000.0})});

            async.series([
                function (callback) {
                    analogItem.writeValue(context, dataValue, null, function (err, statusCode) {
                        statusCode.should.eql(StatusCodes.BadOutOfRange);
                        callback(err);
                    });
                }
                , function (callback) {
                    callback();
                }
            ], done);

        });
    });

};

