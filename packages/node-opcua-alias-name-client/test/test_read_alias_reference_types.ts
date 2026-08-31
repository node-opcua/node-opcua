import "mocha";
import { AddressSpace, PseudoSession, type UAObject, type UAReferenceType, type UAVariable } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { addAlias, installAliasNamesOnAddressSpace, WellKnownCategories } from "node-opcua-alias-name-server";
import { ReferenceTypeIds } from "node-opcua-constants";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { type NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { ClientAliasSet, type ClientAliasVerboseEntry, readAliasReferenceTypes, TAG_VARIABLES } from "../source/index.js";

const ALIAS_FOR: NodeId = resolveNodeId(ReferenceTypeIds.AliasFor);

/**
 * `readAliasReferenceTypes` exists because `AliasNameVerboseDataType` (OPC
 * 10000-17 clause 7.3) has no per-target ReferenceType: an alias published
 * with a **subtype** of `AliasFor` (clause 8.2) is indistinguishable, in the
 * find results, from one published with `AliasFor` itself. The publisher
 * address space built here uses such a subtype on purpose, so every assertion
 * below is about information the find Methods provably cannot carry.
 */
describe("OPC 10000-17: readAliasReferenceTypes", () => {
    let addressSpace: AddressSpace;
    let session: PseudoSession;
    let aliases: ClientAliasSet;

    /** A vendor subtype of `AliasFor`, the thing the find results erase. */
    let hasSensorAlias: UAReferenceType;
    let pressureSensor: UAVariable;
    let temperatureIndicator: UAVariable;
    /** The `AliasNameType` instance nodes, for the NodeId-input flavour. */
    let pt42Alias: UAObject;
    let dualAlias: UAObject;
    let bulkAlias: UAObject;
    let bulkTargets: UAVariable[];

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, nodesets.standard);
        const ns = addressSpace.registerNamespace("urn:test:alias-reference-types");

        hasSensorAlias = ns.addReferenceType({
            browseName: "HasSensorAlias",
            inverseName: "SensorAliasOf",
            isAbstract: false,
            subtypeOf: addressSpace.findReferenceType(ALIAS_FOR)!
        });

        pressureSensor = ns.addVariable({ browseName: "PressureSensor", dataType: "Double" }) as UAVariable;
        temperatureIndicator = ns.addVariable({ browseName: "TemperatureIndicator", dataType: "Double" }) as UAVariable;

        // one alias on the subtype, one on plain AliasFor
        pt42Alias = addAlias(addressSpace, WellKnownCategories.TagVariables, "PT-42", pressureSensor, {
            referenceType: hasSensorAlias.nodeId
        });
        addAlias(addressSpace, WellKnownCategories.TagVariables, "TI101", temperatureIndicator);

        // one alias mixing both on its two targets — fidelity must be per
        // (alias, target), not per alias
        dualAlias = addAlias(addressSpace, WellKnownCategories.TagVariables, "DUAL-1", temperatureIndicator);
        addAlias(addressSpace, WellKnownCategories.TagVariables, "DUAL-1", pressureSensor, {
            referenceType: hasSensorAlias.nodeId
        });

        // one alias with enough targets to overflow a truncated Browse
        bulkTargets = [];
        for (let i = 0; i < 12; i++) {
            const variable = ns.addVariable({ browseName: `BulkSensor${i}`, dataType: "Double" }) as UAVariable;
            bulkTargets.push(variable);
            bulkAlias = addAlias(addressSpace, WellKnownCategories.TagVariables, "BULK-1", variable, {
                referenceType: i % 2 === 0 ? undefined : hasSensorAlias.nodeId
            });
        }

        await installAliasNamesOnAddressSpace(addressSpace);

        session = new PseudoSession(addressSpace);
        aliases = new ClientAliasSet(session);
    });

    after(() => addressSpace.dispose());

    /** Count the requests a helper call makes, to pin down the batching. */
    function countingSession(base: PseudoSession): {
        session: PseudoSession;
        counts: { browse: number; browseNext: number; translate: number };
    } {
        const counts = { browse: 0, browseNext: 0, translate: 0 };
        const counting = Object.create(base) as PseudoSession;
        const wrap = <K extends "browse" | "browseNext" | "translateBrowsePath">(name: K, counter: keyof typeof counts) => {
            counting[name] = ((...args: unknown[]) => {
                counts[counter] += 1;
                return (base[name] as (...a: unknown[]) => unknown).apply(base, args);
            }) as PseudoSession[K];
        };
        wrap("browse", "browse");
        wrap("browseNext", "browseNext");
        wrap("translateBrowsePath", "translate");
        return { session: counting, counts };
    }

    it("should recover the AliasFor subtype that FindAliasVerbose cannot carry", async () => {
        const [entry] = await aliases.findAliasVerbose("PT-42");
        should.exist(entry);

        const referenceTypes = await readAliasReferenceTypes(session, [entry]);
        const targets = referenceTypes.get(entry)!;
        should.exist(targets, "the entry itself keys the result");
        targets.should.have.length(1);
        sameNodeId(targets[0].targetNodeId, entry.referencedNodes[0]).should.eql(true);
        sameNodeId(targets[0].referenceTypeId, hasSensorAlias.nodeId).should.eql(true, "the subtype, not plain AliasFor");
    });

    it("should report plain AliasFor for an alias published with it", async () => {
        const [entry] = await aliases.findAliasVerbose("TI101");
        const targets = (await readAliasReferenceTypes(session, [entry])).get(entry)!;
        targets.should.have.length(1);
        sameNodeId(targets[0].referenceTypeId, ALIAS_FOR).should.eql(true);
    });

    it("should keep fidelity per (alias, target) when one alias mixes reference types", async () => {
        const [entry] = await aliases.findAliasVerbose("DUAL-1");
        entry.referencedNodes.should.have.length(2);

        const targets = (await readAliasReferenceTypes(session, [entry])).get(entry)!;
        targets.should.have.length(2);
        const byTarget = (nodeId: NodeId) => targets.find((t) => sameNodeId(t.targetNodeId, nodeId))!;
        sameNodeId(byTarget(temperatureIndicator.nodeId).referenceTypeId, ALIAS_FOR).should.eql(true);
        sameNodeId(byTarget(pressureSensor.nodeId).referenceTypeId, hasSensorAlias.nodeId).should.eql(true);
    });

    it("should accept AliasNameType instance NodeIds directly, skipping the lookup step", async () => {
        const { session: counted, counts } = countingSession(session);
        const referenceTypes = await readAliasReferenceTypes(counted, [pt42Alias.nodeId, dualAlias.nodeId]);

        counts.translate.should.eql(0, "NodeIds given: nothing to translate");
        counts.browse.should.eql(1, "two nodes, one Browse request");
        referenceTypes.size.should.eql(2);
        const pt42Targets = referenceTypes.get(pt42Alias.nodeId)!;
        sameNodeId(pt42Targets[0].referenceTypeId, hasSensorAlias.nodeId).should.eql(true);
        should(referenceTypes.get(dualAlias.nodeId)).have.length(2);
    });

    it("should batch many verbose entries into one TranslateBrowsePaths and one Browse", async () => {
        const entries = await aliases.findAliasVerbose("%");
        entries.length.should.be.greaterThanOrEqual(4);

        const { session: counted, counts } = countingSession(session);
        const referenceTypes = await readAliasReferenceTypes(counted, entries);

        counts.translate.should.eql(1, "one TranslateBrowsePaths for every entry");
        counts.browse.should.eql(1, "one Browse for every alias node — never one per alias");
        referenceTypes.size.should.eql(entries.length);
    });

    it("should honour maxNodesPerCall by splitting into that many requests", async () => {
        const entries = await aliases.findAliasVerbose("%");
        const { session: counted, counts } = countingSession(session);
        const referenceTypes = await readAliasReferenceTypes(counted, entries, { maxNodesPerCall: 1 });

        counts.translate.should.eql(entries.length);
        counts.browse.should.eql(entries.length);
        referenceTypes.size.should.eql(entries.length, "chunking changes the traffic shape, not the answer");
    });

    it("should follow continuation points when the Server truncates the Browse", async () => {
        // a PseudoSession enforces requestedMaxReferencesPerNode exactly as a
        // real Server enforces its own limit, continuation points included
        const truncating = new PseudoSession(addressSpace);
        truncating.requestedMaxReferencesPerNode = 3;
        const { session: counted, counts } = countingSession(truncating);

        const targets = (await readAliasReferenceTypes(counted, [bulkAlias.nodeId])).get(bulkAlias.nodeId)!;

        counts.browseNext.should.be.greaterThan(0, "12 targets at 3 per answer forces BrowseNext");
        targets.should.have.length(bulkTargets.length);
        bulkTargets.forEach((variable, i) => {
            const found = targets.find((t) => sameNodeId(t.targetNodeId, variable.nodeId))!;
            should.exist(found, `target ${i} survives the continuation`);
            const expected = i % 2 === 0 ? ALIAS_FOR : hasSensorAlias.nodeId;
            sameNodeId(found.referenceTypeId, expected).should.eql(true, `target ${i} keeps its reference type`);
        });
    });

    it("should omit an entry the address space no longer resolves, rather than guess", async () => {
        const [real] = await aliases.findAliasVerbose("PT-42");
        const stale: ClientAliasVerboseEntry = {
            aliasName: "DELETED-SINCE-THE-FIND",
            namespaceIndex: real.namespaceIndex,
            referencedNodes: [],
            serverUris: [],
            aliasNameCategoryId: TAG_VARIABLES
        };

        const referenceTypes = await readAliasReferenceTypes(session, [real, stale]);
        referenceTypes.size.should.eql(1);
        should.exist(referenceTypes.get(real));
        should.not.exist(referenceTypes.get(stale));
    });

    it("should return an empty map for an empty input, without any request", async () => {
        const { session: counted, counts } = countingSession(session);
        const referenceTypes = await readAliasReferenceTypes(counted, [] as NodeId[]);
        referenceTypes.size.should.eql(0);
        counts.browse.should.eql(0);
        counts.translate.should.eql(0);
    });
});
