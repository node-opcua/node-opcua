require("requirish")._(module);
var _ = require("underscore");
var should = require("should");
var server_engine = require("lib/server/server_engine");

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

var addMultiStateDiscreteType = require("lib/data_access/UAMultiStateDiscreteType").addMultiStateDiscreteType;

module.exports = function(engine) {

    describe("MultiStateDiscreteType", function () {


        it("should add a MultiStateDiscreteType variable",function() {

            var address_space = engine.address_space;
            var rootFolder = address_space.findObject("ObjectsFolder");
            rootFolder.browseName.toString().should.eql("Objects");

            var prop = addTwoStateDiscreteType(rootFolder,{
                browseName: "MyMultiStateVariable",
                trueState: "busy",
                falseState: "idle",
                value: false
            });
            prop.browseName.toString().should.eql("MySwitch");

            prop.getPropertyByName("TrueState").readValue().value.toString()
                .should.eql("Variant(Scalar<LocalizedText>, value: locale=null text=busy)");

            prop.getPropertyByName("FalseState").readValue().value.toString()
                .should.eql("Variant(Scalar<LocalizedText>, value: locale=null text=idle)");

            prop.readValue().value.toString().should.eql("Variant(Scalar<Boolean>, value: false)");
        });

    });

};
