// tslint:disable:no-console
// tslint:disable:max-line-length
import * as fs from "fs";
import * as should from "should";
import * as mocha from "mocha";

import { getTempFilename } from "node-opcua-debug";
import { DataType } from "node-opcua-variant";
import { Variant } from "node-opcua-variant";

import {
    AddressSpace,
    getMiniAddressSpace ,
    UAVariable,
    createBoilerType,
    dumpXml,
    generateAddressSpace,
    Namespace,
    RootFolder
} from "..";

import * as nodesets from "node-opcua-nodesets";

const doDebug = true;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing nodeset to xml", () => {

    let addressSpace: AddressSpace;
    let namespace: Namespace;

    beforeEach(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    afterEach(async () => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });
    const createTemperatureSensorType = require("./fixture_temperature_sensor_type").createTemperatureSensorType;

    it("should output a standard extension object datatype to xml (Argument)", () => {

        const argumentDataType = addressSpace.findDataType("Argument")!;
        if (doDebug) {
            console.log(argumentDataType.toString());
        }
        const str = dumpXml(argumentDataType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/Argument/);
    });

    it("should output a standard Enum node to xml (ServerState)", () => {
        // TemperatureSensorType
        const serverStateType = addressSpace.findDataType("ServerState")!;
        const str = dumpXml(serverStateType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/CommunicationFault/);
    });

    it("€€€ should output a custom Enum node to xml (MyEnumType) - Form1( with EnumStrings )", () => {

        const myEnumType = namespace.addEnumerationType({
            browseName: "MyEnumTypeForm1",
            enumeration: ["RUNNING", "STOPPED"]
        });

        const enumStringNode = myEnumType.getChildByName("EnumStrings")! as UAVariable;
        const values = enumStringNode.readValue().value.value.map(x=>x.toString());
        console.log(values.toString());
        values.join(",").should.eql("locale=null text=RUNNING,locale=null text=STOPPED");

        myEnumType.browseName.toString().should.eql("1:MyEnumTypeForm1");
        const str = dumpXml(myEnumType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/RUNNING/);
        str.should.match(/<Field Name="RUNNING" Value="0"\/>/);
        str.should.match(/<Field Name="STOPPED" Value="1"\/>/);

    });
    it("€€ should output a custom Enum node to xml (MyEnumType) - Form2 ( with EnumValues )", () => {

        const myEnumType = namespace.addEnumerationType({
            browseName: "MyEnumType",
            enumeration: [
                { displayName: "RUNNING", value: 10, description: "the device is running" },
                { displayName: "STOPPED", value: 20, description: "the device is stopped" }
            ]
        });

        myEnumType.browseName.toString().should.eql("1:MyEnumType");
        const str = dumpXml(myEnumType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/RUNNING/);
        str.should.match(/<Field Name="RUNNING" Value="10"\/>/);
        str.should.match(/<Field Name="STOPPED" Value="20"\/>/);

    });

    it("should output a simple objectType node to xml", () => {
        // TemperatureSensorType
        const temperatureSensorType = createTemperatureSensorType(addressSpace);

        const str = dumpXml(temperatureSensorType, {});
        str.should.match(/UAObjectType/);
    });

    it("should output a instance of a new ObjectType  to xml", () => {

        const ownNamespace = addressSpace.getOwnNamespace();

        // TemperatureSensorType
        const temperatureSensorType = ownNamespace.addObjectType({ browseName: "TemperatureSensorType" });
        ownNamespace.addVariable({
            browseName: "Temperature",
            componentOf: temperatureSensorType,
            dataType: "Double",
            description: "the temperature value of the sensor in Celsius <�C>",
            modellingRule: "Mandatory",
            value: new Variant({ dataType: DataType.Double, value: 19.5 })
        });

        const parentFolder = addressSpace.findNode("RootFolder")! as RootFolder;
        parentFolder.browseName.toString().should.eql("Root");

        // variation 1
        const temperatureSensor = temperatureSensorType.instantiate({
            browseName: "MyTemperatureSensor",
            organizedBy: parentFolder,
        });

        // variation 2
        const temperatureSensor2 = temperatureSensorType.instantiate({
            browseName: "MyTemperatureSensor",
            organizedBy: "RootFolder",
        });

        const str = dumpXml(temperatureSensor, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/UAObjectType/g);

    });

    it("KLKL should output a instance of object with method  to xml", () => {

        const createCameraType = require("./fixture_camera_type").createCameraType;

        const cameraType = createCameraType(addressSpace);

        const camera1 = cameraType.instantiate({
            browseName: "Camera1",
            organizedBy: "RootFolder",
        });
        const str = dumpXml(camera1, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/UAObjectType/g);
        str.should.match(/UAObjectType/g);
        str.should.match(/<\/UAMethod>/g, "must have a complex UAMethod element");
        str.should.match(/BrowseName="InputArguments"/);
        str.should.match(/BrowseName="OutputArguments"/);
    });

    it("should output an instance of variable type to xml", () => {

        const ownNamespace = addressSpace.getOwnNamespace();
        const variableType = ownNamespace.addVariableType({ browseName: "MyCustomVariableType" });

        const str = dumpXml(variableType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/UAVariableType/g);
    });

    it("should output a ReferenceType to xml", () => {

        const ownNamespace = addressSpace.getOwnNamespace();
        const referenceType = ownNamespace.addReferenceType({
            browseName: "HasStuff",
            inverseName: "StuffOf"
        });

        const str = dumpXml(referenceType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/UAReferenceType/g);
        str.should.match(/StuffOf/g);
        str.should.match(/HasStuff/g);

    });

    it("should ouput a Method to xml", () => {
        const ownNamespace = addressSpace.getOwnNamespace();

        const rootFolder = addressSpace.findNode("RootFolder")! as RootFolder;

        const obj1 = ownNamespace.addObject({
            browseName: "Object",
            organizedBy: rootFolder.objects
        });
        ownNamespace.addMethod(obj1, {
            browseName: "Trigger",
            inputArguments: [
                {
                    dataType: DataType.UInt32,
                    description: { text: "specifies the number of seconds to wait before the picture is taken " },
                    name: "ShutterLag",
                }
            ],
            modellingRule: "Mandatory",
            outputArguments: [
                {
                    dataType: "Image",
                    description: { text: "the generated image" },
                    name: "Image",
                }
            ]
        });
        const str = dumpXml(obj1, {});

        str.should.match(/<\/UAMethod>/g, "must have a complex UAMethod element");
        str.should.match(/BrowseName="InputArguments"/);
        str.should.match(/BrowseName="OutputArguments"/);

        if (doDebug) {
            console.log(str);
        }

    });

});

