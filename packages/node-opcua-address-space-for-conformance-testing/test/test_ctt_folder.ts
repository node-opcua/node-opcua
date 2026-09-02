import { AddressSpace, type UAObject, type UAVariable } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import should from "should";

import { build_address_space_for_conformance_testing } from "../dist/index.js";

describe("the CTT folder", function () {
    this.timeout(60_000);

    let addressSpace: AddressSpace;
    let ctt: UAObject;
    const byPath = (relPath: string): UAVariable => {
        const ns = addressSpace.getNamespaceIndex("urn://node-opcua-simulator");
        const node = addressSpace.findNode(`ns=${ns};s=CTT/${relPath}`);
        should.exist(node, `expected a node for CTT setting ${relPath}`);
        return node as UAVariable;
    };

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        addressSpace.registerNamespace("urn:test");
        await build_address_space_for_conformance_testing(addressSpace, {});
        ctt = addressSpace.rootFolder.objects.getFolderElementByName("CTT") as UAObject;
        should.exist(ctt);
    });
    after(async () => {
        await addressSpace.shutdown();
        addressSpace.dispose();
    });

    it("mirrors the setting path in the browse path and the NodeId", () => {
        const v = byPath("Static/HA Profile/Arrays/Int162D");
        v.browseName.name!.should.eql("Int162D");
        // follow the hierarchical references from the CTT folder, segment by segment
        let n: UAObject | UAVariable = ctt;
        for (const segment of ["Static", "HA Profile", "Arrays", "Int162D"]) {
            const children = n.findReferencesExAsObject("HierarchicalReferences") as (UAObject | UAVariable)[];
            const next = children.find((c) => c.browseName.name === segment);
            should.exist(next, `${segment} below ${n.browseName.name}`);
            n = next as UAObject | UAVariable;
        }
        n.nodeId.toString().should.eql(v.nodeId.toString());
    });

    it("serves Variant, Image and Structure scalars", () => {
        byPath("Static/All Profiles/Scalar/Variant").dataType.toString().should.eql("ns=0;i=24");
        byPath("Static/All Profiles/Scalar/Image").dataType.toString().should.eql("ns=0;i=30");
        for (let i = 1; i <= 5; i++) {
            const v = byPath(`Static/All Profiles/Structures/Structure00${i}`);
            v.readValue().value.dataType.should.eql(DataType.ExtensionObject);
            addressSpace.findDataType(v.dataType)!.isSubtypeOf(addressSpace.findDataType("Structure")!).should.eql(true);
        }
        byPath("Static/All Profiles/Arrays/Variant").valueRank.should.eql(1);
        byPath("Static/All Profiles/Multi-Dimensional-Arrays/Variant").valueRank.should.eql(2);
    });

    it("serves the DA arrays and the five ArrayItemTypes with their axis properties", () => {
        const a = byPath("Static/DA Profile/AnalogItemType Arrays/Int16");
        a.typeDefinitionObj.browseName.name!.should.eql("AnalogItemType");
        a.valueRank.should.eql(1);
        for (const t of ["YArrayItemType", "XYArrayItemType", "ImageItemType", "CubeItemType", "NDimensionArrayItemType"]) {
            const v = byPath(`Static/DA Profile/ArrayItemType/${t}`);
            v.typeDefinitionObj.browseName.name!.should.eql(t);
            should.exist(v.getPropertyByName("Title"), `${t} Title`);
            v.readValue().statusCode.should.eql(StatusCodes.Good);
        }
        should.exist(byPath("Static/DA Profile/ArrayItemType/CubeItemType").getPropertyByName("ZAxisDefinition"));
    });

    it("keeps the TwoStateDiscrete variables reachable from their folder", () => {
        const ns = addressSpace.getNamespaceIndex("urn://node-opcua-simulator");
        const folder = addressSpace.findNode(`ns=${ns};s=Simulation_DA_DiscreteType`) as UAObject;
        should.exist(folder);
        const names = folder.findReferencesExAsObject("Organizes").map((n) => n.browseName.name);
        for (let i = 1; i <= 5; i++) names.should.containEql(i === 3 ? "twoStateDiscrete003" : `TwoStateDiscrete00${i}`);
    });

    it("serves historizing scalars, arrays and access-right variables", () => {
        const v = byPath("Static/HA Profile/Scalar/Bool");
        v.historizing.should.eql(true);
        v.dataType.toString().should.eql("ns=0;i=1");
        const dv = v.readValue();
        dv.statusCode.should.eql(StatusCodes.Good);
        should.exist(dv.sourceTimestamp);
        byPath("Static/HA Profile/Arrays/Double").valueRank.should.eql(1);
        byPath("Static/HA Profile/Arrays/Double2D").valueRank.should.eql(2);
        byPath("Static/HA Profile/StructureNodeSupportingHistory").historizing.should.eql(true);
        const ro = byPath("Static/HA Profile/AccessRights/AccessLevel_ReadOnly");
        (ro.accessLevel & 3).should.eql(1);
        const uw = byPath("Static/HA Profile/AccessRights/UserAccessLevel_WriteOnly");
        (uw.userAccessLevel & 3).should.eql(2);
        (uw.accessLevel & 3).should.eql(3);
    });
});
