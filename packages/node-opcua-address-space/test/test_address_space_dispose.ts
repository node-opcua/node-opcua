// tslint:disable:no-console
import * as fs from "fs";
import * as path from "path";
import * as should from "should";

import { AddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS";

function dumpMemoryUse() {
    if (process.memoryUsage) {
        const m = process.memoryUsage();
        const h = require("humanize");
        console.log(
            " memoryUsage = ",
            " rss =",
            h.filesize(m.rss),
            " heapTotal =",
            h.filesize(m.heapTotal),
            " heapUsed =",
            h.filesize(m.heapUsed)
        );
    }
}

function callGarbageCollector() {
    if (global.gc) {
        global.gc();
    } else {
        console.log(
            "Garbage collection unavailable.  Pass --expose-gc " + "when launching node to enable forced garbage collection."
        );
    }
}

describe("Testing AddressSpace memory Leaks", function (this: any) {
    const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");
    fs.existsSync(xml_file).should.be.eql(true, "cannot find mini node set");

    it("It should dispose an address_space", async () => {
        const addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, xml_file);
        addressSpace.dispose();
    });

    this.timeout(200000);
    it("It should repeatedly load an address_space => no Leak", async () => {
        async function f() {
            const addressSpace = AddressSpace.create();
            await generateAddressSpace(addressSpace, xml_file);
            addressSpace.dispose();
        }

        let memBefore: any;

        function snapshot() {
            callGarbageCollector();
            dumpMemoryUse();
            memBefore = process.memoryUsage();
        }

        function compare() {
            callGarbageCollector();
            dumpMemoryUse();
            const memAfter = process.memoryUsage();
            memAfter.heapUsed.should.be.lessThan(Math.ceil(memBefore.heapUsed * 3.0));
        }

        snapshot();
        for (let i = 0; i < 20; i++) {
            await f();
        }
        compare();
    });
});
