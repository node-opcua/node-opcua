require("requirish")._(module);

var schema_helpers =  require("lib/misc/factories_schema_helpers");
schema_helpers.doDebug = true;


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


describe("DataAccess", function () {

    var engine;
    engine = new server_engine.ServerEngine();

    before(function (done) {

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

    it("should find a BaseDataVariableType in the addressSpace", function () {
        var baseDataVariableType = engine.addressSpace.findVariableType("BaseDataVariableType");
        baseDataVariableType.browseName.toString().should.eql("BaseDataVariableType");
        //xx baseDataVariableType.isAbstract.should.eql(true); ?
    });

    it("should find a DataItemType in the addressSpace", function () {
        var dataItemType = engine.addressSpace.findVariableType("DataItemType");
        dataItemType.browseName.toString().should.eql("DataItemType");
        //xxx dataItemType.isAbstract.should.eql(true);
    });

    it("should find a ArrayItemType in the addressSpace", function () {
        var arrayItemType = engine.addressSpace.findVariableType("ArrayItemType");
        arrayItemType.browseName.toString().toString().should.eql("ArrayItemType");
    });

    it("should find a AnalogItemType in the addressSpace", function () {
        var analogItemType = engine.addressSpace.findVariableType("AnalogItemType");
        analogItemType.browseName.toString().should.eql("AnalogItemType");
    });
    it("should find a DiscreteItemType in the addressSpace", function () {
        var discreteItemType = engine.addressSpace.findVariableType("DiscreteItemType");
        discreteItemType.browseName.toString().should.eql("DiscreteItemType");
        discreteItemType.isAbstract.should.eql(true);
    });

    it("should find a TwoStateDiscreteType in the addressSpace", function () {
        var twoStateDiscreteType = engine.addressSpace.findVariableType("TwoStateDiscreteType");
        twoStateDiscreteType.browseName.toString().should.eql("TwoStateDiscreteType");
    });
    it("should find a MultiStateDiscreteType in the addressSpace", function () {
        var multiStateDiscreteType = engine.addressSpace.findVariableType("MultiStateDiscreteType");
        multiStateDiscreteType.browseName.toString().should.eql("MultiStateDiscreteType");
    });

    it("should find a MultiStateValueDiscreteType in the addressSpace", function () {
        var multiStateValueDiscreteType = engine.addressSpace.findVariableType("MultiStateValueDiscreteType");
        multiStateValueDiscreteType.browseName.toString().should.eql("MultiStateValueDiscreteType");
    });


    it("should find a EUInformation in the addressSpace", function () {
        var _EUInformation = engine.addressSpace.findDataType("EUInformation");
        _EUInformation.browseName.toString().should.eql("EUInformation");
    });

    it("should find a Range in the addressSpace", function () {
        var range = engine.addressSpace.findDataType("Range");
        range.browseName.toString().should.eql("Range");
    });

    it("should have a UAVariableType XYArrayItemType", function () {
        var xyArrayItemType = engine.addressSpace.findVariableType("XYArrayItemType");
        xyArrayItemType.arrayDimensions.should.eql([0]);
    });

    it("should have a ImageItemType ", function () {
        var xyArrayItemType = engine.addressSpace.findVariableType("ImageItemType");
        xyArrayItemType.arrayDimensions.should.eql([0, 0]);
    });

    it("should have a CubeItemType ", function () {
        var xyArrayItemType = engine.addressSpace.findVariableType("CubeItemType");
        xyArrayItemType.arrayDimensions.should.eql([0, 0, 0]);
    });

    it("should encode and decode a string containing fancy characters", function (done) {
        var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
        var engineeringUnits = standardUnits.degree_celsius;
        encode_decode_round_trip_test(engineeringUnits, function (buffer, id) {
            buffer.length.should.equal(82);
            done();
        });

    });

    require("./subtest_analog_item_type")(engine);

    require("./subtest_data_item_PercentDeadband")(engine);

    require("./subtest_two_state_discrete_type")(engine);

    require("./subtest_multi_state_discrete_type")(engine);

    require("./subtest_multi_state_value_discrete_type")(engine);

    require("./subtest_Y_array_item_type")(engine);
});


var commonCodeToUInt = require("lib/data_access/EUInformation").commonCodeToUInt;

describe("commonCodeToUInt", function () {

    it("commonCodeToUInt - CEL = °C = degree Celsius", function () {

        var unitId = commonCodeToUInt("CEL"); // °C
        unitId.should.eql(4408652);
    });

    it("commonCodeToUInt - LTR = l =  liter", function () {
        var unitId = commonCodeToUInt("LTR"); // °C
        unitId.should.eql(5002322);
    });
    it("commonCodeToUInt - BQL = Bq =  Becquerel = 27,027 x 1E-12 Ci  ", function () {
        var unitId = commonCodeToUInt("BQL"); // °C
        unitId.should.eql(4346188);
    });
    it("commonCodeToUInt - CUR = Ci = Curie = 3,7 x 1E10 Bq ", function () {
        var unitId = commonCodeToUInt("CUR"); // °C
        unitId.should.eql(4412754);
    });
    it("commonCodeToUInt - A53 = eV = ElectronVolt = 1,602 177 33 1E-19 J  ", function () {
        var unitId = commonCodeToUInt("A53"); // °C
        unitId.should.eql(4273459);
    });
    it("commonCodeToUInt - B71 = MeV = megaelectronvolt = 1E6 eV  ", function () {
        var unitId = commonCodeToUInt("B71"); // °C
        unitId.should.eql(4339505);
    });
    it("commonCodeToUInt - STL = l = standard liter", function () {
        var unitId = commonCodeToUInt("STL"); // °C
        unitId.should.eql(5461068);
    });
    it("commonCodeToUInt - A97 = hPa = hecto pascal", function () {
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

