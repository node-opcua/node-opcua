// tslint:disable:no-console
import * as fs from "fs";
import { BinaryStream } from "node-opcua-binary-stream";
import {
    parameters
} from "node-opcua-factory";
import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/test_helpers";
import * as path from "path";
import * as should from "should";
import { promisify } from "util";
import { parseBinaryXSD, TypeDictionary } from "../source";
import { getOrCreateConstructor } from "../source/dynamic_extension_object";

// ts-lint:disable:no-string-literal
describe("Binary Schemas Helper", () => {

    let typeDictionary: TypeDictionary;
    before(async () => {
        const sample_file = path.join(__dirname, "fixtures/sample_type.xsd");

        parameters.debugSchemaHelper = true;
        const sample = fs.readFileSync(sample_file, "ascii");
        typeDictionary = await promisify(parseBinaryXSD)(sample);
    });

    it("should parse some structure types", async () => {
        should.exists(typeDictionary.structuredTypes.WorkOrderType);
    });
    it("should parse some enumerated types", async () => {
        should.exists(typeDictionary.enumeratedTypes.Priority);
    });
    it("should construct a dynamic object structure", () => {

        const WorkOrderType = getOrCreateConstructor("WorkOrderType", typeDictionary);

        const workOrderType = new WorkOrderType({
            assetID: "AssetId1234",
            iD: "00000000-0000-0000-ABCD-000000000000",
            startTime: new Date(),
            statusComments: [{
                actor: "Foo",
                comment: /* localized text*/ { text: "bar" },
                timestamp: new Date()
            }]
        });

        workOrderType.assetID.should.eql("AssetId1234");
        console.log(workOrderType.toString());
        encode_decode_round_trip_test(workOrderType, (stream: BinaryStream) => {
            stream.length.should.equal(66);
        });
    });

});
