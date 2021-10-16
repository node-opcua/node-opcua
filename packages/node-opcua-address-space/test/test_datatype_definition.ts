import * as should from "should";

import { AttributeIds } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { nodesets } from "node-opcua-nodesets";
import { StructureDefinition } from "node-opcua-types";

import { AddressSpace, SessionContext } from "..";
import { generateAddressSpace } from "../nodeJS";

const context = SessionContext.defaultContext;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing UADataType -  Attribute", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const nodesetFilename = [nodesets.standard];
        await generateAddressSpace(addressSpace, nodesetFilename);
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("DTX1 should extract Definition from DataType enumeration type 1", async () => {
        /** todo */
    });
    it("DTX2 should extract Definition from DataType enumeration type 2", async () => {
        /** todo */
    });
    it("DTX3 should extract Definition from DataType enumeration type 3", async () => {
        /** todo */
    });
    it("DTX4 should extract Definition from DataType structure", async () => {
        const dataTypeSchemaHeader = addressSpace.findDataType("DataTypeSchemaHeader")!;
        should.exist(dataTypeSchemaHeader);

        const dataTypeDefinitionDataValue = dataTypeSchemaHeader.readAttribute(null, AttributeIds.DataTypeDefinition);
        should.exist(dataTypeDefinitionDataValue);
        dataTypeDefinitionDataValue.statusCode.should.eql(StatusCodes.Good);

        const dataTypeDefinition = dataTypeDefinitionDataValue.value.value;
        dataTypeDefinition.should.be.instanceOf(StructureDefinition);
        //xx debugLog(dataTypeDefinition.toString());
    });
});