describe("Namespace to NodeSet2.xml", () => {

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    beforeEach(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    afterEach(async () => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should produce a XML file from a namespace - a new Reference", () => {

        namespace.addReferenceType({
            browseName: "HasCousin",
            inverseName: "IsCousinOf",
            subtypeOf: "HasChild"
        });

        const nodeIds = namespace.getStandardsNodeIds();

        should.exist(nodeIds.referenceTypeIds.HasCousin);

        let xml = namespace.toNodeset2XML();
        xml = xml.replace(/LastModified="([^"]*)"/g, "LastModified=\"YYYY-MM-DD\"");
        xml.should.eql(
            `<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <NamespaceUris>
        <Uri>http://MYNAMESPACE</Uri>
    </NamespaceUris>
    <Models/>
    <Aliases>
        <Alias Alias="HasSubtype">i=45</Alias>
    </Aliases>
<!--ReferenceTypes-->
    <UAReferenceType NodeId="ns=1;i=1000" BrowseName="1:HasCousin">
        <DisplayName>HasCousin</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">i=34</Reference>
        </References>
        <InverseName>IsCousinOf</InverseName>
    </UAReferenceType>
<!--ObjectTypes-->
<!--VariableTypes-->
<!--Other Nodes-->
</UANodeSet>`
        );

    });

    it("should produce a XML file from a namespace - a new UAObjectType", () => {

        namespace.addObjectType({
            browseName: "MyObjectType",
            subtypeOf: "BaseObjectType"
        });

        const nodeIds = namespace.getStandardsNodeIds();

        should.exist(nodeIds.objectTypeIds.MyObjectType);

        let xml = namespace.toNodeset2XML();
        xml = xml.replace(/LastModified="([^"]*)"/g, "LastModified=\"YYYY-MM-DD\"");
        xml.should.eql(
            `<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <NamespaceUris>
        <Uri>http://MYNAMESPACE</Uri>
    </NamespaceUris>
    <Models/>
    <Aliases>
        <Alias Alias="HasSubtype">i=45</Alias>
    </Aliases>
<!--ReferenceTypes-->
<!--ObjectTypes-->
<!--ObjectType - 1:MyObjectType {{{{ -->
    <UAObjectType NodeId="ns=1;i=1000" BrowseName="1:MyObjectType">
        <DisplayName>MyObjectType</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">i=58</Reference>
        </References>
    </UAObjectType>
<!--ObjectType - 1:MyObjectType }}}}-->
<!--VariableTypes-->
<!--Other Nodes-->
</UANodeSet>`
        );

    });

    it("should produce a XML file from a namespace - with 2 UAObjectType", () => {

        const myObjectBaseType = namespace.addObjectType({
            browseName: "MyObjectBaseType",
            isAbstract: true,
            subtypeOf: "BaseObjectType",
        });

        const myObjectType = namespace.addObjectType({
            browseName: "MyObjectType",
            isAbstract: false,
            subtypeOf: myObjectBaseType,
        });

        const nodeIds = namespace.getStandardsNodeIds();

        should.exist(nodeIds.objectTypeIds.MyObjectType);

        let xml = namespace.toNodeset2XML();
        xml = xml.replace(/LastModified="([^"]*)"/g, "LastModified=\"YYYY-MM-DD\"");
        xml.should.eql(
            `<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <NamespaceUris>
        <Uri>http://MYNAMESPACE</Uri>
    </NamespaceUris>
    <Models/>
    <Aliases>
        <Alias Alias="HasSubtype">i=45</Alias>
    </Aliases>
<!--ReferenceTypes-->
<!--ObjectTypes-->
<!--ObjectType - 1:MyObjectType {{{{ -->
<!--ObjectType - 1:MyObjectBaseType {{{{ -->
    <UAObjectType NodeId="ns=1;i=1000" BrowseName="1:MyObjectBaseType" IsAbstract="true">
        <DisplayName>MyObjectBaseType</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">i=58</Reference>
        </References>
    </UAObjectType>
<!--ObjectType - 1:MyObjectBaseType }}}}-->
    <UAObjectType NodeId="ns=1;i=1001" BrowseName="1:MyObjectType">
        <DisplayName>MyObjectType</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">ns=1;i=1000</Reference>
        </References>
    </UAObjectType>
<!--ObjectType - 1:MyObjectType }}}}-->
<!--VariableTypes-->
<!--Other Nodes-->
</UANodeSet>`
        );
    });
});

