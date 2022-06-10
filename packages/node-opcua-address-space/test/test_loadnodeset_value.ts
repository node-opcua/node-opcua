import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import "should";
import { nodesets } from "node-opcua-nodesets";
import { AttributeIds } from "node-opcua-basic-types";
import { DataType } from "node-opcua-variant";
import { AddressSpace, SessionContext, UAObject, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

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

        const c1 = addressSpace.constructExtensionObject(connectionDetailDataType, {
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

    const x = (a: string) => a.replace(/^ +/gm, "");

    it("LNEX4 - export back a nodeset2.xml file with dataType & enum as values", async () => {
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file1]);
        const namespace = addressSpace.getNamespace("http://sterfive.com/Small_model/");
        const xml = namespace.toNodeset2XML();
        // xx  console.log(xml);

        // prettier-ignore
        x(xml).should.eql(x(`<?xml version="1.0"?>
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <NamespaceUris>
        <Uri>http://sterfive.com/Small_model/</Uri>
    </NamespaceUris>
    <Models>
        <Model ModelUri="http://sterfive.com/Small_model/" Version="1.0.0" PublicationDate="2021-11-12T07:45:13.000Z">
            <RequiredModel ModelUri="http://opcfoundation.org/UA/" Version="1.05.01" PublicationDate="2022-02-24T00:00:00.000Z"/>
        </Model>
    </Models>
    <Aliases>
        <Alias Alias="1:ConnectionDetails">ns=1;i=47</Alias>
        <Alias Alias="1:FlowDirection">ns=1;i=49</Alias>
        <Alias Alias="1:MyStruct">ns=1;i=3003</Alias>
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
    <UAVariable NodeId="ns=1;i=6001" BrowseName="EnumValues" ValueRank="1" ArrayDimensions="3" DataType="EnumValueType">
        <DisplayName>EnumValues</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=68</Reference>
            <Reference ReferenceType="HasModellingRule">i=78</Reference>
        </References>
        <Value>
            <ListOfExtensionObject>
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
    <UADataType NodeId="ns=1;i=3003" BrowseName="1:MyStruct">
        <DisplayName>MyStruct</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">i=22</Reference>
            <Reference ReferenceType="HasEncoding">ns=1;i=5001</Reference>
            <Reference ReferenceType="HasEncoding">ns=1;i=5002</Reference>
            <Reference ReferenceType="HasEncoding">ns=1;i=5003</Reference>
        </References>
        <Definition Name="1:MyStruct">
            <Field Name="F1" DataType="ns=1;i=3002"/>
            <Field Name="F2" ArrayDimensions="0" ValueRank="1" DataType="ns=1;i=3002"/>
        </Definition>
    </UADataType>
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
    <UAVariable NodeId="ns=1;i=1250" BrowseName="EnumStrings" ValueRank="1" ArrayDimensions="2" DataType="LocalizedText">
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
    <UAVariable NodeId="ns=1;i=1522" BrowseName="1:FlowDirection" DataType="1:FlowDirection">
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
            <ExtensionObject>
                <TypeId>
                    <Identifier>ns=1;i=182</Identifier>
                </TypeId>
                <Body>
                    <ConnectionDetails>
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
    <UAVariable NodeId="ns=1;i=11333" BrowseName="1:Url" DataType="String">
        <DisplayName>Url</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
            <Reference ReferenceType="HasModellingRule">i=78</Reference>
        </References>
    </UAVariable>
    <UAVariable NodeId="ns=1;i=1194" BrowseName="1:Certificates" AccessLevel="3" ValueRank="1" DataType="ByteString">
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
            <String>ConnectionDetails</String>
        </Value>
    </UAVariable>
    <!--Object - Default XML {{{{ -->
    <UAObject NodeId="ns=1;i=182" BrowseName="Default XML" SymbolicName="DefaultXml">
        <DisplayName>Default XML</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=76</Reference>
            <Reference ReferenceType="HasDescription">ns=1;i=1196</Reference>
        </References>
    </UAObject>
    <!--Object - Default XML }}}} -->
    <!--Object - Default JSON {{{{ -->
    <UAObject NodeId="ns=1;i=183" BrowseName="Default JSON" SymbolicName="DefaultJson">
        <DisplayName>Default JSON</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=76</Reference>
        </References>
    </UAObject>
    <!--Object - Default JSON }}}} -->
    <!--Object - Default Binary {{{{ -->
    <UAObject NodeId="ns=1;i=5001" BrowseName="Default Binary" SymbolicName="DefaultBinary">
        <DisplayName>Default Binary</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=76</Reference>
            <Reference ReferenceType="HasDescription">ns=1;i=6006</Reference>
        </References>
    </UAObject>
    <!--Object - Default Binary }}}} -->
    <!--Object - Default XML {{{{ -->
    <UAObject NodeId="ns=1;i=5002" BrowseName="Default XML" SymbolicName="DefaultXml">
        <DisplayName>Default XML</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=76</Reference>
            <Reference ReferenceType="HasDescription">ns=1;i=6007</Reference>
        </References>
    </UAObject>
    <!--Object - Default XML }}}} -->
    <!--Object - Default JSON {{{{ -->
    <UAObject NodeId="ns=1;i=5003" BrowseName="Default JSON" SymbolicName="DefaultJson">
        <DisplayName>Default JSON</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=76</Reference>
        </References>
    </UAObject>
    <!--Object - Default JSON }}}} -->
    <UAVariable NodeId="ns=1;i=6006" BrowseName="1:MyStruct" DataType="String">
        <DisplayName>MyStruct</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=69</Reference>
        </References>
        <Value>
            <String>MyStruct</String>
        </Value>
    </UAVariable>
    <UAVariable NodeId="ns=1;i=6009" BrowseName="1:TestVar" AccessLevel="3" DataType="1:MyStruct">
        <DisplayName>TestVar</DisplayName>
        <References>
            <Reference ReferenceType="Organizes" IsForward="false">i=2253</Reference>
            <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
        </References>
        <Value>
            <ExtensionObject>
                <TypeId>
                    <Identifier>ns=1;i=5002</Identifier>
                </TypeId>
                <Body>
                    <MyStruct>
                        <F1>Orange_200</F1>
                        <F2>
                            <MyEnum>Green_100</MyEnum>
                            <MyEnum>Orange_200</MyEnum>
                            <MyEnum>Blue_300</MyEnum>
                        </F2>
                    </MyStruct>
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
<UANodeSet xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uax="http://opcfoundation.org/UA/2008/02/Types.xsd" xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <NamespaceUris>
        <Uri>MyNamespace</Uri>
        <Uri>http://opcfoundation.org/UA/AutoID/</Uri>
        <Uri>http://opcfoundation.org/UA/DI/</Uri>
    </NamespaceUris>
    <Models>
        <Model ModelUri="MyNamespace" Version="0.0.0" PublicationDate="1900-01-01T00:00:00.000Z">
            <RequiredModel ModelUri="http://opcfoundation.org/UA/" Version="1.05.01" PublicationDate="2022-02-24T00:00:00.000Z"/>
            <RequiredModel ModelUri="http://opcfoundation.org/UA/AutoID/" Version="1.01" PublicationDate="2020-06-18T13:52:03.000Z"/>
            <RequiredModel ModelUri="http://opcfoundation.org/UA/DI/" Version="1.03.1" PublicationDate="2021-09-07T00:00:00.000Z"/>
        </Model>
    </Models>
    <Aliases>
        <Alias Alias="2:RfidScanResult">ns=2;i=3007</Alias>
        <Alias Alias="HasTypeDefinition">i=40</Alias>
    </Aliases>
    <!--ReferenceTypes-->
    <!--ObjectTypes-->
    <!--VariableTypes-->
    <!--Other Nodes-->
    <UAVariable NodeId="ns=1;i=1000" BrowseName="1:MyVar" AccessLevel="3" DataType="2:RfidScanResult">
        <DisplayName>MyVar</DisplayName>
        <References>
            <Reference ReferenceType="HasTypeDefinition">i=63</Reference>
        </References>
        <Value>
            <ExtensionObject>
                <TypeId>
                    <Identifier>ns=2;i=5012</Identifier>
                </TypeId>
                <Body>
                    <RfidScanResult>
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
});
