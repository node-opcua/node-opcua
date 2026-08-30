import EnumSlow from "enum";
import { Benchmarker } from "node-opcua-benchmarker";
import should from "should";
import { Enum, type EnumItem } from "..";

/** e.get() is nullable by design; these call sites know the key exists */
function item(e: Enum, key: string | number): EnumItem {
    const found = e.get(key);
    if (!found) {
        throw new Error(`expecting ${key} to resolve to an EnumItem`);
    }
    return found;
}
const EnumFast = Enum;

describe("Test Enum", () => {
    it("should create flaggable enum from string array", () => {
        const e = new Enum(["e1", "e2", "e3"]) as Enum & Record<string, EnumItem>;
        should(e.get("e1")?.value).equal(1);
        should(e.get("e2")?.value).equal(2);
        should(e.get("e3")?.value).equal(4);
        should(e.get("e3 | e1")?.value).equal(5);
        should(e.get(3)?.key).equal("e1 | e2");
        should(e.get(3)?.value).equal(3);
        should(e.get(9)).equal(null);
        should(e.get(0)).equal(null);
    });

    it("should create flaggable enum from flaggable map", () => {
        const e = new Enum({ e1: 1, e2: 2, e3: 4 }) as Enum & Record<string, EnumItem>;
        should(e.get("e1")?.value).equal(1);
        should(e.get("e2")?.value).equal(2);
        should(e.get("e3")?.value).equal(4);
        should(e.get("e3 | e1")?.value).equal(5);
        should(e.get(3)?.key).equal("e1 | e2");
        should(e.get(3)?.value).equal(3);
        should(e.get(9)).equal(null);
        should(e.get(0)).equal(null);
    });

    it("should create non-flaggable enum from non-flaggable map", () => {
        const e = new Enum({ e1: 1, e2: 2, e3: 3 }) as Enum & Record<string, EnumItem>;
        should(e.get("e1")?.value).equal(1);
        should(e.get("e2")?.value).equal(2);
        should(e.get("e3")?.value).equal(3);
        should(e.get(5)).equal(null);
        should(e.get("e0")).equal(null);
        should(e.get("e3 | e1")).equal(null);
        should(e.get(3)?.key).equal("e3");
        should(e.get(3)?.value).equal(3);
        // biome-ignore lint/complexity/useLiteralKeys: enumItems is private, and bracket access is how a test reaches it
        should(e["enumItems"][0].key).equal("e1");
    });

    it("should access enum from enum item name", () => {
        const e = new Enum({ e1: 1, e2: 2, e3: 4 }) as Enum & Record<string, EnumItem>;
        e.e1.value.should.equal(1);
        e.e1.key.should.equal("e1");
        e.e2.value.should.equal(2);
        e.e2.key.should.equal("e2");
        e.e3.value.should.equal(4);
        e.e3.key.should.equal("e3");
    });

    it("should handle enum with typescript type enum , value starting at 1 and unicode names", () => {
        const e = new Enum({
            1: "丸",
            2: "角",
            3: "板",
            丸: 1,
            角: 2,
            板: 3
        });
        e.getDefaultValue().value.should.equal(1);
    });

    it("EnumItem should function properly", () => {
        const e = new Enum({ e1: 1, e2: 2, e3: 4 }) as Enum & Record<string, EnumItem>;
        const e1ore2 = e.get("e2 | e1");
        if (!e1ore2) {
            throw new Error('expecting "e2 | e1" to resolve to an EnumItem');
        }
        e1ore2.value.should.equal(3);
        e1ore2.is(item(e, 3)).should.equal(true);
        e1ore2.is(3).should.equal(true);
        e1ore2.is("e2 | e1").should.equal(true);
        e1ore2.is(item(e, 5)).should.equal(false);
        e1ore2.is(5).should.equal(false);
        e1ore2.is("e1 | e3").should.equal(false);
        e1ore2.has("e1").should.equal(true);
        e1ore2.has("e2").should.equal(true);
        e1ore2.has("e3").should.equal(false);
        e1ore2.has(1).should.equal(true);
        e1ore2.has(2).should.equal(true);
        e1ore2.has(4).should.equal(false);
        e1ore2.has(e.e1).should.equal(true);
        e1ore2.has(e.e2).should.equal(true);
        e1ore2.has(e.e3).should.equal(false);
        e1ore2.toString().should.equal("e2 | e1");
        e1ore2.valueOf().should.equal(3);
        e1ore2.toJSON().should.equal("e2 | e1");
        e.e1.toString().should.equal("e1");
        e.e1.valueOf().should.equal(1);
        e.e1.toJSON().should.equal("e1");
    });
});

