import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { Argument } from "node-opcua-types";
import { DataType, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, type UAObjectType } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";

// see https://github.com/node-opcua/node-opcua/issues/1781
//
// the exporter translates every NodeId a value holds (here the DataType of a method Argument),
// so the namespace of such a NodeId must be part of the dependency set of the exported namespace,
// even when nothing else (type definition, supertype, reference) points to it.
describe("issue 1781 - a NodeId held by a value is a dependency of the exported namespace", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 30000));

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.fxData, nodesets.fxAc]);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("I1781-1 exports an FxAsset whose VerifyAsset argument is an FX/Data enumeration", () => {
        const nsFxAc = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/FX/AC/");
        const fxAssetType = addressSpace.findObjectType("FxAssetType", nsFxAc) as UAObjectType;
        should(fxAssetType).not.eql(null);

        const namespace = addressSpace.registerNamespace("urn:test:issue1781:fx");
        fxAssetType.instantiate({
            browseName: "MyAsset",
            namespace,
            organizedBy: addressSpace.rootFolder.objects,
            optionals: ["VerifyAsset"]
        });

        // here FX/Data is also reached through the types of FX/AC; I1781-2 isolates the value path
        const xml = namespace.toNodeset2XML();
        should(xml).match(/<Uri>http:\/\/opcfoundation.org\/UA\/FX\/Data\/<\/Uri>/);
        should(xml).match(/ModelUri="http:\/\/opcfoundation.org\/UA\/FX\/Data\/"/);
    });

    it("I1781-2 exports an Argument whose DataType lives in a namespace nothing else refers to", () => {
        const typesNamespace = addressSpace.registerNamespace("urn:test:issue1781:types");
        const myEnum = typesNamespace.addEnumerationType({
            browseName: "MyEnum",
            enumeration: ["A", "B"]
        });

        const namespace = addressSpace.registerNamespace("urn:test:issue1781:instances");
        namespace.addVariable({
            browseName: "Arguments",
            dataType: "Argument",
            valueRank: 1,
            organizedBy: addressSpace.rootFolder.objects,
            value: {
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: [new Argument({ name: "Mode", dataType: myEnum.nodeId, valueRank: -1 })]
            }
        });

        // used to throw NodesetExportError: namespace N of ns=N;i=1000 is not in the dependency set
        const xml = namespace.toNodeset2XML();
        should(xml).match(/<Uri>urn:test:issue1781:types<\/Uri>/);
    });
});
