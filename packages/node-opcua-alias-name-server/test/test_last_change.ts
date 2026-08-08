import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import "mocha";
import type { AddressSpace, UAObject, UAVariable } from "node-opcua-address-space";
import { fromVersionTime, toVersionTime } from "node-opcua-alias-name-common";
import { AttributeIds } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import should from "should";
import { addAlias, removeAlias } from "../source/add_alias.js";
import { addAliasCategory, getInstalledAliasNames } from "../source/bind_alias_category.js";
import { installAliasNamesOnAddressSpace } from "../source/install_alias_names.js";
import { LAST_CHANGE_BROWSE_NAME } from "../source/last_change.js";
import { WellKnownCategories, WellKnownLastChange } from "../source/well_known.js";
import { getObject, makeAddressSpace } from "./helpers.js";

/**
 * OPC 10000-17 clause 6.3.1 — `LastChange`.
 *
 * A **VersionTime**: a UInt32 count of seconds since 2000-01-01T00:00:00Z. Not a
 * DateTime, which is what every other "last changed" Property in the SDK is, and
 * therefore the easiest thing here to get wrong.
 */
describe("OPC 10000-17: LastChange (clause 6.3.1)", () => {
    const temporaryFiles: string[] = [];
    const spaces: AddressSpace[] = [];

    /** A pristine address space, disposed after the test. */
    async function pristine(): Promise<AddressSpace> {
        const space = await makeAddressSpace();
        spaces.push(space);
        return space;
    }

    /** A unique archive path, deleted after the test. */
    function archivePath(label: string): string {
        const file = path.join(os.tmpdir(), `alias-name-lastchange-${label}-${process.pid}-${temporaryFiles.length}.json`);
        temporaryFiles.push(file);
        return file;
    }

    /** Read the LastChange Property of a category as a raw number. */
    function readLastChange(space: AddressSpace, categoryNodeId: Parameters<AddressSpace["findNode"]>[0]): number {
        const category = space.findNode(categoryNodeId) as UAObject;
        const property = category.getPropertyByName(LAST_CHANGE_BROWSE_NAME) as UAVariable;
        should.exist(property, "the category should carry a LastChange Property");
        return property.readValue().value.value as number;
    }

    afterEach(async () => {
        while (spaces.length) {
            spaces.pop()!.dispose();
        }
        while (temporaryFiles.length) {
            await fs.rm(temporaryFiles.pop()!, { force: true });
        }
    });

    describe("the Property itself", () => {
        it("should be present on the Aliases root, which clause 9.2 makes mandatory", async () => {
            const space = await pristine();
            // it is in the shipped nodeset (i=32852) before we do anything
            const aliases = getObject(space, WellKnownCategories.Aliases);
            should.exist(aliases.getPropertyByName(LAST_CHANGE_BROWSE_NAME));
            resolveNodeId(WellKnownLastChange.Aliases).value.should.eql(32852);
        });

        it("should be added to the other categories, which the nodeset leaves without one", async () => {
            const space = await pristine();
            const tagVariables = getObject(space, WellKnownCategories.TagVariables);
            should.not.exist(
                tagVariables.getPropertyByName(LAST_CHANGE_BROWSE_NAME),
                "the shipped nodeset only instantiates it on the root"
            );

            await installAliasNamesOnAddressSpace(space);
            should.exist(tagVariables.getPropertyByName(LAST_CHANGE_BROWSE_NAME));
        });

        it("should be left alone when lastChangeOnAllCategories is off", async () => {
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space, { lastChangeOnAllCategories: false });
            should.not.exist(getObject(space, WellKnownCategories.TagVariables).getPropertyByName(LAST_CHANGE_BROWSE_NAME));
            // the root still has its own, from the nodeset
            should.exist(getObject(space, WellKnownCategories.Aliases).getPropertyByName(LAST_CHANGE_BROWSE_NAME));
        });

        it("should be a UInt32 VersionTime, not a DateTime", async () => {
            // the single most likely implementation mistake in this clause
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space);
            const property = getObject(space, WellKnownCategories.Aliases).getPropertyByName(LAST_CHANGE_BROWSE_NAME) as UAVariable;

            const dataValue = property.readValue();
            dataValue.value.dataType.should.eql(DataType.UInt32);
            dataValue.value.value.should.be.a.Number();
        });

        it("should read as a value rather than as uninitialised", async () => {
            // a Property that was never written reads Bad_WaitingForInitialData,
            // which a Client cannot tell apart from a Server defect
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space);
            const property = getObject(space, WellKnownCategories.TagVariables).getPropertyByName(
                LAST_CHANGE_BROWSE_NAME
            ) as UAVariable;
            property.readValue().statusCode.isGood().should.eql(true);
        });
    });

    describe("what moves it (clause 6.3.1)", () => {
        it("should move when an alias is added to the category", async () => {
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => 1000 });
            const tagVariables = getObject(space, WellKnownCategories.TagVariables);
            readLastChange(space, WellKnownCategories.TagVariables).should.eql(0);

            const sensor = space.getOwnNamespace().addVariable({ browseName: "T1", dataType: "Double" });
            addAlias(space, tagVariables, "TI101", sensor);

            readLastChange(space, WellKnownCategories.TagVariables).should.eql(1000);
        });

        it("should move when an alias is deleted from the category", async () => {
            const space = await pristine();
            let now = 1000;
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => now });
            const tagVariables = getObject(space, WellKnownCategories.TagVariables);
            const sensor = space.getOwnNamespace().addVariable({ browseName: "T1", dataType: "Double" });
            addAlias(space, tagVariables, "TI101", sensor);

            now = 2000;
            removeAlias(space, tagVariables, "TI101");

            readLastChange(space, WellKnownCategories.TagVariables).should.eql(2000);
        });

        it("should move when a category is added", async () => {
            const space = await pristine();
            let now = 1000;
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => now });

            now = 3000;
            addAliasCategory(space, WellKnownCategories.TagVariables, "Unit200");

            readLastChange(space, WellKnownCategories.TagVariables).should.eql(3000);
        });

        it("should move when the referenced Nodes of an alias change", async () => {
            const space = await pristine();
            let now = 1000;
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => now });
            const tagVariables = getObject(space, WellKnownCategories.TagVariables);
            const ns = space.getOwnNamespace();
            addAlias(space, tagVariables, "TI101", ns.addVariable({ browseName: "T1", dataType: "Double" }));

            now = 4000;
            // a second target for the same name is a change to its ReferencedNodes
            addAlias(space, tagVariables, "TI101", ns.addVariable({ browseName: "T2", dataType: "Double" }));

            readLastChange(space, WellKnownCategories.TagVariables).should.eql(4000);
        });

        it("should not move when adding a target that is already there", async () => {
            const space = await pristine();
            let now = 1000;
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => now });
            const tagVariables = getObject(space, WellKnownCategories.TagVariables);
            const sensor = space.getOwnNamespace().addVariable({ browseName: "T1", dataType: "Double" });
            addAlias(space, tagVariables, "TI101", sensor);

            now = 5000;
            addAlias(space, tagVariables, "TI101", sensor); // exact duplicate, ignored

            readLastChange(space, WellKnownCategories.TagVariables).should.eql(1000, "nothing changed");
        });
    });

    describe("the rollup to ancestors", () => {
        it("should move every ancestor when a nested category changes", async () => {
            // "For AliasNameCategoryType instances that are nested, the value of
            // LastChange shall always be the latest VersionTime of all Organized
            // AliasNames and AliasNameCategories."
            const space = await pristine();
            let now = 1000;
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => now });
            const unit200 = addAliasCategory(space, WellKnownCategories.TagVariables, "Unit200");
            const wells = addAliasCategory(space, unit200, "Wells");

            now = 7000;
            const sensor = space.getOwnNamespace().addVariable({ browseName: "P1", dataType: "Double" });
            addAlias(space, wells, "PT-301", sensor);

            readLastChange(space, wells.nodeId).should.eql(7000, "the category that changed");
            readLastChange(space, unit200.nodeId).should.eql(7000, "its parent");
            readLastChange(space, WellKnownCategories.TagVariables).should.eql(7000, "its grandparent");
            readLastChange(space, WellKnownCategories.Aliases).should.eql(7000, "the root");
        });

        it("should leave a newly created category at zero, since nothing has happened in it", async () => {
            // creating a category moves its *parent* - "an AliasNameCategory was
            // added" is an event in the parent. The new category itself is empty
            // and has never changed.
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => 1000 });
            const unit200 = addAliasCategory(space, WellKnownCategories.TagVariables, "Unit200");

            readLastChange(space, unit200.nodeId).should.eql(0, "empty and untouched");
            readLastChange(space, WellKnownCategories.TagVariables).should.eql(1000, "the parent gained a category");
        });

        it("should not move a sibling branch", async () => {
            const space = await pristine();
            let now = 1000;
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => now });
            const ns = space.getOwnNamespace();
            const left = addAliasCategory(space, WellKnownCategories.TagVariables, "Left");
            const right = addAliasCategory(space, WellKnownCategories.TagVariables, "Right");
            // give the sibling a change of its own, so "unaffected" means
            // "kept its own value" rather than "was never set"
            addAlias(space, right, "R-1", ns.addVariable({ browseName: "R1", dataType: "Double" }));

            now = 8000;
            addAlias(space, left, "L-1", ns.addVariable({ browseName: "L1", dataType: "Double" }));

            readLastChange(space, left.nodeId).should.eql(8000);
            readLastChange(space, right.nodeId).should.eql(1000, "a sibling is unaffected");
            readLastChange(space, WellKnownCategories.TagVariables).should.eql(8000, "the parent sees the latest");
        });

        it("should never move backwards", async () => {
            // the root aggregates several branches; an older change in one must
            // not pull it back
            const space = await pristine();
            let now = 9000;
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => now });
            const ns = space.getOwnNamespace();
            const tagVariables = getObject(space, WellKnownCategories.TagVariables);
            addAlias(space, tagVariables, "A-1", ns.addVariable({ browseName: "A1", dataType: "Double" }));

            now = 500; // a clock that went backwards
            addAlias(space, tagVariables, "B-1", ns.addVariable({ browseName: "B1", dataType: "Double" }));

            readLastChange(space, WellKnownCategories.Aliases).should.eql(9000, "max, not last-write-wins");
        });
    });

    describe("one second of resolution", () => {
        it("should give two changes inside the same second the same value", async () => {
            // documented, not fixable: VersionTime has no sub-second part. A
            // Client must re-browse on an equal value rather than skip.
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => 6000 });
            const ns = space.getOwnNamespace();
            const tagVariables = getObject(space, WellKnownCategories.TagVariables);

            addAlias(space, tagVariables, "A-1", ns.addVariable({ browseName: "A1", dataType: "Double" }));
            const first = readLastChange(space, WellKnownCategories.TagVariables);
            addAlias(space, tagVariables, "B-1", ns.addVariable({ browseName: "B1", dataType: "Double" }));
            const second = readLastChange(space, WellKnownCategories.TagVariables);

            second.should.eql(first, "indistinguishable - hence 're-browse on equal'");
        });

        it("should be interpretable as an instant", async () => {
            const space = await pristine();
            const when = new Date("2026-08-08T12:00:00.000Z");
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => toVersionTime(when) });
            const tagVariables = getObject(space, WellKnownCategories.TagVariables);
            addAlias(space, tagVariables, "TI101", space.getOwnNamespace().addVariable({ browseName: "T1", dataType: "Double" }));

            const value = readLastChange(space, WellKnownCategories.TagVariables);
            fromVersionTime(value).toISOString().should.eql("2026-08-08T12:00:00.000Z");
        });
    });

    describe('persistence (clause 6.3.1: "The LastChange shall be persisted")', () => {
        it("should survive a restart", async () => {
            // a restart that resets LastChange to zero silently orders every
            // connected Client to clear a still-valid cache
            const file = archivePath("restart");

            const first = await pristine();
            await installAliasNamesOnAddressSpace(first, { persistencePath: file, nowVersionTime: () => 12345 });
            const tagVariables = getObject(first, WellKnownCategories.TagVariables);
            addAlias(first, tagVariables, "TI101", first.getOwnNamespace().addVariable({ browseName: "T1", dataType: "Double" }));
            await getInstalledAliasNames(first)!.lastChange!.save();
            readLastChange(first, WellKnownCategories.TagVariables).should.eql(12345);

            // "restart": a brand new address space, same archive
            const second = await pristine();
            await installAliasNamesOnAddressSpace(second, { persistencePath: file });

            readLastChange(second, WellKnownCategories.TagVariables).should.eql(12345, "restored, not reset");
            readLastChange(second, WellKnownCategories.Aliases).should.eql(12345);
        });

        it("should start from zero when there is no archive yet", async () => {
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space, { persistencePath: archivePath("absent") });
            readLastChange(space, WellKnownCategories.Aliases).should.eql(0);
        });

        it("should refuse a corrupt archive rather than silently resetting", async () => {
            // continuing with zeros is exactly the cache-clearing bug that
            // persistence exists to prevent, so it is reported
            const file = archivePath("corrupt");
            await fs.writeFile(file, "{ not json", "utf-8");
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space, { persistencePath: file }).should.be.rejectedWith(/not valid JSON/);
        });

        it("should refuse an archive from a future version", async () => {
            const file = archivePath("future");
            await fs.writeFile(file, JSON.stringify({ version: 999, lastChange: {} }), "utf-8");
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space, { persistencePath: file }).should.be.rejectedWith(/version 999/);
        });

        it("should keep the archive readable", async () => {
            // it holds nothing secret - a version and some integers - so unlike
            // the RoleSet archive it is plain JSON on purpose
            const file = archivePath("readable");
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space, { persistencePath: file, nowVersionTime: () => 777 });
            const tagVariables = getObject(space, WellKnownCategories.TagVariables);
            addAlias(space, tagVariables, "TI101", space.getOwnNamespace().addVariable({ browseName: "T1", dataType: "Double" }));
            await getInstalledAliasNames(space)!.lastChange!.save();

            const archive = JSON.parse(await fs.readFile(file, "utf-8"));
            archive.version.should.eql(1);
            Object.values(archive.lastChange).should.containEql(777);
        });

        it("should work without a path, keeping values in memory only", async () => {
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => 4242 });
            const tagVariables = getObject(space, WellKnownCategories.TagVariables);
            addAlias(space, tagVariables, "TI101", space.getOwnNamespace().addVariable({ browseName: "T1", dataType: "Double" }));
            readLastChange(space, WellKnownCategories.TagVariables).should.eql(4242);
        });
    });

    describe("reading it as a Client would", () => {
        it("should expose the value through the Property's Value Attribute", async () => {
            const space = await pristine();
            await installAliasNamesOnAddressSpace(space, { nowVersionTime: () => 31337 });
            const tagVariables = getObject(space, WellKnownCategories.TagVariables);
            addAlias(space, tagVariables, "TI101", space.getOwnNamespace().addVariable({ browseName: "T1", dataType: "Double" }));

            const property = tagVariables.getPropertyByName(LAST_CHANGE_BROWSE_NAME) as UAVariable;
            const dataValue = property.readAttribute(null, AttributeIds.Value);
            dataValue.statusCode.isGood().should.eql(true);
            dataValue.value.value.should.eql(31337);
        });
    });
});
