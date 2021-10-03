import * as should from "should";
import { AddressSpace } from "..";
import { buildModel } from "../nodeJS";

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("buildModel", () => {
    it("should build a empty model", async () => {
        const { xmlModel, symbols, markdown } = await buildModel({
            createModel: async (addressSpace: AddressSpace) => {
                /* empty */
            },
            namespaceUri: "urn:namespace",
            version: "1.0.0",
            xmlFiles: []
        });

        // tslint:disable-next-line: no-console
        // console.log(xmlModel);

        xmlModel.should.eql(`<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <NamespaceUris>
        <Uri>urn:namespace</Uri>
    </NamespaceUris>
    <Models/>
    <Aliases/>
<!--ReferenceTypes-->
<!--ObjectTypes-->
<!--VariableTypes-->
<!--Other Nodes-->
</UANodeSet>`);
    });
});
