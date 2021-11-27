import { CallbackT } from "node-opcua-status-code";
import * as should from "should";

import {
    MultiformFunc,
    convertToCallbackFunction,
    MultiformFunc1,
    convertToCallbackFunction1
} from "../source/helpers/multiform_func";

class Stuff {}
class Output {
    constructor(public value: string) {}
}

describe("Async Callback Straight functors", () => {
    const stuff = new Stuff();

    async function test(func: MultiformFunc<Output, Stuff>) {
        const convertedFunc = convertToCallbackFunction(func);
        const result = await new Promise<Output>((resolve, reject) => {
            convertedFunc.call(stuff, (err, result) => (err ? reject(err) : resolve(result)));
        });
        return result;
    }

    async function testFailing(func: MultiformFunc<Output, Stuff>) {
        let _err: Error;
        try {
            const result = await test(func);
        } catch (err) {
            _err = err as Error;
        }
        should.exist(_err);
        _err.message.should.eql("this is failing");
    }

    it("should work with a straight function", async () => {
        function func(this: Stuff): Output {
            if (!(this instanceof Stuff)) {
                throw new Error("this is not a Stuff");
            }
            return new Output("A");
        }
        const result = await test(func);
        result.should.be.instanceOf(Output);
        result.value.should.eql("A");
    });

    it("should work with a straight function that throw an exception", async () => {
        function func(this: Stuff): Output {
            throw new Error("this is failing");
        }
        await testFailing(func);
    });

    it("should accept a function  that returns a Promise", async () => {
        async function func(this: Stuff): Promise<Output> {
            if (!(this instanceof Stuff)) {
                throw new Error("this is not a Stuff");
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
            return new Output("A");
        }
        const result = await test(func);
        result.should.be.instanceOf(Output);
        result.value.should.eql("A");
    });

    it("should accept a function  that returns a Promise - that raises an exception", async () => {
        async function func(this: Stuff): Promise<Output> {
            if (!(this instanceof Stuff)) {
                throw new Error("this is not a Stuff");
            }
            await new Promise((resolve) => setTimeout(resolve, 10));

            throw new Error("this is failing");
        }
        await testFailing(func);
    });

    it("should work with a callback function ", async () => {
        function func(this: Stuff, callback: CallbackT<Output>): void {
            if (!(this instanceof Stuff)) {
                throw new Error("this is not a Stuff");
            }
            callback(null, new Output("A"));
        }
        const result = await test(func);
        result.should.be.instanceOf(Output);
        result.value.should.eql("A");
    });
    it("should work with a callback function - that raise an execption ", async () => {
        function func(this: Stuff, callback: CallbackT<Output>): void {
            if (!(this instanceof Stuff)) {
                throw new Error("this is not a Stuff");
            }
            callback(null, new Output("A"));
        }
        const result = await test(func);
    });
    it("should work with a callback function - that raise an execption ", async () => {
        function func(this: Stuff, callback: CallbackT<Output>): void {
            throw new Error("this is failing");
            // callback(null, new Output("A"));
        }
        await testFailing(func);
    });
    it("should work with a callback function - that returns an error in callback", async () => {
        function func(this: Stuff, callback: CallbackT<Output>): void {
            callback(new Error("this is failing"));
        }
        await testFailing(func);
    });
});

describe("Async Callback Straight functors with one arguments", () => {
    const stuff = new Stuff();

    const param = "B";

    async function test(func: MultiformFunc1<Output, string, Stuff>) {
        const convertedFunc = convertToCallbackFunction1(func);
        const result = await new Promise<Output>((resolve, reject) => {
            convertedFunc.call(stuff, param, (err, result) => (err ? reject(err) : resolve(result)));
        });
        return result;
    }

    async function testFailing(func: MultiformFunc1<Output, string, Stuff>) {
        let _err: Error;
        try {
            const result = await test(func);
        } catch (err) {
            _err = err as Error;
        }
        should.exist(_err);
        _err.message.should.eql("this is failing");
    }

    it("should work with a straight function", async () => {
        function func(this: Stuff, param: string): Output {
            if (!(this instanceof Stuff)) {
                throw new Error("this is not a Stuff");
            }
            return new Output("A" + param);
        }
        const result = await test(func);
        result.should.be.instanceOf(Output);
        result.value.should.eql("AB");
    });

    it("should work with a straight function that throw an exception", async () => {
        function func(this: Stuff, param: string): Output {
            throw new Error("this is failing");
        }
        await testFailing(func);
    });

    it("should accept a function  that returns a Promise", async () => {
        async function func(this: Stuff, param: string): Promise<Output> {
            if (!(this instanceof Stuff)) {
                throw new Error("this is not a Stuff");
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
            return new Output("A" + param);
        }
        const result = await test(func);
        result.should.be.instanceOf(Output);
        result.value.should.eql("AB");
    });

    it("should accept a function  that returns a Promise - that raises an exception", async () => {
        async function func(this: Stuff, _param: string): Promise<Output> {
            if (!(this instanceof Stuff)) {
                throw new Error("this is not a Stuff");
            }
            await new Promise((resolve) => setTimeout(resolve, 10));

            throw new Error("this is failing");
        }
        await testFailing(func);
    });

    it("should work with a callback function ", async () => {
        function func(this: Stuff, param: string, callback: CallbackT<Output>): void {
            if (!(this instanceof Stuff)) {
                throw new Error("this is not a Stuff");
            }
            callback(null, new Output("A" + param));
        }
        const result = await test(func);
        result.should.be.instanceOf(Output);
        result.value.should.eql("AB");
    });
    it("should work with a callback function - that raise an execption ", async () => {
        function func(this: Stuff, param: string, callback: CallbackT<Output>): void {
            if (!(this instanceof Stuff)) {
                throw new Error("this is not a Stuff");
            }
            callback(null, new Output("A" + param));
        }
        const result = await test(func);
    });
    it("should work with a callback function - that raise an execption ", async () => {
        function func(this: Stuff, param: string, callback: CallbackT<Output>): void {
            throw new Error("this is failing");
            // callback(null, new Output("A"));
        }
        await testFailing(func);
    });
    it("should work with a callback function - that returns an error in callback", async () => {
        function func(this: Stuff, param: string, callback: CallbackT<Output>): void {
            callback(new Error("this is failing"));
        }
        await testFailing(func);
    });
});
