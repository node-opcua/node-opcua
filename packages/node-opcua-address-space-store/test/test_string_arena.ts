import should from "should";
import { StringArena } from "../source/index.js";

describe("StringArena", () => {
    it("interns a string once", () => {
        const arena = new StringArena(4);
        const a = arena.intern("Temperature");
        const b = arena.intern("Pressure");
        should(arena.intern("Temperature")).eql(a);
        should(b).not.eql(a);
        should(arena.size).eql(2);
        should(arena.get(a)).eql("Temperature");
        should(arena.get(b)).eql("Pressure");
        should(arena.equals(a, "Temperature")).eql(true);
        should(arena.equals(a, "Temperatur")).eql(false);
    });

    it("finds without interning", () => {
        const arena = new StringArena();
        should(arena.find("absent")).eql(-1);
        const id = arena.intern("present");
        should(arena.find("present")).eql(id);
        should(arena.size).eql(1);
    });

    it("keeps the empty string and non-ASCII text", () => {
        const arena = new StringArena();
        const empty = arena.intern("");
        const accents = arena.intern("Température °C");
        const kanji = arena.intern("温度");
        should(arena.get(empty)).eql("");
        should(arena.byteLengthOf(empty)).eql(0);
        should(arena.get(accents)).eql("Température °C");
        should(arena.get(kanji)).eql("温度");
        should(arena.find("温度")).eql(kanji);
        should(arena.intern("")).eql(empty);
    });

    it("interns raw bytes too", () => {
        const arena = new StringArena();
        const guid = new Uint8Array(16).map((_v, i) => i * 7);
        const id = arena.internBytes(guid);
        should(arena.internBytes(guid)).eql(id);
        should(arena.findBytes(guid)).eql(id);
        should(arena.findBytes(new Uint8Array(16))).eql(-1);
        should([...arena.bytesOf(id)]).eql([...guid]);
    });

    it("grows past its initial sizing, bytes and table alike, and stays consistent", () => {
        const arena = new StringArena(4, 8);
        const ids = new Map<string, number>();
        for (let i = 0; i < 20000; i++) {
            const s = `Node_${i}_${"x".repeat(i % 17)}`;
            ids.set(s, arena.intern(s));
        }
        should(arena.size).eql(20000);
        for (const [s, id] of ids) {
            should(arena.find(s)).eql(id);
            should(arena.get(id)).eql(s);
        }
        should(arena.intern("Node_5_xxxxx")).eql(ids.get("Node_5_xxxxx"));
    });
});
