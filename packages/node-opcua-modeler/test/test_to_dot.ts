import "should";
import { AddressSpace, Namespace } from "node-opcua-address-space/";
import { get_mini_nodeset_filename } from "node-opcua-address-space/distHelpers";
import { generateAddressSpace } from "node-opcua-address-space/distNodeJS";
import { nodesets } from "node-opcua-nodesets";
import { dumpClassHierachry, opcuaToDot } from "..";

describe("toDot", () => {
    let addressSpace: AddressSpace;
    let ns: Namespace;
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [get_mini_nodeset_filename()]);
        addressSpace.registerNamespace("OwnNamespace");
        ns = addressSpace.getOwnNamespace();
    });
    afterEach(() => {
        addressSpace.dispose();
    });
    it("todot-1 simple ObjectType with 1 property", () => {
        const objectType = ns.addObjectType({
            browseName: "A"
        });
        const prop = ns.addObject({
            browseName: "P",
            componentOf: objectType
        });

        //
        const dot = opcuaToDot(objectType, { naked: true });
        console.log(dot);
        dot.should.eql(
            `digraph G {
  { rank=same r0 -> P [arrowhead = noneteetree] }
  A -> r0 [arrowhead=none];
}`
        );
    });
    it("todot-2 simple ObjectType with 1 property and nested object", () => {
        const objectType = ns.addObjectType({
            browseName: "A"
        });
        const prop = ns.addObject({
            browseName: "P",
            componentOf: objectType
        });
        const nexted = ns.addObject({
            browseName: "N",
            componentOf: prop
        });

        //
        const dot = opcuaToDot(objectType, { naked: true });
        console.log(dot);
        dot.should.eql(
            `digraph G {
  { rank=same r0_0 -> N [arrowhead = noneteetree] }
  P -> r0_0 [arrowhead=none];
  { rank=same r0 -> P [arrowhead = noneteetree] }
  A -> r0 [arrowhead=none];
}`
        );
    });
    it("todot-3 simple ObjectType with 2 properties and nested object in both", () => {
        const objectType = ns.addObjectType({
            browseName: "A"
        });
        const prop1 = ns.addObject({
            browseName: "P1",
            componentOf: objectType
        });
        const prop2 = ns.addObject({
            browseName: "P2",
            componentOf: objectType
        });
        const nexsted1 = ns.addObject({
            browseName: "N1",
            componentOf: prop1
        });
        const nexsted2 = ns.addObject({
            browseName: "N2",
            componentOf: prop2
        });

        //
        const dot = opcuaToDot(objectType, { naked: true });
        console.log(dot);
        dot.should.eql(
            `digraph G {
  { rank=same r0_0 -> N1 [arrowhead = noneteetree] }
  P1 -> r0_0 [arrowhead=none];
  { rank=same r2_0 -> N2 [arrowhead = noneteetree] }
  P2 -> r2_0 [arrowhead=none];
  { rank=same r0 -> P1 [arrowhead = noneteetree] }
  { rank=same r2 -> P2 [arrowhead = noneteetree] }
  A -> r0 -> r1 -> r2 [arrowhead=none];
}`
        );
    });
    it("todot-4 - dumpClassHierachry", () => {
        const animal = ns.addObjectType({
            browseName: "Animal"
        });
        const invertebrate = ns.addObjectType({
            browseName: "Invertebrate",
            subtypeOf: animal
        });
        const vertebate = ns.addObjectType({
            browseName: "Vertebate",
           subtypeOf: animal
        });
        const reptile = ns.addObjectType({
            browseName: "Reptile",
            subtypeOf: vertebate
        });
        const bird = ns.addObjectType({
            browseName: "Bird",
            subtypeOf: vertebate
        });
        const duck = ns.addObjectType({
            browseName: "Duck",
            subtypeOf: bird
        });
        const mammal = ns.addObjectType({
            browseName: "Mamal",
            subtypeOf: vertebate
        });
  
        const dog = ns.addObjectType({
            browseName: "Dog",
            subtypeOf: mammal
        });
        const cat = ns.addObjectType({
            browseName: "Cat",
            subtypeOf: mammal
        });
        const dolphin = ns.addObjectType({
            browseName: "Dolphin",
            subtypeOf: mammal
        });

        const dot = dumpClassHierachry(animal, { naked: false, depth: 2, showSubType: true });
        console.log(dot);
        
    });
});
