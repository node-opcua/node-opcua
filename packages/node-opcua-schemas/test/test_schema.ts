// tslint:disable:no-console
import * as fs from "fs";
import * as path from "path";
import * as should from "should";
import { promisify } from "util";

import * as mocha from "mocha";
import { BinaryStream } from "node-opcua-binary-stream";
import { coerceLocalizedText, LocalizedText } from "node-opcua-data-model";
import { hexDump } from "node-opcua-debug";
import {
    DataTypeFactory,
    parameters
} from "node-opcua-factory";
import { DataType, Variant } from "node-opcua-variant";

import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/test_helpers";

import {
    getOrCreateConstructor,
    parseBinaryXSDAsync
} from "..";

import { MockProvider } from "./mock_id_provider";

const doDebug = false;

const idProvider = new MockProvider();
// ts-lint:disable:no-string-literal
describe("BSHA - Binary Schemas Helper 1", () => {

    let dataTypeFactory: DataTypeFactory;
    let old_schema_helpers_doDebug = false;
    before(async () => {
        const sample_file = path.join(__dirname, "fixtures/sample_type.xsd");

        old_schema_helpers_doDebug = parameters.debugSchemaHelper;
        parameters.debugSchemaHelper = true;
        const sample = fs.readFileSync(sample_file, "ascii");
        dataTypeFactory = await parseBinaryXSDAsync(sample, [], idProvider);
    });

    after(() => {
        parameters.debugSchemaHelper = old_schema_helpers_doDebug;
    });

    it("BSH1 - should parse some structure types", async () => {
        dataTypeFactory.hasStructuredType("WorkOrderType").should.eql(true);
    });
    it("BSH2 - should parse some enumerated types", async () => {
        dataTypeFactory.hasEnumeration("Priority").should.eql(true);
    });
    it("BSH3 - should construct a dynamic object structure", () => {

        const WorkOrderType = getOrCreateConstructor("WorkOrderType", dataTypeFactory);

        const workOrderType = new WorkOrderType({
            assetID: "AssetId1234",
            iD: "00000000-0000-0000-ABCD-000000000000",
            startTime: new Date(),
            statusComments: [{
                actor: "Foo",
                comment: /* localized text*/ new LocalizedText({ text: "bar" }),
                timestamp: new Date()
            }]
        });

        workOrderType.assetID.should.eql("AssetId1234");
        if (doDebug) {
            console.log(workOrderType.toString());
        }
        encode_decode_round_trip_test(workOrderType, (stream: BinaryStream) => {
            if (doDebug) {
                console.log(hexDump(stream.buffer));
            }
            stream.length.should.equal(66);
        });
    });

    it("BSH4 - should handle StructureWithOptionalFields - 1", () => {

        const StructureWithOptionalFields = getOrCreateConstructor("StructureWithOptionalFields", dataTypeFactory);

        const structureWithOptionalFields1 = new StructureWithOptionalFields({
            mandatoryInt32: 42,
            mandatoryStringArray: ["a"]
        });

        should(structureWithOptionalFields1.optionalInt32).eql(undefined);
        should(structureWithOptionalFields1.optionalStringArray).eql(undefined);

        if (doDebug) {
            console.log((StructureWithOptionalFields as any).schema);
        }
        encode_decode_round_trip_test(structureWithOptionalFields1, (buffer: Buffer) => {
            if (doDebug) {
                console.log(hexDump(buffer));
            }

            // 32 bits   (4)     => bitfield
            buffer.readInt32LE(0).should.eql(0);
            // 32 bits   (4)     => mandatoryInt32
            buffer.readInt32LE(4).should.eql(42);
            // 32 bits   (4)     => length mandatoryStringArray
            buffer.readInt32LE(8).should.eql(1);
            // 32 bits+1 (5)     => element 1
            buffer.readInt32LE(12).should.eql(1);

            buffer.length.should.equal(17, "expected stream length to be 17 bytes");
        });
    });
    it("BSH5 - should handle StructureWithOptionalFields - 2", () => {

        const StructureWithOptionalFields = getOrCreateConstructor("StructureWithOptionalFields", dataTypeFactory);
        const structureWithOptionalFields2 = new StructureWithOptionalFields({
            mandatoryInt32: 42,
            mandatoryStringArray: ["h"],
            optionalInt32: 43,
            optionalStringArray: ["a", "b"]
        });

        encode_decode_round_trip_test(structureWithOptionalFields2, (buffer: Buffer) => {
            if (doDebug) {
                console.log(hexDump(buffer));
            }
            // 32 bits   (4)     => bitfield
            buffer.readInt32LE(0).should.eql(3);
            // 32 bits   (4)     => mandatoryInt32
            buffer.readInt32LE(4).should.eql(42);
            // 32 bits   (4)     => optionalInt32
            buffer.readInt32LE(8).should.eql(43);
            // 32 bits   (4)     => length mandatoryStringArray
            // 32 bits+1 (5)     => element 1
            buffer.readInt32LE(12).should.eql(1);
            buffer.readInt32LE(16).should.eql(1);
            // 32 bits   (4)     => length optionalStringArray
            // 32 bits+1 (5)     => element 2
            buffer.readInt32LE(21).should.eql(2);
            buffer.readInt32LE(25).should.eql(1); // length of "a"
            buffer.readInt32LE(30).should.eql(1); // length of "b"
            buffer.length.should.equal(35);
        });

    });

});

