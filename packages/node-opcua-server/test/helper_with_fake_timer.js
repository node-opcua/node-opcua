"use strict";
const { default: assert } = require("node-opcua-assert");
const sinon = require("sinon");

async function with_fake_timer(workerFunc) {
    assert(!this.clock);

    this.clock = sinon.useFakeTimers();
    let the_err;
    try {
        await workerFunc.call(this, this);
    } catch (err) {
        the_err = err;
    }
    this.clock.restore();
    this.clock = undefined;
    if (the_err) {
        throw the_err;
    }
}
module.exports = { with_fake_timer };
