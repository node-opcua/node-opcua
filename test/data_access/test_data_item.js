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
var standardUnits = require("lib/data_access/EUInformation").standardUnits;

var async = require("async");

var path = require("path");
var addAnalogDataItem = require("lib/data_access/UAAnalogItem").addAnalogDataItem;
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

    it("should have a UAVariableType XYArrayItemType",function() {
        var xyArrayItemType = engine.address_space.findVariableType("XYArrayItemType");
        xyArrayItemType.arrayDimensions.should.eql([0]);
    });

    it("should have a ImageItemType ",function() {
        var xyArrayItemType = engine.address_space.findVariableType("ImageItemType");
        xyArrayItemType.arrayDimensions.should.eql([0,0]);
    });

    it("should have a CubeItemType ",function() {
        var xyArrayItemType = engine.address_space.findVariableType("CubeItemType");
        xyArrayItemType.arrayDimensions.should.eql([0,0,0]);
    });

    it("should create a analogItemType",function(done) {

        var address_space = engine.address_space;

        var rootFolder = address_space.findObject("ObjectsFolder");
        rootFolder.browseName.should.eql("Objects");

        var fakeValue = 1;

        var analogItem = addAnalogDataItem(rootFolder,{
              browseName: "TemperatureSensor",
              definition: "(tempA -25) + tempB",
              valuePrecision: 0.5,
              engineeringUnitsRange: { low: 100 , high: 200},
              instrumentRange: { low: -100 , high: +200},
              engineeringUnits: standardUnits.degree_celsius,

              dataType: "Double",
              value: {
                  get: function(){
                      return new Variant({
                          dataType: DataType.Double,
                          value: fakeValue
                      });
                  }
              }

        });

        //xx console.log(JSON.stringify(analogItem,null," "));
        // analogItem.dataType.should.eql(address_space.findVariableType("AnalogItemType").nodeId);

        analogItem.definition.browseName.should.eql("Definition");
        analogItem.valuePrecision.browseName.should.eql("ValuePrecision");
        analogItem.eURange.browseName.should.eql("EURange");
        analogItem.instrumentRange.browseName.should.eql("InstrumentRange");
        analogItem.engineeringUnits.browseName.should.eql("EngineeringUnits");


        // accessing data with shortcuts
        analogItem.$instrumentRange.low.should.eql(-100);
        analogItem.$instrumentRange.high.should.eql(200);

        // browsing variable
        var browseDescription = {
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: 0,
            resultMask: 0x3F
        };
        var browseResult = engine.browseSingleNode(analogItem.nodeId, browseDescription);
        browseResult.references.length.should.eql(6);

        async.series([

            function (callback){
                analogItem.instrumentRange.readValueAsync(function(err,dataValue){
                    if (!err) {
                        dataValue.statusCode.should.eql(StatusCodes.Good);
                        dataValue.value.dataType.should.eql(DataType.ExtensionObject);
                        dataValue.value.value.should.be.instanceOf(Range);
                        dataValue.value.value.low.should.eql(-100);
                        dataValue.value.value.high.should.eql(200);
                    }
                    callback(err);
                });

            },

            function (callback){
                console.log(analogItem._dataValue);
                analogItem.readValueAsync(function(err,dataValue){
                    if (!err) {
                        dataValue.statusCode.should.eql(StatusCodes.Good);
                        dataValue.value.dataType.should.eql(DataType.Double);
                        dataValue.value.value.should.eql(fakeValue);
                    }
                    callback(err);
                });
            },
            function (callback) {

                fakeValue = 2.0;

                analogItem.readValueAsync(function(err,dataValue){
                    console.log(analogItem._dataValue);
                    if (!err) {
                        dataValue.statusCode.should.eql(StatusCodes.Good);
                        dataValue.value.dataType.should.eql(DataType.Double);
                        dataValue.value.value.should.eql(fakeValue);
                    }
                    callback(err);
                });
            }

        ],done);


    });
    it("should encode and decode a string containing fancy characters",function() {
        var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

        var engineeringUnits =  standardUnits.degree_celsius;
        encode_decode_round_trip_test(engineeringUnits,function (buffer, id) {
            buffer.length.should.equal(35);
        })

    });

    it("Writing a value exceeding InstrumentRange shall return BadOutOfRange",function(done) {

        var address_space = engine.address_space;

        var rootFolder = address_space.findObject("ObjectsFolder");

        var analogItem = addAnalogDataItem(rootFolder,{
            browseName: "TemperatureSensor",
            definition: "(tempA -25) + tempB",
            valuePrecision: 0.5,
            engineeringUnitsRange: { low: -2000 , high: 2000},
            instrumentRange:       { low:  -100 , high:  200},
            engineeringUnits: standardUnits.degree_celsius,
            dataType: "Double",
            value:  new Variant({dataType: DataType.Double,value: 10.0})
        });

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.Double,value: -1000.0})// out of range
        });

        analogItem.writeValue(dataValue,null,function(err,statusCode){
            statusCode.should.eql(StatusCodes.BadOutOfRange);
            done(err);
        });

    });

    it("Writing a value within InstrumentRange shall return Good",function(done) {

        var address_space = engine.address_space;
        var rootFolder = address_space.findObject("ObjectsFolder");

        var analogItem = addAnalogDataItem(rootFolder,{
            browseName: "TemperatureSensor",
            definition: "(tempA -25) + tempB",
            valuePrecision: 0.5,
            engineeringUnitsRange: { low: -2000 , high: 2000},
            instrumentRange:       { low:  -100 , high:  200},
            engineeringUnits: standardUnits.degree_celsius,
            dataType: "Double",
            value:  new Variant({dataType: DataType.Double,value: 10.0})
        });

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.Double,value: 150})// in range
        });

        analogItem.writeValue(dataValue,null,function(err,statusCode){
            statusCode.should.eql(StatusCodes.Good);
            done(err);
        });

    });

});


