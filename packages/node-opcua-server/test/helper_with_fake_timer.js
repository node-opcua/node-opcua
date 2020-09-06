
"use strict";
const should = require("should");
const sinon = require("sinon");

async function with_fake_timer(workerFunc) {
 
    
    const test = this;
    test.clock = sinon.useFakeTimers();
    let the_err;
    try {
        await workerFunc.call(test, test);
    } catch (err) {
        the_err = err;
    }
    test.clock.restore();
    if (the_err) {
        throw the_err;
    }
}
module.exports = { with_fake_timer };
