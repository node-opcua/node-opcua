import "should";
import should from "should";
import { IndexIterator} from "../src/idx_iterator";

describe("index iterator", function(){

    it("should iterate", ()=>{
        const iterator = new IndexIterator([2]);
        iterator.current?.should.eql([0]);
        iterator.increment();
        iterator.current?.should.eql([1]);
        iterator.increment();
        iterator.current?.should.eql(null);
        iterator.increment();
    });

    it("should iterate on a two dimension array", ()=>{
        const iterator = new IndexIterator([2,3]);
        iterator.current?.should.eql([0,0]);
        iterator.increment();
        iterator.current?.should.eql([0,1]);
        iterator.increment();
        iterator.current?.should.eql([0,2]);
        iterator.increment();
        iterator.current?.should.eql([1,0]);
        iterator.increment();
        iterator.current?.should.eql([1,1]);
        iterator.increment();
        iterator.current?.should.eql([1,2]);
        iterator.increment();
        iterator.current?.should.eql(null);
        iterator.increment();
        
    });
    it("should iterate on a three dimension array - using increment", ()=>{
        const iterator = new IndexIterator([1,2,2]);
        iterator.current?.should.eql([0,0,0]);
        iterator.increment();
        iterator.current?.should.eql([0,0,1]);
        iterator.increment();
        iterator.current?.should.eql([0,1,0]);
        iterator.increment();
        iterator.current?.should.eql([0,1,1]);
        iterator.increment();
        iterator.current?.should.eql(null);
    });
    it("should iterate on a three dimension array - using next", ()=>{
        const iterator = new IndexIterator([1,2,2]);
        iterator.next().should.eql([0,0,0]);
        iterator.next().should.eql([0,0,1]);
        iterator.next().should.eql([0,1,0]);
        iterator.next().should.eql([0,1,1]);
        should(iterator.current).eql(null);
    });
})