describe("BSHB - Binary Schemas Helper 2", () => {

    let dataTypeFactory: DataTypeFactory;
    let old_schema_helpers_doDebug = false;
    before(async () => {
        const sample_file = path.join(__dirname, "fixtures/sample_type1.xsd");

        old_schema_helpers_doDebug = parameters.debugSchemaHelper;
        parameters.debugSchemaHelper = true;
        const sample = fs.readFileSync(sample_file, "ascii");
        dataTypeFactory = await parseBinaryXSDAsync(sample, [], idProvider);
    });

    after(() => {
        parameters.debugSchemaHelper = old_schema_helpers_doDebug;
    });

    it("BSHB1 - should parse some structure types", async () => {
        dataTypeFactory.hasStructuredType("SystemStateDescriptionDataType").should.eql(true);
    });

    it("BSHB2 - should parse some enumerated types", async () => {
        dataTypeFactory.hasEnumeration("SystemStateDataType").should.eql(true);
    });

    enum SystemStateEnum2 {
        PRD_1 = 1,
        SBY_2 = 2,
        ENG_3 = 3,
        SDT_4 = 4,
        UDT_5 = 5,
        NST_6 = 6,
    }

    it("BSHB3 - should construct a dynamic object structure 1", () => {

        const SystemStateDescriptionDataType = getOrCreateConstructor("SystemStateDescriptionDataType", dataTypeFactory);

        const SystemState = dataTypeFactory.getEnumeration("SystemStateDataType")!.enumValues as SystemStateEnum2;

        const systemStateDescription = new SystemStateDescriptionDataType({
            state: SystemStateEnum2.ENG_3,
            stateDescription: "Hello"
        });
        systemStateDescription.state.should.eql(SystemStateEnum2.ENG_3);

        encode_decode_round_trip_test(systemStateDescription, (buffer: Buffer) => {
            if (doDebug) {
                console.log(hexDump(buffer));
            }

            // 32 bits (4)     => bitfield
            // 32 bits (4)     => state
            // 32 bits + 5 (9) => stateDescription with 5 letter
            buffer.length.should.equal(17);
        });
    });
    it("BSHB4 - should construct a dynamic object structure 2", () => {

        const SystemStateDescriptionDataType = getOrCreateConstructor("SystemStateDescriptionDataType", dataTypeFactory);
        const systemStateDescription = new SystemStateDescriptionDataType({
            state: SystemStateEnum2.ENG_3
            // not specified ( can be omitted ) stateDescription: undefined
        });
        encode_decode_round_trip_test(systemStateDescription, (buffer: Buffer) => {
            // 32 bits => bitfield
            // 32 bits => state
            // 0  bits => stateDescription is missing
            buffer.length.should.equal(8);
        });
    });

});

