import * as fs from "fs";
import * as path from "path";
import * as should from "should";

import { nodesets } from "node-opcua-nodesets";
import { getFixture } from "node-opcua-test-fixtures";

import { AddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing address space namespace", () => {
    it("#getNamespaceUri : should have namespace 0", () => {
        const addressSpace = AddressSpace.create();

        addressSpace.getNamespaceUri(0).should.eql("http://opcfoundation.org/UA/");

        addressSpace.dispose();
    });
    it("#registerNamespace should register new namespace", () => {
        const addressSpace = AddressSpace.create();

        const namespaceUri = "http://MyNEWNameSpace";
        addressSpace.getNamespaceIndex(namespaceUri).should.eql(-1);
        const namespace = addressSpace.registerNamespace(namespaceUri);
        addressSpace.getNamespaceIndex(namespaceUri).should.eql(namespace.index);

        addressSpace.dispose();
    });
});

describe("testing  address space namespace loading", function (this: any) {
    it("should process namespaces and translate namespace index when loading node set xml files", async () => {
        const addressSpace = AddressSpace.create();
        const xml_files = [
            path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml"),
            getFixture("fixture_custom_nodeset.xml")
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);
        // xx fs.existsSync(xml_files[2]).should.be.eql(true,"invalid file : "+ xml_files[2]);

        addressSpace.registerNamespace("ServerNamespaceURI");
        addressSpace.getNamespaceArray().length.should.eql(2);
        addressSpace
            .getNamespaceArray()
            .map((x) => x.namespaceUri)
            .should.eql(["http://opcfoundation.org/UA/", "ServerNamespaceURI"]);

        await generateAddressSpace(addressSpace, xml_files);

        addressSpace.getNamespaceArray().length.should.eql(4);
        addressSpace.getNamespaceArray()[2].namespaceUri.should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/");
        addressSpace.getNamespaceArray()[3].namespaceUri.should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/");

        addressSpace.findNode("ns=2;i=1")!.browseName.toString().should.eql("2:ObjectInCUSTOM_NAMESPACE1");
        addressSpace.findNode("ns=3;i=1")!.browseName.toString().should.eql("3:ObjectInCUSTOM_NAMESPACE2");

        addressSpace
            .getNamespaceArray()
            .map((x) => x.namespaceUri)
            .should.eql([
                "http://opcfoundation.org/UA/",
                "ServerNamespaceURI",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/"
            ]);

        addressSpace.dispose();
    });

    it("should process multiple xml files that reference each other", async () => {
        const addressSpace = AddressSpace.create();
        const xml_files = [
            path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml"),
            getFixture("fixture_custom_nodeset.xml"),
            getFixture("fixture_custom_nodeset_extension.xml")
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);
        fs.existsSync(xml_files[2]).should.be.eql(true);

        addressSpace.registerNamespace("ServerNamespaceURI");
        addressSpace.getNamespaceArray().length.should.eql(2);

        await generateAddressSpace(addressSpace, xml_files);

        addressSpace.getNamespaceArray().length.should.eql(5);
        addressSpace.getNamespaceArray()[2].namespaceUri.should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/");
        addressSpace.getNamespaceArray()[3].namespaceUri.should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/");
        addressSpace.getNamespaceArray()[4].namespaceUri.should.eql("http://nodeopcua.org/UA/CUSTOM_NAMESPACE3/");

        addressSpace.findNode("ns=2;i=1")!.browseName.toString().should.eql("2:ObjectInCUSTOM_NAMESPACE1");
        addressSpace.findNode("ns=3;i=1")!.browseName.toString().should.eql("3:ObjectInCUSTOM_NAMESPACE2");

        addressSpace.findNode("ns=2;i=1000")!.browseName.toString().should.eql("2:AnOtherObjectInCUSTOM_NAMESPACE1");
        addressSpace.findNode("ns=3;i=1000")!.browseName.toString().should.eql("3:AnOtherObjectInCUSTOM_NAMESPACE2");

        addressSpace.findNode("ns=4;i=1")!.browseName.toString().should.eql("4:ObjectInCUSTOM_NAMESPACE3");

        addressSpace
            .getNamespaceArray()
            .map((x) => x.namespaceUri)
            .should.eql([
                "http://opcfoundation.org/UA/",
                "ServerNamespaceURI",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE1/",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE2/",
                "http://nodeopcua.org/UA/CUSTOM_NAMESPACE3/"
            ]);
        addressSpace.dispose();
    });

    // increase test timeout as test may take time on slow arm computers
    this.timeout(Math.max(100000, this.timeout()));

    it("should process namespaces with DI", async () => {
        const addressSpace = AddressSpace.create();
        const xml_files = [nodesets.standard, nodesets.di];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        addressSpace.registerNamespace("ServerNamespaceURI");
        addressSpace.getNamespaceArray().length.should.eql(2);

        await generateAddressSpace(addressSpace, xml_files);

        addressSpace.getNamespaceArray().length.should.eql(3);
        addressSpace.getNamespaceArray()[2].namespaceUri.should.eql("http://opcfoundation.org/UA/DI/");

        addressSpace
            .getNamespaceArray()
            .map((x) => x.namespaceUri)
            .should.eql([
                "http://opcfoundation.org/UA/", // 0
                "ServerNamespaceURI", // 1
                "http://opcfoundation.org/UA/DI/" // 2
            ]);

        const di_ns = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        di_ns.should.eql(2);

        // now try to retrieve some VariableType from DI namespace
        const UIElementType = addressSpace.findVariableType("UIElementType", di_ns)!;
        UIElementType.browseName.toString().should.eql("2:UIElementType");
        should(addressSpace.findVariableType("UIElementType")).eql(null, "namespace is not provided");
        should(addressSpace.findVariableType("2:UIElementType")).eql(UIElementType);

        // now extract some ObjectType From DI namespace
        const TransferServicesType = addressSpace.findObjectType("TransferServicesType", di_ns)!;
        TransferServicesType.browseName.toString().should.eql("2:TransferServicesType");
        should(addressSpace.findObjectType("TransferServicesType")).eql(null, "namespace is not provided");
        should(addressSpace.findObjectType("2:TransferServicesType")).eql(TransferServicesType);

        // now extract some ReferenceType
        const ConnectsToRefType = addressSpace.findReferenceType("ConnectsTo", di_ns)!;
        ConnectsToRefType.browseName.toString().should.eql("2:ConnectsTo");
        should(addressSpace.findReferenceType("ConnectsTo")).eql(null, "namespace is not provided");
        should(addressSpace.findReferenceType("2:ConnectsTo")).eql(ConnectsToRefType);

        // now extract some DataType
        const ParameterResultDataType = addressSpace.findDataType("ParameterResultDataType", di_ns)!;
        ParameterResultDataType.browseName.toString().should.eql("2:ParameterResultDataType");
        should(addressSpace.findDataType("ParameterResultDataType")).eql(null, "namespace is not provided");
        should(addressSpace.findDataType("2:ParameterResultDataType")).eql(ParameterResultDataType);

        addressSpace.dispose();
    });
});
