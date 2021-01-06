import { Queue } from "../source/queue";
import * as should from "should";

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
});