describe("Benchmarking Enums", () => {
    interface EnumItemLike {
        key: string;
        value: number;
    }
    interface EnumLike {
        get(value: string | number | EnumItemLike): EnumItemLike | null;
    }
    const propertyOf = (en: EnumLike, key: string): EnumItemLike => Reflect.get(en, key) as EnumItemLike;

    function perform_benchmark(params: string[] | Record<string, number>, checks: EnumItemLike[], done: Mocha.Done) {
        const bench = new Benchmarker();

        const keys = Array.isArray(params) ? params : Object.keys(params);

        function test_iteration(en: EnumLike) {
            const e1 = propertyOf(en, "SOMEDATA");
            should.not.exist(e1);
            const e2 = en.get("OTHERDATA");
            should.not.exist(e2);

            const first = propertyOf(en, keys[0]);
            should(first.value).eql(en.get(keys[0])?.value);
            should(en.get(first)?.value).eql(first.value);

            checks.forEach((p) => {
                should(p.value).eql(en.get(p.key)?.value);
                should(p.value).eql(en.get(p.value)?.value);
            });
        }

        bench
            .add("slowEnum", () => {
                const en = new EnumSlow(params);
                test_iteration(en);
            })
            .add("fastEnum", () => {
                const en = new EnumFast(params);
                test_iteration(en);
            })
            .on("cycle", (message: string) => {
                console.log(message);
            })
            .on("complete", function (this: Benchmarker) {
                console.log(` Fastest is ${this.fastest?.name}`);
                console.log(" Speed Up : x", this.speedUp);
                if (this.speedUp > 1.5) {
                    // if the speedUp is greater than 1 ,
                    // our implementation should win
                    should(this.fastest?.name).eql("fastEnum");
                }
                done();
            })
            .run();
    }

    it("should verify that our enums are faster than  Enum 2.1.0 (flaggable enum)", (done) => {
        const AccessLevelFlag = {
            CurrentRead: 0x01,
            CurrentWrite: 0x02,
            HistoryRead: 0x04,
            HistoryWrite: 0x08,
            SemanticChange: 0x10
        };

        const checks = [
            { key: "CurrentWrite | HistoryWrite", value: 0x0a },
            { key: "HistoryWrite | CurrentWrite", value: 0x0a },
            { key: "CurrentWrite", value: 0x02 },
            { key: "CurrentWrite | CurrentWrite", value: 0x02 },
            { key: "CurrentRead | CurrentWrite | HistoryRead | HistoryWrite | SemanticChange", value: 0x1f },
            { key: "CurrentRead", value: 0x01 },
            { key: "HistoryRead", value: 0x04 },
            { key: "HistoryWrite", value: 0x08 }
        ];
        perform_benchmark(AccessLevelFlag, checks, done);
    });

    it("should verify that our enums are faster than Enum 2.1.0 ( simple enum )", (done) => {
        const ApplicationType = {
            SERVER: 0, // The application is a Server
            CLIENT: 1, // The application is a Client
            CLIENTANDSERVER: 2, // The application is a Client and a Server
            DISCOVERYSERVER: 3 // The application is a DiscoveryServer
        };
        const checks = [
            { key: "SERVER", value: 0 },
            { key: "CLIENT", value: 1 },
            { key: "CLIENTANDSERVER", value: 2 },
            { key: "DISCOVERYSERVER", value: 3 }
        ];
        perform_benchmark(ApplicationType, checks, done);
    });
});
