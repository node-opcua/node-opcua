import * as fs from "fs";

import * as mocha from "mocha";
import * as should from "should";

import { standardUnits } from "node-opcua-data-access";
import { nodesets } from "node-opcua-nodesets";
import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";

import { AddressSpace } from "../..";
import { generateAddressSpace } from "../../nodeJS";

import { subtest_analog_item_semantic_changed } from "./subtest_analog_item_semantic_changed";
import { subtest_analog_item_type } from "./subtest_analog_item_type";
import { subtest_data_item_PercentDeadband } from "./subtest_data_item_PercentDeadband";
import { subtest_multi_state_discrete_type } from "./subtest_multi_state_discrete_type";
import { subtest_multi_state_value_discrete_type } from "./subtest_multi_state_value_discrete_type";
import { subtest_two_state_discrete_type } from "./subtest_two_state_discrete_type";
import { subtest_Y_array_item_type } from "./subtest_Y_array_item_type";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("DataAccess", () => {
    let addressSpace: AddressSpace;
    const data = { addressSpace: null as any };
    before(async () => {
        addressSpace = AddressSpace.create();

        addressSpace.registerNamespace("MyPrivateNamespace");
        data.addressSpace = addressSpace;
        const xmlFiles = [nodesets.standard];
        fs.existsSync(xmlFiles[0]).should.eql(true);
        await generateAddressSpace(addressSpace, xmlFiles);
    });

    after(() => {
        addressSpace.shutdown();
        addressSpace.dispose();
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

    it("should find a BaseDataVariableType in the addressSpace", () => {
        const baseDataVariableType = addressSpace.findVariableType("BaseDataVariableType")!;
        baseDataVariableType.browseName.toString().should.eql("BaseDataVariableType");
        // xx baseDataVariableType.isAbstract.should.eql(true); ?
    });

    it("should find a DataItemType in the addressSpace", () => {
        const dataItemType = addressSpace.findVariableType("DataItemType")!;
        dataItemType.browseName.toString().should.eql("DataItemType");
        // xxx dataItemType.isAbstract.should.eql(true);
    });

    it("should find a ArrayItemType in the addressSpace", () => {
        const arrayItemType = addressSpace.findVariableType("ArrayItemType")!;
        arrayItemType.browseName.toString().toString().should.eql("ArrayItemType");
    });

    it("should find a AnalogItemType in the addressSpace", () => {
        const analogItemType = addressSpace.findVariableType("AnalogItemType")!;
        analogItemType.browseName.toString().should.eql("AnalogItemType");
    });

    it("should find a DiscreteItemType in the addressSpace", () => {
        const discreteItemType = addressSpace.findVariableType("DiscreteItemType")!;
        discreteItemType.browseName.toString().should.eql("DiscreteItemType");
        discreteItemType.isAbstract.should.eql(true);
    });

    it("should find a TwoStateDiscreteType in the addressSpace", () => {
        const twoStateDiscreteType = addressSpace.findVariableType("TwoStateDiscreteType")!;
        twoStateDiscreteType.browseName.toString().should.eql("TwoStateDiscreteType");
    });
    it("should find a MultiStateDiscreteType in the addressSpace", () => {
        const multiStateDiscreteType = addressSpace.findVariableType("MultiStateDiscreteType")!;
        multiStateDiscreteType.browseName.toString().should.eql("MultiStateDiscreteType");
    });

    it("should find a MultiStateValueDiscreteType in the addressSpace", () => {
        const multiStateValueDiscreteType = addressSpace.findVariableType("MultiStateValueDiscreteType")!;
        multiStateValueDiscreteType.browseName.toString().should.eql("MultiStateValueDiscreteType");
    });

    it("should find a EUInformation in the addressSpace", () => {
        const _EUInformation = addressSpace.findDataType("EUInformation")!;
        _EUInformation.browseName.toString().should.eql("EUInformation");
    });

    it("should find a Range in the addressSpace", () => {
        const range = addressSpace.findDataType("Range")!;
        range.browseName.toString().should.eql("Range");
    });

    it("should have a UAVariableType XYArrayItemType", () => {
        const xyArrayItemType = addressSpace.findVariableType("XYArrayItemType")!;
        xyArrayItemType.arrayDimensions!.should.eql([0]);
    });

    it("should have a ImageItemType ", () => {
        const xyArrayItemType = addressSpace.findVariableType("ImageItemType")!;
        xyArrayItemType.arrayDimensions!.should.eql([0, 0]);
    });

    it("should have a CubeItemType ", () => {
        const xyArrayItemType = addressSpace.findVariableType("CubeItemType")!;
        xyArrayItemType.arrayDimensions!.should.eql([0, 0, 0]);
    });

    it("should encode and decode a string containing fancy characters", (done: any) => {
        const engineeringUnits = standardUnits.degree_celsius;
        encode_decode_round_trip_test(engineeringUnits, (buffer: Buffer) => {
            buffer.length.should.equal(82);
            done();
        });
    });

    subtest_analog_item_type(data);
    subtest_data_item_PercentDeadband(data);
    subtest_Y_array_item_type(data);
    subtest_analog_item_semantic_changed(data);

    subtest_two_state_discrete_type(data);
    subtest_multi_state_discrete_type(data);
    subtest_multi_state_value_discrete_type(data);
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
// problems if the client uses the value to perform calculations)  Properties  are changed (see section
// 5.2  for additional information).

// todo:
// AnalogItemType must have EURange properties
