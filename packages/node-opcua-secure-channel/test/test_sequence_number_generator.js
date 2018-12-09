"use strict";
const should = require("should");
const SequenceNumberGenerator = require("../src/sequence_number_generator").SequenceNumberGenerator;

describe("SequenceNumberGenerator", function () {

    it("the first sequence number shall be one ", function () {
        const generator = new SequenceNumberGenerator();
        generator.future().should.equal(1);
    });

    it("the second sequence number shall be two ", function () {
        const generator = new SequenceNumberGenerator();
        generator.next().should.equal(1);
        generator.next().should.equal(2);
    });

    it("the sequence number should roll over to 1 after reaching four billion", function () {

        const generator = new SequenceNumberGenerator();

        const max_counter_value = SequenceNumberGenerator.prototype.MAXVALUE;
        generator._set(max_counter_value);

        generator.future().should.equal(max_counter_value);
        generator.next().should.equal(max_counter_value);

        generator.future().should.equal(1);
        generator.future().should.equal(1);

    });
});
