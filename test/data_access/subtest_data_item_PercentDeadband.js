require("requirish")._(module);
var _ = require("underscore");
var should = require("should");
import ServerEngine from "lib/server/ServerEngine";

var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var EUInformation = require("lib/data_access/EUInformation").EUInformation;
var Range = require("lib/data_access/Range").Range;
var standardUnits = require("lib/data_access/EUInformation").standardUnits;

var async = require("async");

var path = require("path");



module.exports = function (engine) {

    describe("PercentDeadband", function () {

        it("should provide a mechanism to operate PercentDeadband ", function (done) {

            var addressSpace = engine.addressSpace;

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
                    analogItem.writeValue(dataValue, null, function (err, statusCode) {
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

