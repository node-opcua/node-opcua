import fs from "fs";
import path from "path";
import os from "os";
import should from "should";
import { nodesets } from "node-opcua-nodesets";
import { AttributeIds, UInt64 } from "node-opcua-basic-types";
import { DataSetMetaDataType, TransferSubscriptionsRequest } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import {
    AddressSpace,
    Namespace,
    SessionContext,
    UAObject,
    UAVariable,
    _recomputeRequiredModelsFromTypes,
    _recomputeRequiredModelsFromTypes2,
    _getCompleteRequiredModelsFromValuesAndReferences,
    constructNamespacePriorityTable
} from "..";
import { generateAddressSpace } from "../nodeJS";
import { create_minimalist_address_space_nodeset } from "../distHelpers";

const doDebug = false;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing loading nodeset with extension objects values in types", () => {
    let addressSpace: AddressSpace;

    const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/variabletype_with_value.xml");
    fs.existsSync(xml_file1).should.be.eql(true, " should find " + xml_file1);

    const xml_file2 = path.join(__dirname, "../test_helpers/test_fixtures/variable_with_value.xml");
    fs.existsSync(xml_file2).should.be.eql(true, " should find " + xml_file2);

    const context = SessionContext.defaultContext;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
    });
    afterEach(() => {
        addressSpace.dispose();
    });
    it("LNEX1- should load nodeset with extension objects", async () => {
        // const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/plc_demo.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file1]);

        const nsSterfive = addressSpace.getNamespaceIndex("http://sterfive.com/Small_model/");
        const connectionDetailsType = addressSpace.findVariableType("ConnectionDetailsType", nsSterfive)!;

        // xx console.log(connectionDetailsType.toString());
        const value = connectionDetailsType.readAttribute(context, AttributeIds.Value).value;
        // xx  console.log(value.toString());
        value.value.constructor.name.should.eql("ConnectionDetails");

        //
        const certificateVariable = connectionDetailsType.getChildByName("Certificates")! as UAVariable;
        const urlVariable = connectionDetailsType.getChildByName("Url")! as UAVariable;

        // xx console.log(certificateVariable.toString());
        // xx  console.log(urlVariable.toString());
    });

    it("LNEX2- should load nodeset with array extension objects", async () => {
        // const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/plc_demo.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file1, xml_file2]);

        const nsSterfive = addressSpace.getNamespaceIndex("http://sterfive.com/Small_model/");
        nsSterfive.should.be.greaterThanOrEqual(0);

        const nsSterfiveInstance = addressSpace.getNamespaceIndex("http://sterfive.com/Small_instance/");
        nsSterfiveInstance.should.be.greaterThanOrEqual(0);

        const myTestObject = addressSpace.findNode(`ns=${nsSterfiveInstance};i=5002`)! as UAObject;

        const connectionDetailDataType = addressSpace.findDataType("ConnectionDetails", nsSterfive);
        // xx console.log(connectionDetailDataType.toString());
        // xx console.log(myTestObject.toString());

        const primaryConnection = myTestObject.getChildByName("PrimaryConnection")! as UAVariable;
        const otherConnections = myTestObject.getChildByName("OtherConnections")! as UAVariable;
        const connection2WithOptionalFields = myTestObject.getChildByName("Connection2WithOptionalFields")! as UAVariable;

        console.log("primaryConnection\n", primaryConnection.toString());
        console.log("otherConnections\n", otherConnections.toString());
        console.log("connection2WithOptionalFields\n", connection2WithOptionalFields.toString());
        console.log(otherConnections.readValue().toString());

        const otherConnectionsValue = otherConnections.readValue().value.value;
        otherConnectionsValue.should.be.instanceof(Array);
        otherConnectionsValue.length.should.eql(2);
        otherConnectionsValue[0].constructor.name.should.eql("ConnectionDetails");
        otherConnectionsValue[1].constructor.name.should.eql("ConnectionDetails");

        const c1 = addressSpace.constructExtensionObject(connectionDetailDataType!, {
            certificates: Buffer.from("Hello World"),
            url: "http://10.0.19.120"
        });
    });

    it("LNEX3 - should load an nodeset with a Extension Object Variable containing an enum", async () => {
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file1]);

        const nsSterfive = addressSpace.getNamespaceIndex("http://sterfive.com/Small_model/");

        const testVar = addressSpace.findNode("ns=1;i=6009")! as UAVariable;

        const value = testVar.readValue().value;
        // xx  console.log(value.toString());

        value.value.F1.should.eql(200);
        value.value.F2.should.eql([100, 200, 300]);
    });

    const x = (a: string) => a.replace(/^ +/gm, "").split("\n");

    it("LNEX4 - export back a nodeset2.xml file with dataType & enum as values", async () => {
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file1]);
        const namespace = addressSpace.getNamespace("http://sterfive.com/Small_model/");
        const xml = namespace.toNodeset2XML();
        // console.log(xml);

        // prettier-ignore
        x(xml).should.eql(x(`<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd" xmlns:ns1="http://sterfive.com/Small_model/Type.xsd">
    <NamespaceUris>
        <Uri>http://sterfive.com/Small_model/</Uri>
    </NamespaceUris>
    <Models>
        <Model ModelUri="http://sterfive.com/Small_model/" Version="1.0.0" PublicationDate="2021-11-12T07:45:13.000Z">
            <RequiredModel ModelUri="http://opcfoundation.org/UA/" Version="1.05.03" PublicationDate="2023-12-15T00:00:00.000Z"/>
        </Model>
    </Models>
    <Aliases>
        <Alias Alias="1:ConnectionDetails">ns=1;i=47</Alias>
        <Alias Alias="1:FlowDirection">ns=1;i=49</Alias>
        <Alias Alias="1:MyStructDataType">ns=1;i=3003</Alias>
        <Alias Alias="ByteString">i=15</Alias>
        <Alias Alias="EnumValueType">i=7594</Alias>
        <Alias Alias="HasComponent">i=47</Alias>
        <Alias Alias="HasDescription">i=39</Alias>
        <Alias Alias="HasEncoding">i=38</Alias>
        <Alias Alias="HasModellingRule">i=37</Alias>
        <Alias Alias="HasProperty">i=46</Alias>
        <Alias Alias="HasSubtype">i=45</Alias>
        <Alias Alias="HasTypeDefinition">i=40</Alias>
        <Alias Alias="LocalizedText">i=21</Alias>
        <Alias Alias="Organizes">i=35</Alias>
        <Alias Alias="String">i=12</Alias>
    </Aliases>
<!--ReferenceTypes-->
<!--DataTypes-->
    <UADataType NodeId="ns=1;i=3002" BrowseName="1:MyEnum">
        <DisplayName>MyEnum</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">i=29</Reference>
            <Reference ReferenceType="HasProperty">ns=1;i=6001</Reference>
        </References>
        <Definition Name="1:MyEnum">
            <Field Name="Green" Value="100"/>
            <Field Name="Orange" Value="200"/>
            <Field Name="Blue" Value="300"/>
        </Definition>
    </UADataType>
    <UAVariable NodeId="ns=1;i=6001" BrowseName="EnumValues" ParentNodeId="ns=1;i=3002" ValueRank="1" ArrayDimensions="3" DataType="EnumValueType">
        <DisplayName>EnumValues</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=68</Reference>
            <Reference ReferenceType="HasModellingRule">i=78</Reference>
        </References>
        <Value>
            <ListOfExtensionObject xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
                <ExtensionObject>
                    <TypeId>
                        <Identifier>i=7616</Identifier>
                    </TypeId>
                    <Body>
                        <EnumValueType>
                            <Value>100</Value>
                            <DisplayName>
                                <Text>Green</Text>
                            </DisplayName>
                            <Description>
                                <Text/>
                            </Description>
                        </EnumValueType>
                    </Body>
                </ExtensionObject>
                <ExtensionObject>
                    <TypeId>
                        <Identifier>i=7616</Identifier>
                    </TypeId>
                    <Body>
                        <EnumValueType>
                            <Value>200</Value>
                            <DisplayName>
                                <Text>Orange</Text>
                            </DisplayName>
                            <Description>
                                <Text/>
                            </Description>
                        </EnumValueType>
                    </Body>
                </ExtensionObject>
                <ExtensionObject>
                    <TypeId>
                        <Identifier>i=7616</Identifier>
                    </TypeId>
                    <Body>
                        <EnumValueType>
                            <Value>300</Value>
                            <DisplayName>
                                <Text>Blue</Text>
                            </DisplayName>
                            <Description>
                                <Text/>
                            </Description>
                        </EnumValueType>
                    </Body>
                </ExtensionObject>
            </ListOfExtensionObject>
        </Value>
    </UAVariable>
    <UADataType NodeId="ns=1;i=3003" BrowseName="1:MyStructDataType">
        <DisplayName>MyStructDataType</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">i=22</Reference>
            <Reference ReferenceType="HasEncoding">ns=1;i=5001</Reference>
            <Reference ReferenceType="HasEncoding">ns=1;i=5002</Reference>
            <Reference ReferenceType="HasEncoding">ns=1;i=5003</Reference>
        </References>
        <Definition Name="1:MyStructDataType">
            <Field Name="F1" DataType="ns=1;i=3002"/>
            <Field Name="F2" ArrayDimensions="0" ValueRank="1" DataType="ns=1;i=3002"/>
        </Definition>
    </UADataType>
    <UAVariable NodeId="ns=1;i=6006" BrowseName="1:MyStructType" DataType="String">
        <DisplayName>MyStructType</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=69</Reference>
        </References>
        <Value>
            <uax:String>MyStructDataType</uax:String>
        </Value>
    </UAVariable>
    <UAObject NodeId="ns=1;i=5001" BrowseName="Default Binary" SymbolicName="DefaultBinary">
        <DisplayName>Default Binary</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=76</Reference>
            <Reference ReferenceType="HasDescription">ns=1;i=6006</Reference>
        </References>
    </UAObject>
    <UAObject NodeId="ns=1;i=5003" BrowseName="Default JSON" SymbolicName="DefaultJson">
        <DisplayName>Default JSON</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=76</Reference>
        </References>
    </UAObject>
    <UAObject NodeId="ns=1;i=5002" BrowseName="Default XML" SymbolicName="DefaultXml">
        <DisplayName>Default XML</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=76</Reference>
            <Reference ReferenceType="HasDescription">ns=1;i=6007</Reference>
        </References>
    </UAObject>
    <UADataType NodeId="ns=1;i=47" BrowseName="1:ConnectionDetails">
        <DisplayName>ConnectionDetails</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">i=22</Reference>
            <Reference ReferenceType="HasEncoding">ns=1;i=182</Reference>
            <Reference ReferenceType="HasEncoding">ns=1;i=183</Reference>
            <Reference ReferenceType="HasEncoding">ns=1;i=80</Reference>
        </References>
        <Definition Name="1:ConnectionDetails">
            <Field Name="Certificates" ArrayDimensions="0" ValueRank="1" IsOptional="true" DataType="i=15"/>
            <Field Name="Url" DataType="i=12"/>
        </Definition>
    </UADataType>
    <UAObject NodeId="ns=1;i=183" BrowseName="Default JSON" SymbolicName="DefaultJson">
        <DisplayName>Default JSON</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=76</Reference>
        </References>
    </UAObject>
    <UAObject NodeId="ns=1;i=182" BrowseName="Default XML" SymbolicName="DefaultXml">
        <DisplayName>Default XML</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=76</Reference>
            <Reference ReferenceType="HasDescription">ns=1;i=1196</Reference>
        </References>
    </UAObject>
    <UADataType NodeId="ns=1;i=49" BrowseName="1:FlowDirection">
        <DisplayName>FlowDirection</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">i=29</Reference>
            <Reference ReferenceType="HasProperty">ns=1;i=1250</Reference>
        </References>
        <Definition Name="1:FlowDirection">
            <Field Name="Forward" Value="0"/>
            <Field Name="Reverse" Value="1"/>
        </Definition>
    </UADataType>
    <UAVariable NodeId="ns=1;i=1250" BrowseName="EnumStrings" ParentNodeId="ns=1;i=49" ValueRank="1" ArrayDimensions="2" DataType="LocalizedText">
        <DisplayName>EnumStrings</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=68</Reference>
            <Reference ReferenceType="HasModellingRule">i=78</Reference>
        </References>
        <Value>
            <ListOfLocalizedText xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
                <LocalizedText>
                    <Text>Forward</Text>
                </LocalizedText>
                <LocalizedText>
                    <Text>Reverse</Text>
                </LocalizedText>
            </ListOfLocalizedText>
        </Value>
    </UAVariable>
<!--ObjectTypes-->
<!--ObjectType - 1:Meter {{{{ -->
    <UAObjectType NodeId="ns=1;i=39" BrowseName="1:Meter">
        <DisplayName>Meter</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">i=58</Reference>
        </References>
    </UAObjectType>
<!--ObjectType - 1:Meter }}}}-->
<!--ObjectType - 1:LinearMeter {{{{ -->
    <UAObjectType NodeId="ns=1;i=40" BrowseName="1:LinearMeter">
        <DisplayName>LinearMeter</DisplayName>
        <References>
            <Reference ReferenceType="HasComponent">ns=1;i=1242</Reference>
            <Reference ReferenceType="HasComponent">ns=1;i=1522</Reference>
            <Reference ReferenceType="HasSubtype" IsForward="false">ns=1;i=39</Reference>
        </References>
    </UAObjectType>
    <UAVariable NodeId="ns=1;i=1522" BrowseName="1:FlowDirection" ParentNodeId="ns=1;i=40" DataType="1:FlowDirection">
        <DisplayName>FlowDirection</DisplayName>
        <References>
            <Reference ReferenceType="HasModellingRule">i=78</Reference>
            <Reference ReferenceType="HasProperty">ns=1;i=1523</Reference>
            <Reference ReferenceType="HasTypeDefinition">ns=1;i=44</Reference>
        </References>
    </UAVariable>
<!--ObjectType - 1:LinearMeter }}}}-->
<!--VariableTypes-->
    <UAVariableType NodeId="ns=1;i=42" BrowseName="1:ConnectionDetailsType" DataType="1:ConnectionDetails">
        <DisplayName>ConnectionDetailsType</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">i=63</Reference>
            <Reference ReferenceType="HasComponent">ns=1;i=11333</Reference>
            <Reference ReferenceType="HasComponent">ns=1;i=1194</Reference>
        </References>
        <Value>
            <ExtensionObject xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
                <TypeId>
                    <Identifier>ns=1;i=182</Identifier>
                </TypeId>
                <Body>
                    <ConnectionDetails xmlns="http://sterfive.com/Small_model/Types.xsd">
                        <Certificates>
                            <ByteString>SGVsbG8=</ByteString>
                            <ByteString>V29ybGQ=</ByteString>
                        </Certificates>
                        <Url>Put Default URL here</Url>
                    </ConnectionDetails>
                </Body>
            </ExtensionObject>
        </Value>
    </UAVariableType>
    <UAVariable NodeId="ns=1;i=11333" BrowseName="1:Url" ParentNodeId="ns=1;i=42" DataType="String">
        <DisplayName>Url</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
            <Reference ReferenceType="HasModellingRule">i=78</Reference>
        </References>
    </UAVariable>
    <UAVariable NodeId="ns=1;i=1194" BrowseName="1:Certificates" ParentNodeId="ns=1;i=42" AccessLevel="3" ValueRank="1" DataType="ByteString">
        <DisplayName>Certificates</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
            <Reference ReferenceType="HasModellingRule">i=80</Reference>
        </References>
    </UAVariable>
<!--Other Nodes-->
    <UAVariable NodeId="ns=1;i=1195" BrowseName="1:ConnectionDetails" DataType="String">
        <DisplayName>ConnectionDetails</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=69</Reference>
        </References>
        <Value>
            <uax:String>ConnectionDetails</uax:String>
        </Value>
    </UAVariable>
    <UAVariable NodeId="ns=1;i=6009" BrowseName="1:TestVar" AccessLevel="3" DataType="1:MyStructDataType">
        <DisplayName>TestVar</DisplayName>
        <References>
            <Reference ReferenceType="Organizes" IsForward="false">i=2253</Reference>
            <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
        </References>
        <Value>
            <ExtensionObject xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
                <TypeId>
                    <Identifier>ns=1;i=5002</Identifier>
                </TypeId>
                <Body>
                    <MyStructDataType xmlns="http://sterfive.com/Small_model/Types.xsd">
                        <F1>Orange_200</F1>
                        <F2>
                            <MyEnum>Green_100</MyEnum>
                            <MyEnum>Orange_200</MyEnum>
                            <MyEnum>Blue_300</MyEnum>
                        </F2>
                    </MyStructDataType>
                </Body>
            </ExtensionObject>
        </Value>
    </UAVariable>
</UANodeSet>`));
    });

    it("LNEX5 - export back a nodeset2.xml file with dataType & enum as values", async () => {
        const namespace = addressSpace.registerNamespace("MyNamespace");

        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.autoId]);

        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        nsAutoId.should.eql(3);

        const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;

        const scanResult = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {
            // ScanResult
            codeType: "Hello",
            scanData: {
                epc: {
                    pC: 12,
                    uId: Buffer.from("Hello"),
                    xpC_W1: 10,
                    xpC_W2: 12
                }
            },
            timestamp: new Date(Date.UTC(2018, 11, 23, 3, 45, 0)),
            location: {
                local: {
                    x: 100,
                    y: 200,
                    z: 300,
                    timestamp: new Date(Date.UTC(2018, 11, 23, 3, 50, 0)),
                    dilutionOfPrecision: 0.01,
                    usefulPrecision: 2
                }
            }
        });

        const myVar = namespace.addVariable({
            browseName: "MyVar",
            dataType: rfidScanResultDataTypeNode
        });
        myVar.setValueFromSource({ dataType: DataType.ExtensionObject, value: scanResult });

        const xml = namespace.toNodeset2XML();
        // console.log(xml);

        // prettier-ignore
        x(xml).should.eql(x(`<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd" xmlns:ns2="http://opcfoundation.org/UA/DI/Type.xsd" xmlns:ns3="http://opcfoundation.org/UA/AutoID/Type.xsd" xmlns:ns1="MyNamespace/Type.xsd">
    <NamespaceUris>
        <Uri>MyNamespace</Uri>
        <Uri>http://opcfoundation.org/UA/DI/</Uri>
        <Uri>http://opcfoundation.org/UA/AutoID/</Uri>
    </NamespaceUris>
    <Models>
        <Model ModelUri="MyNamespace" Version="0.0.0" PublicationDate="1900-01-01T00:00:00.000Z">
            <RequiredModel ModelUri="http://opcfoundation.org/UA/" Version="1.05.03" PublicationDate="2023-12-15T00:00:00.000Z"/>
            <RequiredModel ModelUri="http://opcfoundation.org/UA/DI/" Version="1.04.0" PublicationDate="2022-11-03T00:00:00.000Z"/>
            <RequiredModel ModelUri="http://opcfoundation.org/UA/AutoID/" Version="1.01" PublicationDate="2020-06-18T13:52:03.000Z"/>
        </Model>
    </Models>
    <Aliases>
        <Alias Alias="3:RfidScanResult">ns=3;i=3007</Alias>
        <Alias Alias="HasTypeDefinition">i=40</Alias>
    </Aliases>
    <!--ReferenceTypes-->
    <!--ObjectTypes-->
    <!--VariableTypes-->
    <!--Other Nodes-->
    <UAVariable NodeId="ns=1;i=1000" BrowseName="1:MyVar" AccessLevel="3" DataType="3:RfidScanResult">
        <DisplayName>MyVar</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
        </References>
        <Value>
            <ExtensionObject xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
                <TypeId>
                    <Identifier>ns=3;i=5012</Identifier>
                </TypeId>
                <Body>
                    <RfidScanResult xmlns="http://opcfoundation.org/UA/AutoID/Types.xsd">
                        <CodeType>Hello</CodeType>
                        <ScanData>
                            <Epc>
                                <PC>0</PC>
                                <UId>SGVsbG8=</UId>
                                <XPC_W1>0</XPC_W1>
                                <XPC_W2>0</XPC_W2>
                            </Epc>
                        </ScanData>
                        <Timestamp>2018-12-23T03:45:00.000Z</Timestamp>
                        <Location>
                            <Local>
                                <X>100</X>
                                <Y>200</Y>
                                <Z>300</Z>
                                <Timestamp>2018-12-23T03:50:00.000Z</Timestamp>
                                <DilutionOfPrecision>0.01</DilutionOfPrecision>
                                <UsefulPrecision>2</UsefulPrecision>
                            </Local>
                        </Location>
                        <Sighting/>
                    </RfidScanResult>
                </Body>
            </ExtensionObject>
        </Value>
    </UAVariable>
</UANodeSet>`));

        const tmp_nodeset2 = path.join(os.tmpdir(), "temp_nodeset2.xml");
        await fs.promises.writeFile(tmp_nodeset2, xml);
        {
            const addressSpace2 = AddressSpace.create();
            await generateAddressSpace(addressSpace2, [nodesets.standard, nodesets.di, nodesets.autoId, tmp_nodeset2]);

            const ns = addressSpace2.getNamespaceIndex("MyNamespace");

            const v = addressSpace2.findNode(`ns=${ns};i=1000`)! as UAVariable;

            // console.log("v", v.toString());

            const exObjReloaded = v.readValue().value.value;

            addressSpace2.dispose();

            exObjReloaded.toString().should.eql(scanResult.toString());
        }
    });

    it("LNEX6- should load nodeset with extension objects and GUID elements", async () => {
        const doDebug = false;
        const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/nodeset_with_guid.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file]);
        const urlVariable = addressSpace.findNode("ns=1;i=6129")! as UAVariable;
        const dataValue = urlVariable.readValue();
        doDebug && console.log(dataValue.toString());
        const ext = dataValue.value.value as DataSetMetaDataType;
        ext.dataSetClassId.should.eql("f0ade254-0008-4960-bbe6-eaaf6308ada2");
    });

    it("LNEX7- should load nodeset with extension objects and Int64/UInt64 elements", async () => {
        const doDebug = true;

        const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/nodeset_with_int64_values.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file]);

        const uint64Variable = addressSpace.findNode("ns=1;i=1000")! as UAVariable;
        const dataValue = uint64Variable.readValue();
        doDebug && console.log(dataValue.toString());
        const uint64 = dataValue.value.value as UInt64;
        uint64.should.eql([0, 1234567890]);

        const int64Variable = addressSpace.findNode("ns=1;i=1001")! as UAVariable;
        const dataValue1 = int64Variable.readValue();
        console.log(dataValue1.toString());
        const int64 = dataValue1.value.value as UInt64;
        int64.should.eql([0xffffffff, 0xffffffff - 1234567890 + 1]);
    });

    it("LNEX8 - namespace when adding object to already existing objects", async () => {
        const addressSpace = AddressSpace.create();
        create_minimalist_address_space_nodeset(addressSpace);

        // this unit test simulate the case of di:DeviceSet
        // where objects are added to the existing folder di:DeviceSet
        // ---------------------------------------[ Namespace A]--------
        //    [Object-A]
        // -------------------------------------------------------------
        // ---------------------------------------| Namespace B]--------
        //         |
        //         +---> [Object-B1]
        //         |
        //         +---> [Object-B2]
        // -------------------------------------------------------------
        //
        // Because B1 and B2 are independent in terms of Types ( no types of A depends on B and vice and versa)
        // and Because namespace A is loaded before namespace B
        // then object B1 and B2 belongs to namespace B
        const namespace1 = addressSpace.registerNamespace("A");
        const objectA = namespace1.addObject({ browseName: "A", organizedBy: addressSpace.rootFolder.objects });

        const namespace2 = addressSpace.registerNamespace("B");
        const objectB1 = namespace2.addObject({ browseName: "B1", componentOf: objectA });

        const objectB2 = namespace2.addObject({ browseName: "B2" });
        objectA.addReference({ referenceType: "HasComponent", nodeId: objectB2 });

        _recomputeRequiredModelsFromTypes2(namespace1).requiredNamespaceIndexes.should.eql([0]);
        _recomputeRequiredModelsFromTypes2(namespace2).requiredNamespaceIndexes.should.eql([0]);
        const priorityTable = constructNamespacePriorityTable(addressSpace).priorityTable;
        priorityTable.should.eql([0, 1, 2]);
        _getCompleteRequiredModelsFromValuesAndReferences(namespace2, priorityTable).should.eql([0, 1]);

        const xmlA = namespace1.toNodeset2XML();
        doDebug && console.log(xmlA);

        const xmlB = namespace2.toNodeset2XML();
        doDebug && console.log(xmlB);

        addressSpace.dispose();

        x(xmlA).should.eql(
            x(`<?xml version="1.0"?>
        <UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd" xmlns:ns1="A/Type.xsd">
            <NamespaceUris>
                <Uri>A</Uri>
            </NamespaceUris>
            <Models>
                <Model ModelUri="A" Version="0.0.0" PublicationDate="1900-01-01T00:00:00.000Z">
                    <RequiredModel ModelUri="http://opcfoundation.org/UA/" Version="0.0.0" PublicationDate="1900-01-01T00:00:00.000Z"/>
                </Model>
            </Models>
            <Aliases>
                <Alias Alias="HasComponent">i=47</Alias>
                <Alias Alias="HasTypeDefinition">i=40</Alias>
                <Alias Alias="Organizes">i=35</Alias>
            </Aliases>
        <!--ReferenceTypes-->
        <!--ObjectTypes-->
        <!--VariableTypes-->
        <!--Other Nodes-->
        <!--Object - 1:A {{{{ -->
            <UAObject NodeId="ns=1;i=1000" BrowseName="1:A">
                <DisplayName>A</DisplayName>
                <References>
                    <Reference ReferenceType="HasTypeDefinition">i=58</Reference>
                    <Reference ReferenceType="Organizes" IsForward="false">i=85</Reference>
                </References>
            </UAObject>
        <!--Object - 1:A }}}} -->
        </UANodeSet>`)
        );

        x(xmlB).should.eql(
            x(`<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd" xmlns:ns2="A/Type.xsd" xmlns:ns1="B/Type.xsd">
    <NamespaceUris>
        <Uri>B</Uri>
        <Uri>A</Uri>
    </NamespaceUris>
    <Models>
        <Model ModelUri="B" Version="0.0.0" PublicationDate="1900-01-01T00:00:00.000Z">
            <RequiredModel ModelUri="http://opcfoundation.org/UA/" Version="0.0.0" PublicationDate="1900-01-01T00:00:00.000Z"/>
            <RequiredModel ModelUri="A" Version="0.0.0" PublicationDate="1900-01-01T00:00:00.000Z"/>
        </Model>
    </Models>
    <Aliases>
        <Alias Alias="HasComponent">i=47</Alias>
        <Alias Alias="HasTypeDefinition">i=40</Alias>
    </Aliases>
<!--ReferenceTypes-->
<!--ObjectTypes-->
<!--VariableTypes-->
<!--Other Nodes-->
<!--Object - 1:B1 {{{{ -->
    <UAObject NodeId="ns=1;i=1000" BrowseName="1:B1" ParentNodeId="ns=2;i=1000">
        <DisplayName>B1</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=58</Reference>
            <Reference ReferenceType="HasComponent" IsForward="false">ns=2;i=1000</Reference>
        </References>
    </UAObject>
<!--Object - 1:B1 }}}} -->
<!--Object - 1:B2 {{{{ -->
    <UAObject NodeId="ns=1;i=1001" BrowseName="1:B2">
        <DisplayName>B2</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=58</Reference>
            <Reference ReferenceType="HasComponent" IsForward="false">ns=2;i=1000</Reference>
        </References>
    </UAObject>
<!--Object - 1:B2 }}}} -->
</UANodeSet>`)
        );
    });

    it("LNEX9 - loading namespace with matrix variable - and no explicit default value", async () => {
        const tmpFile = path.join(os.tmpdir(), "tmp.xml");

        async function createNodeSet2WithMatrixVariable() {
            const addressSpace = AddressSpace.create();
            create_minimalist_address_space_nodeset(addressSpace);

            const namespace1 = addressSpace.registerNamespace("A");
            const objectA = namespace1.addObject({ browseName: "A", organizedBy: addressSpace.rootFolder.objects });
            const matrixVariable = namespace1.addVariable({
                browseName: "MatrixVariable",
                nodeId: "s=MatrixVariable",
                dataType: DataType.Double,
                arrayDimensions: [0, 3],
                valueRank: 2
            });
            const xmlA = namespace1.toNodeset2XML();
            doDebug && console.log(xmlA);
            addressSpace.dispose();
            await fs.promises.writeFile(tmpFile, xmlA);
        }
        await createNodeSet2WithMatrixVariable();

        const addressSpace2 = AddressSpace.create();
        try {
            await generateAddressSpace(addressSpace2, [nodesets.standard, tmpFile]);
            const ns = addressSpace2.getNamespaceIndex("A");

            const v = addressSpace2.findNode(`ns=${ns};s=MatrixVariable`)! as UAVariable;
            const value = v.readValue().value.value;
            should(value.length).eql(0);
            should(value).be.instanceOf(Float64Array);
        } finally {
            addressSpace2.dispose();
        }
    });
});
