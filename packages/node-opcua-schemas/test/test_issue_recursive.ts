import fs from "node:fs";
import { DataTypeFactory, parameters } from "node-opcua-factory";
import { encode_decode_round_trip_test, type IExtensionObject } from "node-opcua-packet-analyzer/dist/test_helpers";
import { Variant } from "node-opcua-variant";
import { parseBinaryXSD } from "../dist/source/index.js";
import { MockProvider } from "./mock_id_provider.js";
import { testFixture } from "./paths.js";

class MockProvider2 extends MockProvider {
    public getDataTypeAndEncodingId(key: string) {
        if (key === "Rep_BMD_ProcStepCtrl") {
            return null;
        }
        return super.getDataTypeAndEncodingId(key);
    }
}
const idProvider = new MockProvider2();

describe("Binary schema with recursive", () => {
    let dataTypeFactory: DataTypeFactory;
    let old_schema_helpers_doDebug = false;
    let sample: string;
    let sample2: string;
    before(async () => {
        const base_file = testFixture("sample_ua_base.xsd");
        const base = fs.readFileSync(base_file, "utf-8");

        const sample_file = testFixture("sample_recursive.xsd");

        old_schema_helpers_doDebug = parameters.debugSchemaHelper;
        parameters.debugSchemaHelper = true;
        sample = fs.readFileSync(sample_file, "utf-8");

        const sample2_file = testFixture("sample_recursive2.xsd");
        sample2 = fs.readFileSync(sample2_file, "utf-8");

        dataTypeFactory = new DataTypeFactory([]);
        await parseBinaryXSD(base, idProvider, dataTypeFactory);
    });

    after(() => {
        parameters.debugSchemaHelper = old_schema_helpers_doDebug;
    });

    it("should process ISA95ParameterDataType", async () => {
        await parseBinaryXSD(sample, idProvider, dataTypeFactory);

        const structureInfo = dataTypeFactory.getStructureInfoByTypeName("ISA95ParameterDataType");
        const ISA95ParameterDataType = structureInfo.constructor;
        if (!ISA95ParameterDataType) {
            throw new Error("Cannot find constructor for ISA95ParameterDataType");
        }
        const a = new ISA95ParameterDataType({
            ID: "1",
            value: new Variant({ dataType: "Double", value: 1.0 }),
            // EngineeringUnits: null,
            subparameters: [
                {
                    ID: "2",
                    value: new Variant({ dataType: "Double", value: 2.0 })
                }
            ]
        }) as IExtensionObject;

        console.log(a.toString());
        encode_decode_round_trip_test(a);
    });

    it("should process bsd file referencing ISA95ParameterDataType", async () => {
        await parseBinaryXSD(sample, idProvider, dataTypeFactory);
        await parseBinaryXSD(sample2, idProvider, dataTypeFactory);

        const structureInfo = dataTypeFactory.getStructureInfoByTypeName("OutputPerformanceInfoDataType");
        const OutputPerformanceInfoDataType = structureInfo.constructor!;
        const a = new OutputPerformanceInfoDataType({
            parameters: [
                {
                    ID: "2",
                    value: new Variant({ dataType: "Double", value: 2.0 })
                }
            ]
        });
        console.log(a.toString());
        encode_decode_round_trip_test(a);
    });
});
