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

    const options = {
        baseFolder: path.join(__dirname, "../tmp"),
        prefix: "node-opcua-nodeset-",
    };
    const referenceFolder = path.join(__dirname,"./references/");
    const actualFolder = path.join(__dirname,"../tmp/");
    it("P1 - should convert DeviceType", async () => {
        const filename = "node-opcua-di.txt";

        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        nsDI.should.be.greaterThan(0);
        const d = addressSpace.findObjectType("DeviceType", nsDI)!;
        const deviceDataTypeNodeId = d.nodeId;
        const session = new PseudoSession(addressSpace);

        const { content , dependencies} = await convertTypeToTypescript(session, deviceDataTypeNodeId, options);

        fs.writeFileSync(path.join(actualFolder, filename), content);
        const expectedContent = fs.readFileSync(path.join(referenceFolder,filename), "ascii");
        content.should.eql(expectedContent);

    });
    it("P2 - should convert ChromatographDevice ", async () => {
        const filename = "ChromatographDeviceType.txt";
 
        const nsADI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        nsADI.should.be.greaterThan(0);
        const d = addressSpace.findObjectType("ChromatographDeviceType", nsADI)!;
        const chromatographDeviceTypeNodeId = d.nodeId;
        const session = new PseudoSession(addressSpace);

        const { content } = await convertTypeToTypescript(session, chromatographDeviceTypeNodeId, options);
        fs.writeFileSync(path.join(actualFolder, filename), content);
 
        const expectedContent = fs.readFileSync(path.join(referenceFolder,filename), "ascii");
        content.should.eql(expectedContent);
    
    });
    it("P3 - should convert AnalyserDevice ", async () => {
        const filename = "node-opcua-adi_UAAnalyserDevice.txt"
 
        const nsADI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        nsADI.should.be.greaterThan(0);
        const d = addressSpace.findObjectType("AnalyserDeviceType", nsADI)!;
        const chromatographDeviceTypeNodeId = d.nodeId;
        const session = new PseudoSession(addressSpace);

        const { content } = await convertTypeToTypescript(session, chromatographDeviceTypeNodeId, options);
        fs.writeFileSync(path.join(actualFolder, filename), content);
 
        const expectedContent = fs.readFileSync(path.join(referenceFolder,filename), "ascii");
        content.should.eql(expectedContent);
    });
    it("P4 - should convert UASessionSecurityDiagnostics ", async () => {
        const filename = "node-opcua-ua_UASessionSecurityDiagnostics.txt"

        const d = addressSpace.findVariableType("SessionSecurityDiagnosticsType", 0)!;
        const typeNodeId = d.nodeId;
        const session = new PseudoSession(addressSpace);

        const { content } = await convertTypeToTypescript(session, typeNodeId, options);
        fs.writeFileSync(path.join(actualFolder, filename), content);
 
        const expectedContent = fs.readFileSync(path.join(referenceFolder,filename), "ascii");
        content.should.eql(expectedContent);
    });
    const colors = [chalk.grey, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.greenBright, chalk.bgGreenBright];
    it("P5 - workThrough", async () => {
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
    it("P5 - convertNamespaceTypeToTypescript", async () => {
        const session = new PseudoSession(addressSpace);
        const options = {
            baseFolder: path.join(__dirname, "../tmp/"),
            prefix: "node-opcua-nodeset-",
        }
        const nsUA = 0;
        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        const nsADI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        
        await convertNamespaceTypeToTypescript(session, nsUA, options);
        await convertNamespaceTypeToTypescript(session, nsDI, options);
        await convertNamespaceTypeToTypescript(session, nsADI, options);
    });
});
