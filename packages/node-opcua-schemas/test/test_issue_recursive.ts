import fs from "fs";
import path from "path";
import should from "should";

import { DataTypeFactory, parameters } from "node-opcua-factory";
import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";

import { getOrCreateConstructor, parseBinaryXSDAsync } from "../dist/source";
import { MockProvider } from "./mock_id_provider";
import { Variant } from "node-opcua-variant";

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
    before(async () => {

        const base_file = path.join(__dirname, "fixtures/sample_ua_base.xsd");
        const base = fs.readFileSync(base_file, "utf-8");

        const sample_file = path.join(__dirname, "fixtures/sample_recursive.xsd");

        old_schema_helpers_doDebug = parameters.debugSchemaHelper;
        parameters.debugSchemaHelper = true;
        sample = fs.readFileSync(sample_file, "utf-8");



        dataTypeFactory = new DataTypeFactory([]);

        await parseBinaryXSDAsync(base, idProvider, dataTypeFactory);

    });

    after(() => {
        parameters.debugSchemaHelper = old_schema_helpers_doDebug;
    });

    it("should process ISA95ParameterDataType", async () => {

        await parseBinaryXSDAsync(sample, idProvider, dataTypeFactory);

        const structureInfo = dataTypeFactory.getStructureInfoByTypeName("ISA95ParameterDataType");
        const ISA95ParameterDataType = structureInfo.constructor!;
        const a = new ISA95ParameterDataType({
            ID: "1",
            value: new Variant({ dataType: "Double", value: 1.0 }),
            // EngineeringUnits: null,
            subparameters: [
                {
                    ID: "2",
                    value: new Variant({ dataType: "Double", value: 2.0 }),
                }
            ]

        }) as any;

        console.log(a.toString());

        encode_decode_round_trip_test(a);
    });
});