var commonCodeToUInt = require("lib/data_access/EUInformation").commonCodeToUInt;

describe("commonCodeToUInt",function() {

    it("commonCodeToUInt - CEL = °C = degree Celsius",function() {

        var unitId = commonCodeToUInt("CEL"); // °C
        unitId.should.eql(4408652);
    });

    it("commonCodeToUInt - LTR = l =  liter",function() {
        var unitId = commonCodeToUInt("LTR"); // °C
        unitId.should.eql(5002322);
    });
    it("commonCodeToUInt - BQL = Bq =  Becquerel = 27,027 x 1E-12 Ci  ",function() {
        var unitId = commonCodeToUInt("BQL"); // °C
        unitId.should.eql(4346188);
    });
    it("commonCodeToUInt - CUR = Ci = Curie = 3,7 x 1E10 Bq ",function() {
        var unitId = commonCodeToUInt("CUR"); // °C
        unitId.should.eql(4412754);
    });
    it("commonCodeToUInt - A53 = eV = ElectronVolt = 1,602 177 33 1E-19 J  ",function() {
        var unitId = commonCodeToUInt("A53"); // °C
        unitId.should.eql(4273459);
    });
    it("commonCodeToUInt - B71 = MeV = megaelectronvolt = 1E6 eV  ",function() {
        var unitId = commonCodeToUInt("B71"); // °C
        unitId.should.eql(4339505);
    });
    it("commonCodeToUInt - STL = l = standard liter",function() {
        var unitId = commonCodeToUInt("STL"); // °C
        unitId.should.eql(5461068);
    });
    it("commonCodeToUInt - A97 = hPa = hecto pascal",function() {
        var unitId = commonCodeToUInt("A97"); // °C
        unitId.should.eql(4274487);
    });

});


// todo :
// 5.2  SemanticsChanged
// The StatusCode  also contains an informational bit called  SemanticsChanged.
// Servers  that implement Data Access  shall  set this Bit in notifications if  certain  Properties   defined in
// this standard  change. The corresponding  Properties  are specified individually for each  VariableType.
// Clients  that use any of these  Properties   should re- read them before they process the data value .
// Part 8 5.3.2
// The  StatusCode SemanticsChanged  bit shall be set if any of the  EURange  ( could change the
// behaviour of a  Subscription  if a  PercentDeadband  filter is used)   or  EngineeringUnits  (could create
// problems if the client uses the value to perform calcul ations)  Properties  are changed (see section
// 5.2  for additional information).

// todo:
// AnalogItemType must have EURange properties

