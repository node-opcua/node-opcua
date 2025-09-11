
import should from "should";
export const assertThrow = async (myAsyncFunction: () => Promise<void>, regExp: RegExp): Promise<Error> => {

    try {
        await myAsyncFunction();
        const message = 'Expected function to throw, but it did not';
        should.not.exist(message);
        throw new Error('Expected function to throw, but it did not');
    } catch (err) {
        should.exist(err);
        (err as Error).should.be.an.Error();
        (err as Error).message.should.match(regExp);
        return err as Error;
    }
}