describe("nodeset2.xml with more than one referenced namespace", function (this: any) {

    this.timeout(20000);

    let addressSpace: AddressSpace;
    let namespace: Namespace;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();

        const xml_files = [
            nodesets.standard_nodeset_file,
            nodesets.di_nodeset_filename
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        addressSpace.registerNamespace("ServerNamespaceURI");
        addressSpace.getNamespaceArray().length.should.eql(2);

        await generateAddressSpace(addressSpace, xml_files);
        addressSpace.getNamespaceArray().length.should.eql(3);
        addressSpace.getNamespaceArray()[2].namespaceUri.should.eql("http://opcfoundation.org/UA/DI/");

        addressSpace.getNamespaceArray().map((x: Namespace) => x.namespaceUri).should.eql([
            "http://opcfoundation.org/UA/",    // 0
            "ServerNamespaceURI",              // 1
            "http://opcfoundation.org/UA/DI/" // 2
        ]);

        namespace = addressSpace.getOwnNamespace();

    });
    afterEach(async () => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should produce a XML file - with DI included - 1 Rich ObjectType - and reload it", async () => {

        createBoilerType(addressSpace);
        const xml = namespace.toNodeset2XML();
        const xml2 = xml.replace(/LastModified="([^"]*)"/g, "LastModified=\"YYYY-MM-DD\"");

        const tmpFilename = getTempFilename("__generated_node_set_version1.xml");
        fs.writeFileSync(tmpFilename, xml);

        /// Xx console.log(xml);
        const theNodesets = [
            nodesets.standard_nodeset_file,
            nodesets.di_nodeset_filename,
            tmpFilename
        ];
        // now reload the file as part of a addressSpace;
        const reloadedAddressSpace = AddressSpace.create();
        await generateAddressSpace(reloadedAddressSpace, theNodesets);

        const r_namespace = reloadedAddressSpace.getNamespace(namespace.namespaceUri);
        r_namespace.constructor.name.should.eql("UANamespace");

        const r_xml = r_namespace.toNodeset2XML();
        const r_xml2 = r_xml.replace(/LastModified="([^"]*)"/g, "LastModified=\"YYYY-MM-DD\"");

        const tmpFilename2 = getTempFilename("__generated_node_set_version2.xml");
        fs.writeFileSync(tmpFilename2, r_xml);

        r_xml2.split("\n").should.eql(xml2.split("\n"));

        reloadedAddressSpace.dispose();

        // create a
    });
});
