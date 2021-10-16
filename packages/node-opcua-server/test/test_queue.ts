import * as should from "should";
import { Queue } from "../source/queue";
const doDebug = false;

describe("Queue", () => {
    it("should iterate a queue", () => {
        const q = new Queue<number>();
        q.push(1);
        q.push(2);
        q.push(3);

        if (doDebug) {
            for (const e of q.values()) {
                console.log(e);
            }
        }
        const a = [...q.values()];
        a.should.eql([1, 2, 3]);
        q.shift();

        const b = [...q.values()];
        b.should.eql([2, 3]);

        q.shift();
        const c = [...q.values()];
        c.should.eql([3]);
    });
    it("dequeue filtering", () => {
        const q = new Queue<number>();
        q.push(1);
        q.push(2);
        q.push(3);
        q.push(4);

        q.size.should.eql(4);

        const removed = q.filterOut((n) => n % 2 === 0);
        removed.should.eql(2);

        const b = [...q.values()];
        b.should.eql([1, 3]);
        q.size.should.eql(2);
    });
});