describe("BSHC - Binary Schemas Helper 3 (with bit fields)", () => {

    let dataTypeFactory: DataTypeFactory;
    let old_schema_helpers_doDebug = false;
    before(async () => {
        const sample_file = path.join(__dirname, "fixtures/sample_type2.xsd");

        old_schema_helpers_doDebug = parameters.debugSchemaHelper;
        parameters.debugSchemaHelper = true;
        const sample = fs.readFileSync(sample_file, "ascii");
        dataTypeFactory = await parseBinaryXSDAsync(sample, [], idProvider);
    });

    after(() => {
        parameters.debugSchemaHelper = old_schema_helpers_doDebug;
    });

    it("BSHC1 - should parse ProcessingTimesDataType structure types", async () => {
        dataTypeFactory.hasStructuredType("ProcessingTimesDataType").should.eql(true);
        const ProcessingTimesDataType = dataTypeFactory.getStructuredTypeSchema("ProcessingTimesDataType");
        ProcessingTimesDataType.name.should.eql("ProcessingTimesDataType");
    });

    it("BSHC2 - should construct a dynamic object structure ProcessingTimesDataType - 1", () => {

        interface ProcessingTimes {
            startTime: Date;
            endTime: Date;
            acquisitionDuration?: number;
            processingDuration?: number;
        }

        const ProcessingTimesDataType = getOrCreateConstructor("ProcessingTimesDataType", dataTypeFactory);

        const processingTimes: ProcessingTimes = new ProcessingTimesDataType({
            endTime: new Date(Date.now() - 110),
            startTime: new Date(Date.now() - 150)
        });

        encode_decode_round_trip_test(processingTimes, (buffer: Buffer) => {
            if (doDebug) {
                console.log(hexDump(buffer));
            }
            // 32 bits (4)     => bitfield
            // 64 bits (8)     => startTime
            // 64 bits (8)     => endTime
            buffer.length.should.equal(20);
        });
    });

    it("BSHC3 - should construct a dynamic object structure ProcessingTimesDataType - 2", () => {

        const ProcessingTimesDataType = getOrCreateConstructor("ProcessingTimesDataType", dataTypeFactory);

        const processingTimes = new ProcessingTimesDataType({
            acquisitionDuration: 1000,
            endTime: new Date(Date.now() - 110),
            processingDuration: 500,
            startTime: new Date(Date.now() - 150)
        });
        encode_decode_round_trip_test(processingTimes, (buffer: Buffer) => {
            // 32 bits (4)     => bitfield
            // 64 bits (8)     => startTime
            // 64 bits (8)     => endTime
            // 64 bits (8)     => acquisitionDuration
            // 64 bits (8)     => processingDuration
            buffer.length.should.equal(36);
        });
    });

    it("BSHC4 - should construct a ConfigurationDataType - 1", () => {

        const ConfigurationDataType = getOrCreateConstructor("ConfigurationDataType", dataTypeFactory);

        const configuration = new ConfigurationDataType({
            externalId: {
                id: "SomeID1",
                major: 1
            },
            internalId: {
                id: "SomeID2",
                major: 1,
                minor: 2,
                version: "Version1",

                description: coerceLocalizedText("Some description")
            },
            lastModified: new Date(Date.now() - 1000),

            hasTransferableDataOnFile: undefined
        });
        configuration.internalId.description.should.eql(coerceLocalizedText("Some description"));

        const reloaded = encode_decode_round_trip_test(configuration, (buffer: Buffer) => {
            buffer.length.should.eql(87);
        });
        console.log(reloaded.toString());
        console.log(reloaded.toJSON());

    });

    it("BSHC5 - should construct a ResultDataType - 1", () => {

        const ResultDataType = getOrCreateConstructor("ResultDataType", dataTypeFactory);

        const result = new ResultDataType({
            resultContent: [
                new Variant({ dataType: DataType.Double, value: 1000 })
            ]
        });
        const reloaded = encode_decode_round_trip_test(result, (buffer: Buffer) => {
            buffer.length.should.eql(35);
        });
        console.log(reloaded.toString());
        console.log(reloaded.toJSON());

    });
});

