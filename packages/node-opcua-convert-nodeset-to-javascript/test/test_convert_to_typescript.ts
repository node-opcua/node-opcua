import * as fs from "fs";
import * as path from "path";
import * as chalk from "chalk";
import "should";

import { AddressSpace, PseudoSession, UAVariable } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import {
    convertTypeToTypescript,
    ReferenceDescriptionEx,
    walkThroughObjectTypes,
    walkThroughDataTypes,
    walkThroughReferenceTypes,
    walkThroughVariableTypes,
    convertNamespaceTypeToTypescript
} from "..";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Convert to Typescript", function (this: any) {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            nodesets.adi,
            nodesets.autoId,
            nodesets.machineVision,
            nodesets.commercialKitchenEquipment,
            nodesets.gds
        ]);

        const namespaceArrayVar = addressSpace.findNode("Server_NamespaceArray") as UAVariable;
        if (namespaceArrayVar) {
            namespaceArrayVar.setValueFromSource({
                dataType: "String",
                value: addressSpace.getNamespaceArray().map((n) => n.namespaceUri)
            });
        }
    });
    before(() => {
        const tmpFolder = path.join(__dirname, "../tmp");
        if (!fs.existsSync(tmpFolder)) {
            fs.mkdirSync(tmpFolder);
        }
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should convert DeviceType", async () => {
        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        nsDI.should.be.greaterThan(0);
        const d = addressSpace.findObjectType("DeviceType", nsDI)!;
        const deviceDataTypeNodeId = d.nodeId;
        const session = new PseudoSession(addressSpace);


        const { content } = await convertTypeToTypescript(session, deviceDataTypeNodeId);

        fs.writeFileSync(path.join(__dirname, "../tmp/node-opcua-di.ts"), content);

        /*        content.should.eql(
                    `interface UATopologyElementType extends UABaseObjectType {
        }
        interface UAComponentType extends UATopologyElementType {
        }
        interface UADeviceType extends UAComponentType {
        }`
                );
                */
    });
    xit("should convert ChromatographDevice ", async () => {
        const nsADI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        nsADI.should.be.greaterThan(0);
        const d = addressSpace.findObjectType("ChromatographDeviceType", nsADI)!;
        const chromatographDeviceTypeNodeId = d.nodeId;
        const session = new PseudoSession(addressSpace);

        const { content } = await convertTypeToTypescript(session, chromatographDeviceTypeNodeId);
        fs.writeFileSync(path.join(__dirname, "../tmp/node-opcua-adi.ts"), content);
        content.should.eql(
            `import { UAAnalyserDevice } from "./node-opcua-adi"
export interface UAChromatographDevice extends UAAnalyserDevice {
}`
        );
    });
    xit("should convert AnalyserDevice ", async () => {
        const nsADI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        nsADI.should.be.greaterThan(0);
        const d = addressSpace.findObjectType("AnalyserDeviceType", nsADI)!;
        const chromatographDeviceTypeNodeId = d.nodeId;
        const session = new PseudoSession(addressSpace);

        const { content } = await convertTypeToTypescript(session, chromatographDeviceTypeNodeId);
        fs.writeFileSync(path.join(__dirname, "../tmp/node-opcua-adi_UAAnalyserDevice.ts"), content);
        content.should.eql(
            `import { UAAnalyserDevice } from "./node-opcua-adi"
export interface UAChromatographDevice extends UAAnalyserDevice {
}`
        );
    });

    const colors = [
        chalk.grey,
        chalk.yellow,
        chalk.green,
        chalk.cyan,
        chalk.blue,
        chalk.greenBright,
        chalk.bgGreenBright
    ];
    it("workThrough", async () => {
        const parents: any = {};
        const nodeVisitor = {
            async visit(reference: ReferenceDescriptionEx, level: number): Promise<void> {
                if (reference.nodeId.namespace === 0) {
                    return;
                }
                if (reference.parent && !parents[reference.parent.nodeId.toString()]) {
                    const r = [];
                    let cur = reference;
                    while (cur.parent && !parents[cur.parent.nodeId.toString()]) {
                        r.push(cur.parent);
                        cur = cur.parent;
                    }
                    const start = level - r.length;
                    for (let i = 0; i < r.length; i++) {
                        const rr = r[r.length - 1 - i];

                        parents[rr.nodeId.toString()] = 1;

                        const c = colors[rr.nodeId.namespace];
                        console.log("".padEnd(start + i + 1, " "), c(rr.browseName.toString()));
                    }
                }

                const c = colors[reference.nodeId.namespace];
                console.log(
                    "".padEnd(level + 1, " "),
                    c(reference.browseName.toString()),
                    " base = ",
                    reference.parent.browseName.toString()
                );
                parents[reference.nodeId.toString()] = 1;
            }
        };
        const session = new PseudoSession(addressSpace);
        console.log("---- ObjectTypes");
        await walkThroughObjectTypes(session, nodeVisitor);
        console.log("---- VariableTypes");
        await walkThroughVariableTypes(session, nodeVisitor);
        console.log("---- DataTypes");
        await walkThroughDataTypes(session, nodeVisitor);
        console.log("---- ReferenceTypes");
        await walkThroughReferenceTypes(session, nodeVisitor);
    });
    it("convertNamespaceTypeToTypescript", async () => {
        const session = new PseudoSession(addressSpace);
        await convertNamespaceTypeToTypescript(session, 2);
    });
});
