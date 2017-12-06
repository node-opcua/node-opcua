"use strict";

var should = require("should");
var path = require("path");
var fs= require("fs");


var standardUnits = require("node-opcua-data-access").standardUnits;

var nodesets = require("node-opcua-nodesets");

var AddressSpace = require("../../").AddressSpace;
var generate_address_space = require("../..").generate_address_space;


describe("DataAccess", function () {


    var addressSpace;
    var data = { };
    before(function (done) {
        addressSpace = new AddressSpace();
        data.addressSpace = addressSpace;

        var xmlFiles = [
            nodesets.standard_nodeset_file
        ];
        fs.existsSync(xmlFiles[0]).should.eql(true);
        generate_address_space(addressSpace,xmlFiles,done);

    });

    after(function () {
        addressSpace.shutdown();
        addressSpace.dispose();
        addressSpace = null;
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
        var baseDataVariableType = addressSpace.findVariableType("BaseDataVariableType");
        baseDataVariableType.browseName.toString().should.eql("BaseDataVariableType");
        //xx baseDataVariableType.isAbstract.should.eql(true); ?
    });

    it("should find a DataItemType in the addressSpace", function () {
        var dataItemType = addressSpace.findVariableType("DataItemType");
        dataItemType.browseName.toString().should.eql("DataItemType");
        //xxx dataItemType.isAbstract.should.eql(true);
    });

    it("should find a ArrayItemType in the addressSpace", function () {
        var arrayItemType = addressSpace.findVariableType("ArrayItemType");
        arrayItemType.browseName.toString().toString().should.eql("ArrayItemType");
    });

    it("should find a AnalogItemType in the addressSpace", function () {
        var analogItemType = addressSpace.findVariableType("AnalogItemType");
        analogItemType.browseName.toString().should.eql("AnalogItemType");
    });
    it("should find a DiscreteItemType in the addressSpace", function () {
        var discreteItemType = addressSpace.findVariableType("DiscreteItemType");
        discreteItemType.browseName.toString().should.eql("DiscreteItemType");
        discreteItemType.isAbstract.should.eql(true);
    });

    it("should find a TwoStateDiscreteType in the addressSpace", function () {
        var twoStateDiscreteType = addressSpace.findVariableType("TwoStateDiscreteType");
        twoStateDiscreteType.browseName.toString().should.eql("TwoStateDiscreteType");
    });
    it("should find a MultiStateDiscreteType in the addressSpace", function () {
        var multiStateDiscreteType = addressSpace.findVariableType("MultiStateDiscreteType");
        multiStateDiscreteType.browseName.toString().should.eql("MultiStateDiscreteType");
    });

    it("should find a MultiStateValueDiscreteType in the addressSpace", function () {
        var multiStateValueDiscreteType = addressSpace.findVariableType("MultiStateValueDiscreteType");
        multiStateValueDiscreteType.browseName.toString().should.eql("MultiStateValueDiscreteType");
    });


    it("should find a EUInformation in the addressSpace", function () {
        var _EUInformation = addressSpace.findDataType("EUInformation");
        _EUInformation.browseName.toString().should.eql("EUInformation");
    });

    it("should find a Range in the addressSpace", function () {
        var range = addressSpace.findDataType("Range");
        range.browseName.toString().should.eql("Range");
    });

    it("should have a UAVariableType XYArrayItemType", function () {
        var xyArrayItemType = addressSpace.findVariableType("XYArrayItemType");
        xyArrayItemType.arrayDimensions.should.eql([0]);
    });

    it("should have a ImageItemType ", function () {
        var xyArrayItemType = addressSpace.findVariableType("ImageItemType");
        xyArrayItemType.arrayDimensions.should.eql([0, 0]);
    });

    it("should have a CubeItemType ", function () {
        var xyArrayItemType = addressSpace.findVariableType("CubeItemType");
        xyArrayItemType.arrayDimensions.should.eql([0, 0, 0]);
    });

    it("should encode and decode a string containing fancy characters", function (done) {
        var encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test
        var engineeringUnits = standardUnits.degree_celsius;
        encode_decode_round_trip_test(engineeringUnits, function (buffer, id) {
            buffer.length.should.equal(82);
            done();
        });

    });

    require("./subtest_analog_item_type")(data);

    require("./subtest_data_item_PercentDeadband")(data);

    require("./subtest_two_state_discrete_type")(data);

    require("./subtest_multi_state_discrete_type")(data);

    require("./subtest_multi_state_value_discrete_type")(data);

    require("./subtest_Y_array_item_type")(data);

    require("./subtest_analog_item_semantic_changed")(data);
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

