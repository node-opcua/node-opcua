import "should";
import should from "should";
import { IndexIterator } from "../impl/idx_iterator.js";

describe("index iterator", () => {
    it("should iterate", () => {
        const iterator = new IndexIterator([2]);
        should(iterator.current).eql([0]);
        iterator.increment();
        should(iterator.current).eql([1]);
        iterator.increment();
        should(iterator.current).eql(null);
        iterator.increment();
    });

    it("should iterate on a two dimension array", () => {
        const iterator = new IndexIterator([2, 3]);
        should(iterator.current).eql([0, 0]);
        iterator.increment();
        should(iterator.current).eql([0, 1]);
        iterator.increment();
        should(iterator.current).eql([0, 2]);
        iterator.increment();
        should(iterator.current).eql([1, 0]);
        iterator.increment();
        should(iterator.current).eql([1, 1]);
        iterator.increment();
        should(iterator.current).eql([1, 2]);
        iterator.increment();
        should(iterator.current).eql(null);
        iterator.increment();
    });
    it("should iterate on a three dimension array - using increment", () => {
        const iterator = new IndexIterator([1, 2, 2]);
        should(iterator.current).eql([0, 0, 0]);
        iterator.increment();
        should(iterator.current).eql([0, 0, 1]);
        iterator.increment();
        should(iterator.current).eql([0, 1, 0]);
        iterator.increment();
        should(iterator.current).eql([0, 1, 1]);
        iterator.increment();
        should(iterator.current).eql(null);
    });
    it("should iterate on a three dimension array - using next", () => {
        const iterator = new IndexIterator([1, 2, 2]);
        iterator.next().should.eql([0, 0, 0]);
        iterator.next().should.eql([0, 0, 1]);
        iterator.next().should.eql([0, 1, 0]);
        iterator.next().should.eql([0, 1, 1]);
        should(iterator.current).eql(null);
    });
});
