import "should";
import { SequenceNumberGenerator } from "../dist/source";

describe("SequenceNumberGenerator", () => {

    it("the first sequence number shall be one ", () => {
        const generator = new SequenceNumberGenerator();
        generator.future().should.equal(1);
    });

    it("the second sequence number shall be two ", () => {
        const generator = new SequenceNumberGenerator();
        generator.next().should.equal(1);
        generator.next().should.equal(2);
    });

    it("the sequence number should roll over to 1 after reaching four billion", () => {

        const generator = new SequenceNumberGenerator();

        const max_counter_value = SequenceNumberGenerator.MAXVALUE;
        generator._set(max_counter_value);

        generator.future().should.equal(max_counter_value);
        generator.next().should.equal(max_counter_value);

        generator.future().should.equal(1);
        generator.future().should.equal(1);

    });
});
