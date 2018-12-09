"use strict";
/*global describe,it,before*/

const should = require("should");

const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;

const _ = require("underscore");
const dumpXml = require("../src/nodeset_to_xml").dumpXml;
const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;
const generateAddressSpace = require("..").generate_address_space;

const getTempFilename = require("node-opcua-debug").getTempFilename;

const doDebug = false;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing nodeset to xml", function () {
    let addressSpace,namespace;
    beforeEach(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {

            addressSpace = __addressSpace__;

            namespace = addressSpace.getOwnNamespace();
            done(err);
        });

    });
    afterEach(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });
    const createTemperatureSensorType = require("./fixture_temperature_sensor_type").createTemperatureSensorType;

    it("should output a standard extension object datatype to xml (Argument)", function () {

        const argumentDataType = addressSpace.findDataType("Argument");
        if (doDebug) {
            console.log(argumentDataType.toString());
        }
        const str = dumpXml(argumentDataType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/Argument/);
    });

    it("should output a standard Enum node to xml (ServerState)", function () {
        // TemperatureSensorType
        const serverStateType = addressSpace.findDataType("ServerState");
        const str = dumpXml(serverStateType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/CommunicationFault/);
    });

    it("€€€ should output a custom Enum node to xml (MyEnumType) - Form1( with EnumStrings )", function () {

        const myEnumType = namespace.addEnumerationType({
            browseName: "MyEnumTypeForm1",
            enumeration: ["RUNNING", "STOPPED"]
        });

        myEnumType.browseName.toString().should.eql("1:MyEnumTypeForm1");
        const str = dumpXml(myEnumType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/RUNNING/);
        str.should.match(/<Field Name="RUNNING" Value="0"\/>/);
        str.should.match(/<Field Name="STOPPED" Value="1"\/>/);

    });
    it("€€ should output a custom Enum node to xml (MyEnumType) - Form2 ( with EnumValues )", function () {


        const myEnumType = namespace.addEnumerationType({
            browseName: "MyEnumType",
            enumeration: [
                {displayName: "RUNNING", value: 10, description: "the device is running"},
                {displayName: "STOPPED", value: 20, description: "the device is stopped"}
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

    it("should output a simple objectType node to xml", function () {
        // TemperatureSensorType
        const temperatureSensorType = createTemperatureSensorType(addressSpace);

        const str = dumpXml(temperatureSensorType, {});
        //xx console.log(str);
        str.should.match(/UAObjectType/);
    });


    it("should output a instance of a new ObjectType  to xml", function () {

        const namespace= addressSpace.getOwnNamespace();

        // TemperatureSensorType
        const temperatureSensorType = namespace.addObjectType({browseName: "TemperatureSensorType"});
        namespace.addVariable({
            componentOf: temperatureSensorType,
            browseName: "Temperature",
            description: "the temperature value of the sensor in Celsius <�C>",
            dataType: "Double",
            modellingRule: "Mandatory",
            value: new Variant({dataType: DataType.Double, value: 19.5})
        });

        const parentFolder = addressSpace.findNode("RootFolder");
        parentFolder.browseName.toString().should.eql("Root");

        // variation 1
        const temperatureSensor = temperatureSensorType.instantiate({
            organizedBy: parentFolder,
            browseName: "MyTemperatureSensor"
        });

        // variation 2
        const temperatureSensor2 = temperatureSensorType.instantiate({
            organizedBy: "RootFolder",
            browseName: "MyTemperatureSensor"
        });


        const str = dumpXml(temperatureSensor, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/UAObjectType/g);

    });
    it("should output a instance of object with method  to xml", function () {

        const createCameraType = require("./fixture_camera_type").createCameraType;

        const cameraType = createCameraType(addressSpace);

        const camera1 = cameraType.instantiate({
            organizedBy: "RootFolder",
            browseName: "Camera1"
        });
        const str = dumpXml(camera1, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/UAObjectType/g);
        str.should.match(/UAObjectType/g);
    });

    it("should output an instance of variable type to xml", function () {

        const namespace= addressSpace.getOwnNamespace();
        const variableType = namespace.addVariableType({browseName: 'MyCustomVariableType'});

        const str = dumpXml(variableType, {});
        if (doDebug) {
            console.log(str);
        }
        str.should.match(/UAVariableType/g);
    });
});



const Namespace = require("../src/namespace").Namespace;
const AddressSpace = require("../src/address_space").AddressSpace;

describe("Namespace to NodeSet2.xml",function() {

    let addressSpace,namespace;
    beforeEach(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {

            addressSpace = __addressSpace__;

            namespace = addressSpace.getOwnNamespace();
            done(err);
        });

    });
    afterEach(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });


    it("should produce a XML file from a namespace - a new Reference",function() {


        namespace.addReferenceType({
            browseName: "HasCousin",
            inverseName: "IsCousinOf",
            subtypeOf: "HasChild"
        });

        const  nodeIds = namespace.getStandardsNodeIds();

        should.exist(nodeIds.referenceTypeIds["HasCousin"]);

        let xml = namespace.toNodeset2XML();
        xml = xml.replace(/LastModified="([^"]*)"/g,"LastModified=\"YYYY-MM-DD\"");
        xml.should.eql(
`<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <NamespaceUris>
        <Uri>http://opcfoundation.org/UA/</Uri>
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

    it("should produce a XML file from a namespace - a new UAObjectType",function() {


        namespace.addObjectType({
            browseName: "MyObjectType",
            subtypeOf: "BaseObjectType"
        });

        const  nodeIds = namespace.getStandardsNodeIds();

        should.exist(nodeIds.objectTypeIds["MyObjectType"]);


        let xml = namespace.toNodeset2XML();
        xml = xml.replace(/LastModified="([^\"]*)"/g,"LastModified=\"YYYY-MM-DD\"");
        xml.should.eql(
            `<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <NamespaceUris>
        <Uri>http://opcfoundation.org/UA/</Uri>
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

    it("should produce a XML file from a namespace - with 2 UAObjectType",function() {


        const myObjectBaseType =namespace.addObjectType({
            browseName: "MyObjectBaseType",
            subtypeOf: "BaseObjectType",
            isAbstract: true
        });

        const myObjectType =namespace.addObjectType({
            browseName: "MyObjectType",
            subtypeOf: myObjectBaseType,
            isAbstract: false
        });

        const  nodeIds = namespace.getStandardsNodeIds();

        should.exist(nodeIds.objectTypeIds["MyObjectType"]);


        let xml = namespace.toNodeset2XML();
        xml = xml.replace(/LastModified="([^"]*)"/g,"LastModified=\"YYYY-MM-DD\"");
        xml.should.eql(
            `<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <NamespaceUris>
        <Uri>http://opcfoundation.org/UA/</Uri>
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

const generate_address_space = require("..").generate_address_space;
const nodesets = require("node-opcua-nodesets");
const fs = require("fs");

describe("nodeset2.xml with more than one referenced namespace",function() {

    this.timeout(20000);

    let addressSpace,namespace;
    beforeEach(function (done) {

        addressSpace = new AddressSpace();

        const xml_files = [
            nodesets.standard_nodeset_file,
            nodesets.di_nodeset_filename
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);

        addressSpace.registerNamespace("ServerNamespaceURI");
        addressSpace.getNamespaceArray().length.should.eql(2);


        generate_address_space(addressSpace, xml_files, function (err) {
            if( err) { return done(err); }
            addressSpace.getNamespaceArray().length.should.eql(3);
            addressSpace.getNamespaceArray()[2].namespaceUri.should.eql("http://opcfoundation.org/UA/DI/");

            addressSpace.getNamespaceArray().map(x => x.namespaceUri).should.eql([
                "http://opcfoundation.org/UA/",   // 0
                "ServerNamespaceURI",             // 1
                "http://opcfoundation.org/UA/DI/",// 2
            ]);

            namespace = addressSpace.getOwnNamespace();
            done();
        });
    });
    afterEach(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });


    it("should produce a XML file from a namespace - with DI included - 1 Rich ObjectType - and reload it",function(done) {

        const createBoilerType = require("../test_helpers/boiler_system").createBoilerType;
        createBoilerType(addressSpace);
        let xml = namespace.toNodeset2XML();
        let xml2 = xml.replace(/LastModified="([^"]*)"/g,"LastModified=\"YYYY-MM-DD\"");

        const tmpFilename = getTempFilename("__generated_node_set_version1.xml");
        fs.writeFileSync(tmpFilename,xml);

        ///Xx console.log(xml);
        const theNodesets = [
            nodesets.standard_nodeset_file,
            nodesets.di_nodeset_filename,
            tmpFilename,
        ];
        // now reload the file as part of a addressSpace;
        const reloadedAddressSpace = new AddressSpace();
        generate_address_space(reloadedAddressSpace,theNodesets,function(err){


            const r_namespace = reloadedAddressSpace.getNamespace(namespace.namespaceUri);
            r_namespace.constructor.name.should.eql("UANamespace");

            let r_xml = r_namespace.toNodeset2XML();
            let r_xml2 = r_xml.replace(/LastModified="([^"]*)"/g,"LastModified=\"YYYY-MM-DD\"");

            const tmpFilename = getTempFilename("__generated_node_set_version2.xml");
            fs.writeFileSync(tmpFilename,r_xml);

            r_xml2.split("\n").should.eql(xml2.split("\n"));

            reloadedAddressSpace.dispose();
            done(err);
        });

        // create a
    });
});




