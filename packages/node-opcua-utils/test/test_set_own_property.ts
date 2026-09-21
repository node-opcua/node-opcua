import should from "should";
import { setOwnProperty } from "../dist/index.js";

describe("setOwnProperty", () => {
    it("stores an ordinary key as a writable, enumerable, configurable own property", () => {
        const obj: Record<string, unknown> = {};
        setOwnProperty(obj, "a", 1);
        should(Object.getOwnPropertyDescriptor(obj, "a")).eql({ value: 1, writable: true, enumerable: true, configurable: true });
        obj.a = 2;
        should(obj.a).eql(2);
    });

    it("stores __proto__ as data and leaves the prototype alone", () => {
        class Thing {
            public hello(): string {
                return "hello";
            }
        }
        const thing = new Thing();
        setOwnProperty(thing as unknown as Record<string, unknown>, "__proto__", { hello: 1 });
        should(Object.getPrototypeOf(thing)).equal(Thing.prototype);
        should(thing.hello()).eql("hello");
        should(Object.hasOwn(thing, "__proto__")).eql(true);
        should(Object.keys(thing)).eql(["__proto__"]);
    });

    it("accepts null, which a bracket write would turn into a missing prototype", () => {
        const obj: Record<string, unknown> = {};
        setOwnProperty(obj, "__proto__", null);
        should(Object.getPrototypeOf(obj)).equal(Object.prototype);
        should(Object.getOwnPropertyDescriptor(obj, "__proto__")?.value).eql(null);
    });

    it("overwrites a value it stored earlier", () => {
        const obj: Record<string, unknown> = {};
        setOwnProperty(obj, "__proto__", 1);
        setOwnProperty(obj, "__proto__", 2);
        should(Object.getOwnPropertyDescriptor(obj, "__proto__")?.value).eql(2);
    });
});
