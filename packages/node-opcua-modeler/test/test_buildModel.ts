import * as should from "should";
import { buildModel, AddressSpace } from "..";

describe("buidModel", () => {

    it("should build a model", async () => {

        const xml = await buildModel({
            createModel: (addressSpace: AddressSpace) => {

            },
            namespaceUri: "urn:namespace",
            version: "1.0.0",
            xmlFiles: []
        });
        //console.log(xml);
        xml.should.eql(`<?xml version="1.0"?>
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
</UANodeSet>`)
    });

});