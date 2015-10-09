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
var addAnalogDataItem = require("lib/data_access/UAAnalogItem").addAnalogDataItem;
var addTwoStateDiscreteType = require("lib/data_access/UATwoStateDiscreteType").addTwoStateDiscreteType;



describe("TwoStateDiscreteType", function () {

    var engine;
    before(function (done) {

        engine = new server_engine.ServerEngine();

        var xmlFiles = [
            path.join(__dirname, "../../lib/server/mini.Node.Set2.xml"),
            path.join(__dirname, "../../nodesets/Opc.Ua.NodeSet2.Part8.xml")
        ];
        var options = {nodeset_filename: xmlFiles};

        engine.initialize(options, function () {

            done();
        });

    });

    after(function () {
        engine.shutdown();
        engine = null;
    });


    it("should add a TwoStateDiscreteType variable",function() {

        var address_space = engine.address_space;
        var rootFolder = address_space.findObject("ObjectsFolder");
        rootFolder.browseName.toString().should.eql("Objects");

        var prop = addTwoStateDiscreteType(rootFolder,{
            browseName: "MySwitch",
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
