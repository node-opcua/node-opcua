import should from "should";
import { ReferenceTable } from "../source/index.js";

const HAS_COMPONENT = 47;
const HAS_TYPE_DEFINITION = 40;
const ORGANIZES = 35;

describe("ReferenceTable", () => {
    it("answers before and after indexing alike", () => {
        const table = new ReferenceTable(4);
        table.addBoth(1, ORGANIZES, 2);
        table.addBoth(1, HAS_COMPONENT, 3);
        table.add(3, HAS_TYPE_DEFINITION, true, 9);
        const before = {
            rows1: [...table.rowsOf(1)].length,
            rows3: [...table.rowsOf(3)].map((r) => [table.isForward(r), table.target(r)]),
            children: table.collect(1, true, (t) => t === HAS_COMPONENT).map((r) => table.target(r))
        };
        table.index(10);
        should([...table.rowsOf(1)].length).eql(before.rows1);
        should([...table.rowsOf(3)].map((r) => [table.isForward(r), table.target(r)])).eql(before.rows3);
        should(table.collect(1, true, (t) => t === HAS_COMPONENT).map((r) => table.target(r))).eql(before.children);
        should(before.rows3).eql([
            [false, 1],
            [true, 9]
        ]);
        should(table.rowCount).eql(5);
        should(table.overflowSize).eql(0);
    });

    it("takes new rows into an overflow until the next index", () => {
        const table = new ReferenceTable();
        table.addBoth(1, HAS_COMPONENT, 2);
        table.index(5);
        table.addBoth(1, HAS_COMPONENT, 3);
        should(table.overflowSize).eql(2);
        should(table.collect(1, true, () => true).map((r) => table.target(r))).eql([2, 3]);
        should([...table.rowsOf(3)].map((r) => table.target(r))).eql([1]);
        table.index(5);
        should(table.overflowSize).eql(0);
        should(table.collect(1, true, () => true).map((r) => table.target(r))).eql([2, 3]);
    });

    it("removes a row, finds the matching one, and drops dead rows on index", () => {
        const table = new ReferenceTable();
        table.addBoth(1, HAS_COMPONENT, 2);
        table.addBoth(1, HAS_COMPONENT, 3);
        const row = table.find(1, HAS_COMPONENT, true, 2);
        should(row).not.eql(-1);
        should(table.find(1, HAS_COMPONENT, false, 2)).eql(-1);
        table.remove(row);
        table.remove(table.find(2, HAS_COMPONENT, false, 1));
        should(table.collect(1, true, () => true).map((r) => table.target(r))).eql([3]);
        should([...table.rowsOf(2)]).eql([]);
        should(table.isLive(row)).eql(false);
        table.index(5);
        should(table.rowCount).eql(2);
        should(table.collect(1, true, () => true).map((r) => table.target(r))).eql([3]);
    });

    it("rejects a type ordinal that would collide with the dead marker", () => {
        const table = new ReferenceTable();
        should(() => table.add(1, 0xffff, true, 2)).throw();
    });

    it("scales to many rows and nodes", () => {
        const table = new ReferenceTable(16);
        const nodes = 20000;
        for (let i = 1; i < nodes; i++) {
            table.addBoth(0, ORGANIZES, i);
            table.add(i, HAS_TYPE_DEFINITION, true, 0);
        }
        table.index(nodes);
        should(table.collect(0, true, (t) => t === ORGANIZES).length).eql(nodes - 1);
        should([...table.rowsOf(777)].length).eql(2);
        should(table.rowCount).eql((nodes - 1) * 3);
    });
});
