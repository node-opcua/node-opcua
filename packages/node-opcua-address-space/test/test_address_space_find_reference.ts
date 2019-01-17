// tslint:disable:max-line-length
import { resolveNodeId } from "node-opcua-nodeid";
import * as should from "should";
import {AddressSpace, UAReference} from "..";
import { create_minimalist_address_space_nodeset } from "../";

describe("testing AddressSpace#findReferenceType and findReferenceTypeFromInverseName", () => {

    let addressSpace: AddressSpace;
    before(() => {
        addressSpace = AddressSpace.create();
        create_minimalist_address_space_nodeset(addressSpace);
    });
    after(() =>  {
        addressSpace.dispose();
    });

    it("findReferenceType findReferenceTypeFromInverseName - should provide a way to access a referenceType from its inverse name", () => {
        const n1 = addressSpace.findReferenceType("Organizes")!.nodeId;
        should.not.exist(addressSpace.findReferenceType("OrganizedBy"));

        const n2 = addressSpace.findReferenceTypeFromInverseName("OrganizedBy")!.nodeId;
        should.not.exist(addressSpace.findReferenceTypeFromInverseName("Organizes"));

        n1.should.equal(n2);

    });

    it("should normalize a {referenceType/isForward} combination", () => {

        addressSpace.normalizeReferenceType({
            isForward: true,
            nodeId: "i=58",
            referenceType: "OrganizedBy",
        }).toString().should.eql(

          addressSpace.normalizeReferenceType({
              isForward: false,
              nodeId: resolveNodeId("i=58"),
              referenceType: resolveNodeId("Organizes"),
          }).toString()
        );

        addressSpace.normalizeReferenceType({
            isForward: false,
            nodeId: "i=58",
            referenceType: "OrganizedBy",
        }).toString().should.eql(

          addressSpace.normalizeReferenceType({
              isForward: true,
              nodeId: "i=58",
              referenceType: "Organizes",
          }).toString()
        );
    });

    it("inverseReferenceType - should provide a easy way to get the inverse name of a Reference Type", () => {

        addressSpace.inverseReferenceType("Organizes").should.eql("OrganizedBy");
        addressSpace.inverseReferenceType("ChildOf").should.eql("HasChild");
        addressSpace.inverseReferenceType("AggregatedBy").should.eql("Aggregates");
        addressSpace.inverseReferenceType("PropertyOf").should.eql("HasProperty");
        addressSpace.inverseReferenceType("ComponentOf").should.eql("HasComponent");
        addressSpace.inverseReferenceType("HistoricalConfigurationOf").should.eql("HasHistoricalConfiguration");
        addressSpace.inverseReferenceType("HasSupertype").should.eql("HasSubtype");
        addressSpace.inverseReferenceType("EventSourceOf").should.eql("HasEventSource");

        addressSpace.inverseReferenceType("OrganizedBy").should.eql("Organizes");
        addressSpace.inverseReferenceType("HasChild").should.eql("ChildOf");
        addressSpace.inverseReferenceType("Aggregates").should.eql("AggregatedBy");
        addressSpace.inverseReferenceType("HasProperty").should.eql("PropertyOf");
        addressSpace.inverseReferenceType("HasComponent").should.eql("ComponentOf");
        addressSpace.inverseReferenceType("HasHistoricalConfiguration").should.eql("HistoricalConfigurationOf");
        addressSpace.inverseReferenceType("HasSubtype").should.eql("HasSupertype");
        addressSpace.inverseReferenceType("HasEventSource").should.eql("EventSourceOf");
    });

});
