import path from "path";
// import fs from "fs";
import should from "should";
import { nodesets } from "node-opcua-nodesets";
import { getFixture } from "node-opcua-test-fixtures";
import { AddressSpace, preLoad, findOrder, generateAddressSpaceRaw } from "..";
import { readNodeSet2XmlFile } from "../nodeJS";

// const fixtureFolder = path.join(__dirname, "../../test_fixtures");
const doDebug = false;
describe("Ordering NodeSet2 files", () => {
    it("NSO-0 should order nodeset files", async () => {
        const xmlFiles = [nodesets.standard, nodesets.adi, nodesets.di];
        const nodesetDescArray = await preLoad(xmlFiles, readNodeSet2XmlFile);

        nodesetDescArray.forEach((x) => (x.xmlData = ""));
        doDebug && console.log(JSON.stringify(nodesetDescArray, null, " "));

        const order = findOrder(nodesetDescArray);
        order.should.eql([0, 2, 1]);
    });

    it("NSO-1 should order nodeset files 2", async () => {
        const xmlFiles = [nodesets.standard, nodesets.adi, nodesets.di];
        const addressSpace = AddressSpace.create();
        await generateAddressSpaceRaw(addressSpace, xmlFiles, readNodeSet2XmlFile, {});

        addressSpace.dispose();
        // await addressSpace.shutdown();
    });
    it("NSO-2 should order nodeset containing multiple namespace", async () => {
        const xmlFiles = [path.join(__dirname, "../nodesets/mini.Nodeset2.xml"), getFixture("fixture_custom_nodeset.xml")];

        const addressSpace = AddressSpace.create();
        await generateAddressSpaceRaw(addressSpace, xmlFiles, readNodeSet2XmlFile, {});
        addressSpace.dispose();
    });
    it("NSO-3 should load ill-formed nodeset containing multiple namespace", async () => {
        const xmlFiles = [
            nodesets.standard,
            nodesets.di,
            path.join(__dirname, "../test_helpers/test_fixtures/issue_1132_variable_with_nodeid_value.xml")
        ];
        const addressSpace = AddressSpace.create();
        await generateAddressSpaceRaw(addressSpace, xmlFiles, readNodeSet2XmlFile, {});

        const diNamespace = addressSpace.getNamespace("http://opcfoundation.org/UA/DI/");
        const variable = diNamespace.findNode("i=5001")!;
        variable.browseName.toString().should.eql("1:DeviceSet");

        const ns = addressSpace.getNamespaceIndex("http://mynamespace");
        if (ns === -1) {
            throw new Error("Cannot find namespace");
        }
        addressSpace.dispose();
    });
    it("NSO-4 should load ill-formed nodeset containing multiple namespace", async () => {
        const xmlFile = path.join(__dirname, "../test_helpers/test_fixtures/dataType_with_isOptionSet.xml");

        const xmlFiles = [nodesets.standard, xmlFile];
       
        const addressSpace = AddressSpace.create();
        await generateAddressSpaceRaw(addressSpace, xmlFiles, readNodeSet2XmlFile, {});

        addressSpace.dispose();
    });
    it("NSO-5 should raise an error if a namespace is missing", async () => {
        const xmlFiles = [
            nodesets.standard,
            /* INTENTIONNALY REMOVED nodesets.di, */
            nodesets.adi
        ];

        const addressSpace = AddressSpace.create();
        let _err: Error | undefined;
        try {
            await generateAddressSpaceRaw(addressSpace, xmlFiles, readNodeSet2XmlFile, {});
        } catch (err) {
            _err = err as Error;
        } finally {
            addressSpace.dispose();
        }
        should(_err!).be.instanceOf(Error);
        should(_err!.message).match(/Cannot find namespace for http:\/\/opcfoundation.org\/UA\/DI\//);
    });
});
