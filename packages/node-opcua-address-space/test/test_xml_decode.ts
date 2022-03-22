import * as util from "util";
import "should";
import { coerceNodeId, NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StructureDefinition } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { Xml2Json } from "node-opcua-xml2json";

import { AddressSpace } from "..";
import { generateAddressSpace } from "../distNodeJS";
import { decodeXmlExtensionObject } from "../source/loader/decode_xml_extension_object";
import { makeXmlExtensionObjectReader } from "../source/loader/make_xml_extension_object_parser";

describe("test xml decode", function () {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(async () => {
        addressSpace.dispose();
    });
    it("should xml decode", () => {
        const definition = new StructureDefinition({
            fields: [
                {
                    dataType: resolveNodeId(DataType.ByteString),
                    name: "Certificates",
                    arrayDimensions: [],
                    valueRank: 1,
                    description: "some description",
                    isOptional: true,
                    maxStringLength: 0
                },
                {
                    dataType: resolveNodeId(DataType.String),
                    name: "Url",
                    arrayDimensions: [],
                    valueRank: -1,
                    description: "some description",
                    isOptional: true,
                    maxStringLength: 0
                }
            ]
        });

        const definitionMap = {
            findDefinition(dataTypeNodeId: NodeId): { name: string; definition: StructureDefinition } {
                switch (dataTypeNodeId.toString()) {
                    case coerceNodeId("ns=1;i=1").toString(): {
                        return { name: "ConnectionDetails", definition };
                    }
                    default:
                        throw new Error("not implemented" + dataTypeNodeId.toString());
                }
            }
        };
        const xmlBody = `
<ConnectionDetails xmlns="http://sterfive.com/Small_model/Types.xsd">
    <EncodingMask>1</EncodingMask>
    <Certificates>
        <ByteString xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">SGVsbG8=</ByteString>
        <ByteString xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">V29ybGQ=</ByteString>
    </Certificates>
    <Url>http://10.0.19.124</Url>
</ConnectionDetails>
`;

        const reader = makeXmlExtensionObjectReader(coerceNodeId("ns=1;i=1"), definitionMap, {});
        const parser2 = new Xml2Json(reader);
        const pojo = parser2.parseStringSync(xmlBody);
        console.log(util.inspect(pojo, { colors: true, depth: 10 }));
        (pojo.certificates as Buffer[]).length.should.eql(2);
        pojo.certificates[0].toString("ascii").should.eql("Hello");
        pojo.certificates[1].toString("ascii").should.eql("World");
        (pojo.url as string).should.eql("http://10.0.19.124");
    });
});
