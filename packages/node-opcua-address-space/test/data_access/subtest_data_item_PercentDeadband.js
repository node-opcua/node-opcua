"use strict";
const async = require("async");
const should = require("should");

const DataValue =  require("node-opcua-data-value").DataValue;
const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;
const StatusCodes = require("node-opcua-status-code").StatusCodes;

const standardUnits = require("node-opcua-data-access").standardUnits;

const SessionContext = require("../..").SessionContext;
const context = SessionContext.defaultContext;

const AddressSpace = require("../../").AddressSpace;

module.exports = function (maintest) {

    describe("PercentDeadband", function () {

        let addressSpace;
        before(function() {
            addressSpace = maintest.addressSpace;
            should(addressSpace).be.instanceof(AddressSpace);
        });

        it("should provide a mechanism to operate PercentDeadband ", function (done) {

            const objectsFolder = addressSpace.findNode("ObjectsFolder");

            const analogItem = addressSpace.addAnalogDataItem({
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


            const dataValue = new DataValue({value: new Variant({dataType: DataType.Double, value: -1000.0})});

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

