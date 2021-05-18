
"use strict";
const { default: assert } = require("node-opcua-assert");
const should = require("should");
const sinon = require("sinon");

async function with_fake_timer(workerFunc) {
 
    
    const test = this;
    assert(!test.clock);

    test.clock = sinon.useFakeTimers();
    let the_err;
    try {
        await workerFunc.call(test, test);
    } catch (err) {
        the_err = err;
    }
    test.clock.restore();
    test.clock = undefined;
    if (the_err) {
        throw the_err;
    }
}
module.exports = { with_fake_timer };
