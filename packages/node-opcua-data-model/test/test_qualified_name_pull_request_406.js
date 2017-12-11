/*global require,describe,it*/

var should = require('should');

var QualifiedName = require('..').QualifiedName;
var stringToQualifiedName = require('..').stringToQualifiedName;

describe('test qualified name pull request #406', function () {

    it('should convert a string "Hello" into a qualified name ', function () {
        var qn = stringToQualifiedName('Hello');
        qn.should.eql(new QualifiedName({namespaceIndex: 0, name: 'Hello'}));
    });
    it('should convert a string "1" into a qualified name ', function () {
        var qn = stringToQualifiedName('1');
        qn.should.eql(new QualifiedName({namespaceIndex: 0, name: '1'}));
    });
    it('should convert a string "1:Hello" name  into a qualified name ', function () {
        var qn = stringToQualifiedName('1:Hello');
        qn.should.eql(new QualifiedName({namespaceIndex: 1, name: 'Hello'}));
    });
    it('should convert a string "Hel:lo" into a qualified name ', function () {
        var qn = stringToQualifiedName('Hel:lo');
        qn.should.eql(new QualifiedName({namespaceIndex: 0, name: 'Hel:lo'}));
    });
    it('should convert a string "He:ll:o" name  into a qualified name ', function () {
        var qn = stringToQualifiedName('He:ll:o');
        qn.should.eql(new QualifiedName({namespaceIndex: 0, name: 'He:ll:o'}));
    });
    it('should convert a string "1:He:ll:o" name  into a qualified name ', function () {
        var qn = stringToQualifiedName('1:He:ll:o');
        qn.should.eql(new QualifiedName({namespaceIndex: 1, name: 'He:ll:o'}));
    });
    it('should convert a string "1.5:Hello" name  into a qualified name ', function () {
        var qn = stringToQualifiedName('1.5:Hello');
        qn.should.eql(new QualifiedName({namespaceIndex: 0, name: '1.5:Hello'}));
    });
    it('should convert a string "1.5:Hel:lo" name  into a qualified name ', function () {
        var qn = stringToQualifiedName('1.5:Hel:lo');
        qn.should.eql(new QualifiedName({namespaceIndex: 0, name: '1.5:Hel:lo'}));
    });
    it('should convert a string "1.5:He:ll:o" name  into a qualified name ', function () {
        var qn = stringToQualifiedName('1.5:He:ll:o');
        qn.should.eql(new QualifiedName({namespaceIndex: 0, name: '1.5:He:ll:o'}));
    });
});