describe("BSHD - Binary Schemas Helper 4", () => {

    let dataTypeFactory: DataTypeFactory;
    let old_schema_helpers_doDebug = false;
    before(async () => {
        const sample_file = path.join(__dirname, "fixtures/sample_type3.xsd");

        old_schema_helpers_doDebug = parameters.debugSchemaHelper;
        parameters.debugSchemaHelper = true;
        const sample = fs.readFileSync(sample_file, "ascii");
        dataTypeFactory = await parseBinaryXSDAsync(sample, [], idProvider);
    });

    after(() => {
        parameters.debugSchemaHelper = old_schema_helpers_doDebug;
    });

    it("BSHD1 - should parse NodeIdType structure types", async () => {
        dataTypeFactory.hasStructuredType("NodeId").should.eql(true);
    });

    it("BSHD2 - should construct a dynamic object structure ProcessingTimesDataType - 1", () => {
        //
    });
});

describe("BSHE - Binary Schemas Helper 5 (Union)", () => {

    let dataTypeFactory: DataTypeFactory;
    let old_schema_helpers_doDebug = false;
    before(async () => {
        const sample_file = path.join(__dirname, "fixtures/sample_type4.xsd");

        old_schema_helpers_doDebug = parameters.debugSchemaHelper;
        parameters.debugSchemaHelper = true;
        const sample = fs.readFileSync(sample_file, "ascii");
        dataTypeFactory = await parseBinaryXSDAsync(sample, [], idProvider);
    });

    after(() => {
        parameters.debugSchemaHelper = old_schema_helpers_doDebug;
    });

    it("BSHE1 - should parse ScanData union", async () => {

        const ScanData = getOrCreateConstructor("ScanData", dataTypeFactory);

        const scanData2a = new ScanData({ byteString: Buffer.allocUnsafe(10) });
        const scanData2b = new ScanData({ switchField: 1, byteString: Buffer.allocUnsafe(10) });
        const reloaded2b = encode_decode_round_trip_test(scanData2b, (buffer: Buffer) => {
            buffer.length.should.eql(4 + 4 + 10);
        });

        const scanData4a = new ScanData({ string: "Hello" });
        const scanData4b = new ScanData({ switchField: 2, string: "Hello" });
        const reloaded4b = encode_decode_round_trip_test(scanData4b, (buffer: Buffer) => {
            buffer.length.should.eql(4 + 4 + 5);
        });

        const scanData5a = new ScanData({ string: "36" });
        const scanData5b = new ScanData({ switchField: 3, value: 36 });
        const reloaded5b = encode_decode_round_trip_test(scanData5b, (buffer: Buffer) => {
            buffer.length.should.eql(8);
        });

        const scanData6a = new ScanData({ custom: { dataType: "Double", value: 36 } });
        const scanData6b = new ScanData({ switchField: 4, custom: { dataType: "Double", value: 36 } });
        const reloaded6b = encode_decode_round_trip_test(scanData6b, (buffer: Buffer) => {
            // buffer.length.should.eql(35);
        });
        console.log(reloaded6b.toString());
        reloaded6b.switchField.should.eql(4);
        reloaded6b.custom.dataType.should.eql(DataType.Double);
        reloaded6b.custom.value.should.eql(36);

        const scanData1 = new ScanData({}); // should throw
        const reloaded1 = encode_decode_round_trip_test(scanData1, (buffer: Buffer) => {
            buffer.length.should.eql(4);
        });

    });
    it("BSHE2 - should parse MyScanResult structure types", async () => {
        dataTypeFactory.hasStructuredType("MyScanResult").should.eql(true);

        const MyScanResult = getOrCreateConstructor("MyScanResult", dataTypeFactory);

        const result = new MyScanResult({

            scanData: {
                string: "36"
            }
        });
        const reloaded = encode_decode_round_trip_test(result, (buffer: Buffer) => {
            // buffer.length.should.eql(35);
        });
        console.log(reloaded.toString());
        // xx console.log(reloaded.toJSON());
    });

    it("BSHE3 -  should construct a dynamic object structure ProcessingTimesDataType - 1", () => {
        /* */
    });
});
