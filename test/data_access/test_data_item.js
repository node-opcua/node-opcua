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
var Range =  require("lib/data_access/Range").Range;



var path = require("path");

describe("DataAccess", function () {

    var engine;
    before(function (done) {

        engine = new server_engine.ServerEngine();

        var xmlFiles = [
            path.join(__dirname,"../../lib/server/mini.Node.Set2.xml"),
            path.join(__dirname ,"../../nodesets/Opc.Ua.NodeSet2.Part8.xml")
        ] ;
        var options = { nodeset_filename: xmlFiles };

        engine.initialize(options, function () {

            done();
        });

    });
    after(function () {
        engine.shutdown();
        engine = null;
    });

    // BaseDataVariableType
    //         |
    //         +----------------------------+
    //                                      |
    //                                 DataItemType
    //                                        |
    //      +---------------------------------+--------------------------------+
    //      |                                 |                                |
    // arrayItemType                     AnalogItemType                     discreteItemType
    //                                                                           |
    //                                                                           |
    //                                           +-----------------+-------------+-----+
    //                                           |                 |                   |
    //                                TwoStateDiscreteType  MultiStateDiscreteType  MultiStateValueDiscreteType

    it("should find a BaseDataVariableType in the address_space",function(){
        var baseDataVariableType = engine.address_space.findVariableType("BaseDataVariableType");
        baseDataVariableType.browseName.should.eql("BaseDataVariableType");
        //xx baseDataVariableType.isAbstract.should.eql(true); ?
    });

    it("should find a DataItemType in the address_space",function(){
        var dataItemType = engine.address_space.findVariableType("DataItemType");
        dataItemType.browseName.should.eql("DataItemType");
        //xxx dataItemType.isAbstract.should.eql(true);
    });

    it("should find a ArrayItemType in the address_space",function(){
        var arrayItemType = engine.address_space.findVariableType("ArrayItemType");
        arrayItemType.browseName.should.eql("ArrayItemType");
    });

    it("should find a AnalogItemType in the address_space",function(){
        var analogItemType = engine.address_space.findVariableType("AnalogItemType");
        analogItemType.browseName.should.eql("AnalogItemType");
    });
    it("should find a DiscreteItemType in the address_space",function(){
        var discreteItemType = engine.address_space.findVariableType("DiscreteItemType");
        discreteItemType.browseName.should.eql("DiscreteItemType");
        discreteItemType.isAbstract.should.eql(false);
    });

    it("should find a TwoStateDiscreteType in the address_space",function(){
        var twoStateDiscreteType = engine.address_space.findVariableType("TwoStateDiscreteType");
        twoStateDiscreteType.browseName.should.eql("TwoStateDiscreteType");
    });
    it("should find a MultiStateDiscreteType in the address_space",function(){
        var multiStateDiscreteType = engine.address_space.findVariableType("MultiStateDiscreteType");
        multiStateDiscreteType.browseName.should.eql("MultiStateDiscreteType");
    });

    it("should find a MultiStateValueDiscreteType in the address_space",function(){
        var multiStateValueDiscreteType = engine.address_space.findVariableType("MultiStateValueDiscreteType");
        multiStateValueDiscreteType.browseName.should.eql("MultiStateValueDiscreteType");
    });


    it("should find a EUInformation in the address_space",function(){
        var _EUInformation = engine.address_space.findDataType("EUInformation");
        _EUInformation.browseName.should.eql("EUInformation");
    });

    it("should find a Range in the address_space",function(){
        var range = engine.address_space.findDataType("Range");
        range.browseName.should.eql("Range");
    });

   var addAnalogDataItem = require("lib/data_access/UAAnalogItem").addAnalogDataItem;

    it("should create a analogItemType",function() {

        var address_space = engine.address_space;

        var rootFolder = address_space.findObject("ObjectsFolder");
        rootFolder.browseName.should.eql("Objects");

        var analogItem = addAnalogDataItem(rootFolder,{
              browseName: "TemperatureSensor",
              definition: "(tempA -25) + tempB",
              valuePrecision: 0.5,
              engineeringUnitsRange: { low: 100 , high: 200},
              instrumentRange: { low: -100 , high: +200},
              engineeringUnits: "Celsius"
        });

        //xx console.log(JSON.stringify(analogItem,null," "));
        analogItem.dataType.should.eql(address_space.findVariableType("AnalogItemType").nodeId);
        analogItem.definition.browseName.should.eql("Definition");
        analogItem.valuePrecision.browseName.should.eql("ValuePrecision");
        analogItem.eURange.browseName.should.eql("EURange");
        analogItem.instrumentRange.browseName.should.eql("InstrumentRange");
        analogItem.engineeringUnits.browseName.should.eql("EngineeringUnits");


        // accessing data with shortcuts
        analogItem.$instrumentRange.low.should.eql(-100);
        analogItem.$instrumentRange.high.should.eql(200);

        // accessing data from nodeId
        var dataValue = engine.readSingleNode(analogItem.instrumentRange.nodeId,AttributeIds.Value);
        //xx console.log("value",dataValue);
        dataValue.statusCode.should.eql(StatusCodes.Good);
        dataValue.value.dataType.should.eql(DataType.ExtensionObject);
        dataValue.value.value.should.be.instanceOf(Range);
        dataValue.value.value.low.should.eql(-100);

        it("should bhal",function(){
            dataValue.value.value.high.should.eql(200);

        })

    })
});

