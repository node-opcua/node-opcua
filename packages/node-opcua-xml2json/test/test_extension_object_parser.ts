// tslint:disable:no-console
import * as mocha from "mocha";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import * as should from "should";
import { makeExtensionObjectReader, Definition, Xml2Json } from "..";

const doDebug = checkDebugFlag("TEST");
const debugLog = make_debugLog("TEST");

const _should = should;

describe("Test ExtensionObject parsing (with definition)", () => {
    it("should parse a definition node and convert it to a parser", async () => {
        const s = `
<Definition Name="1:MyOtherStructureDataType">
    <Field DataType="String" ValueRank="1" Name="Names"/>
    <Field DataType="MyStructureDataType" ValueRank="1" Name="Values"/>
</Definition>`;

        const MyOtherStructureDataTypeDef = {
            name: "MyOtherStructureDataType",

            fields: [
                { name: "Names", valueRank: 1, dataType: "String" },
                { name: "Values", valueRank: 1, dataType: "MyStructureDataType" }
            ]
        };
        const s2 = `
<Definition Name="1:MyStructureDataType">
    <Field DataType="Int32" Name="Id"/>
    <Field DataType="Double" Name="HighValue"/>
    <Field DataType="Double" Name="LowValue"/>
    <Field DataType="LocalizedText" Name="Comments"/>
    <Field DataType="EUInformation" Name="EngineeringUnits"/>
</Definition>`;

        const MyStructureDataTypeDef: Definition = {
            name: "MyStructureDataType",

            fields: [
                { name: "Id", valueRank: -1, dataType: "Int32" },
                { name: "HighValue", valueRank: -1, dataType: "Double" },
                { name: "LowValue", valueRank: -1, dataType: "Double" },
                { name: "Comments", valueRank: -1, dataType: "LocalizedText" },
                { name: "EngineeringUnits", valueRank: -1, dataType: "EUInformation" }
            ]
        };

        const EUInformationDef: Definition = {
            name: "EUInformation",

            fields: [
                { name: "NamespaceUri", dataType: "String" },
                { name: "UnitId", dataType: "UInt32" },
                { name: "DisplayName", dataType: "String" },
                { name: "Description", dataType: "String" }
            ]
        };

        const definitionMap = {
            findDefinition(name: string): Definition {
                switch (name) {
                    case "MyStructureDataType":
                        return MyStructureDataTypeDef;
                    case "MyOtherStructureDataType":
                        return MyOtherStructureDataTypeDef;
                    case "EUInformation":
                        return EUInformationDef;
                    default:
                        throw new Error("not found: " + name);
                }
            }
        };

        const reader = makeExtensionObjectReader("MyOtherStructureDataType", definitionMap, {});

        const parser = new Xml2Json(reader);

        const userDefinedExtensionObject = `
<MyOtherStructureDataType xmlns="http://yourorganisation.org/my_data_type/Types.xsd">
    <Names>
        <String xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">Hello</String>
        <String xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">World</String>
    </Names>
    <Values>
        <MyStructureDataType xmlns="http://yourorganisation.org/my_data_type/Types.xsd">
            <Id>1</Id>
            <HighValue>10</HighValue>
            <LowValue>-10</LowValue>
            <Comments>Comment1</Comments>
            <EngineeringUnits>
                <NamespaceUri xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"></NamespaceUri>
                <UnitId xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">11</UnitId>
                <DisplayName xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"/>
                <Description xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"/>
            </EngineeringUnits>
        </MyStructureDataType>
        <MyStructureDataType xmlns="http://yourorganisation.org/my_data_type/Types.xsd">
            <Id>2</Id>
            <HighValue>20</HighValue>
            <LowValue>-20</LowValue>
            <Comments>
                <Locale/>
                <Text>Comment2</Text>
            </Comments>
            <EngineeringUnits>
                <NamespaceUri xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">NAMESPACE2</NamespaceUri>
                <UnitId xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">22</UnitId>
                <DisplayName xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
                    Holla
                </DisplayName>
                <Description xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd"/>
            </EngineeringUnits>
        </MyStructureDataType>
    </Values>
</MyOtherStructureDataType>`;

        const a = await parser.parseString(userDefinedExtensionObject);

        //  console.log("return value =", JSON.stringify(a, null, " "));

        a.should.eql({
            names: ["Hello", "World"],
            values: [
                {
                    id: 1,
                    highValue: 10,
                    lowValue: -10,
                    comments: {},
                    engineeringUnits: {
                        namespaceUri: "",
                        unitId: 11,
                        displayName: "",
                        description: ""
                    }
                },
                {
                    id: 2,
                    highValue: 20,
                    lowValue: -20,
                    comments: {
                        text: "Comment2",
                        locale: ""
                    },
                    engineeringUnits: {
                        namespaceUri: "NAMESPACE2",
                        unitId: 22,
                        displayName: "Holla",
                        description: ""
                    }
                }
            ]
        });
    });
});
