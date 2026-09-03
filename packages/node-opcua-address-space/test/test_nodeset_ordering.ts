import fs from "node:fs";
import zlib from "node:zlib";
import { nodesets } from "node-opcua-nodesets";
import { getFixture } from "node-opcua-test-fixtures";
import should from "should";
import { AddressSpace, findOrder, generateAddressSpaceRaw, type NodesetSource, preLoad } from "../dist/api/index.js";
import { readNodeSet2XmlFile } from "../nodeJS.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

// const fixtureFolder = path.join(__dirname, "../../test_fixtures");
const doDebug = false;
describe("Ordering NodeSet2 files", () => {
    it("NSO-0 should order nodeset files", async () => {
        const xmlFiles = [nodesets.standard, nodesets.adi, nodesets.di];
        const nodesetDescArray = await preLoad(xmlFiles, readNodeSet2XmlFile);

        nodesetDescArray.forEach((x) => {
            x.xmlData = "";
        });
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
        const xmlFiles = [getAddressSpaceFixture("mini.Nodeset2.xml"), getFixture("fixture_custom_nodeset.xml")];

        const addressSpace = AddressSpace.create();
        await generateAddressSpaceRaw(addressSpace, xmlFiles, readNodeSet2XmlFile, {});
        addressSpace.dispose();
    });
    it("NSO-3 should load ill-formed nodeset containing multiple namespace", async () => {
        const xmlFiles = [nodesets.standard, nodesets.di, getAddressSpaceFixture("issue_1132_variable_with_nodeid_value.xml")];
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
        const xmlFile = getAddressSpaceFixture("dataType_with_isOptionSet.xml");

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
        should(_err?.message).match(/Cannot find namespace for http:\/\/opcfoundation.org\/UA\/DI\//);
    });

    const UA = "http://opcfoundation.org/UA/";
    const DI = "http://opcfoundation.org/UA/DI/";

    /** a nodeset file as a gzip stream, the way a compressed model reaches a server */
    const gzipStreamOf = (file: string): NodesetSource => ({
        name: `${file}.gz`,
        source: () => fs.createReadStream(file).pipe(zlib.createGzip()).pipe(zlib.createGunzip())
    });

    it("NSO-6 should order a document whose required model is satisfied outside the call", async () => {
        const [di] = await preLoad([nodesets.di], readNodeSet2XmlFile);
        di.xmlData = "";
        should(() => findOrder([di])).throw(/Cannot find namespace for http:\/\/opcfoundation.org\/UA\//);
        findOrder([di], (requiredModel) => requiredModel.modelUri === UA).should.eql([0]);
    });

    it("NSO-7 should load a companion nodeset in a second call, after the standard nodeset", async () => {
        // a server has loaded Opc.Ua.NodeSet2.xml in initialize(); a model arrives later, as a gzip stream
        const addressSpace = AddressSpace.create();
        try {
            await generateAddressSpaceRaw(addressSpace, [nodesets.standard], readNodeSet2XmlFile, {});
            should(addressSpace.getNamespaceIndex(DI)).eql(-1);

            await generateAddressSpaceRaw(addressSpace, [gzipStreamOf(nodesets.di)], {});

            const diNamespace = addressSpace.getNamespace(DI);
            should.exist(diNamespace);
            should(diNamespace.findNode("i=5001")?.browseName.name).eql("DeviceSet");
            const deviceSet = addressSpace.rootFolder.objects.getFolderElementByName("DeviceSet", diNamespace.index);
            should.exist(deviceSet, "DeviceSet is organized by Objects, across the two calls");
            should(diNamespace.getRequiredModels()!.map((m) => m.modelUri)).eql([UA]);
        } finally {
            addressSpace.dispose();
        }
    });

    it("NSO-8 should still report a model that neither call provides", async () => {
        const addressSpace = AddressSpace.create();
        try {
            await generateAddressSpaceRaw(addressSpace, [nodesets.standard], readNodeSet2XmlFile, {});
            // ADI requires DI, which is neither loaded nor in this call
            await generateAddressSpaceRaw(addressSpace, [gzipStreamOf(nodesets.adi)], {}).should.be.rejectedWith(
                /Cannot find namespace for http:\/\/opcfoundation.org\/UA\/DI\//
            );
            should(addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/")).eql(-1, "nothing of ADI was loaded");
        } finally {
            addressSpace.dispose();
        }
    });

    it("NSO-9 should reject a loaded model whose version is lower than the one required", async () => {
        const addressSpace = AddressSpace.create();
        try {
            await generateAddressSpaceRaw(addressSpace, [nodesets.standard], readNodeSet2XmlFile, {});
            const ua = addressSpace.getNamespace(UA);
            const loadedVersion = ua.version;
            ua.version = "1.03";
            await generateAddressSpaceRaw(addressSpace, [gzipStreamOf(nodesets.di)], {}).should.be.rejectedWith(
                /Namespace http:\/\/opcfoundation.org\/UA\/ is loaded with version 1.03 but http:\/\/opcfoundation.org\/UA\/DI\/ requires version [0-9.]+ or later/
            );
            should(addressSpace.getNamespaceIndex(DI)).eql(-1);
            // the version it has is enough
            ua.version = loadedVersion;
            await generateAddressSpaceRaw(addressSpace, [gzipStreamOf(nodesets.di)], {});
            should(addressSpace.getNamespaceIndex(DI)).not.eql(-1);
        } finally {
            addressSpace.dispose();
        }
    });
});
