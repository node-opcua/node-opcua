
const path = require("path");
const fs = require("fs");
const existsSync = fs.existsSync;

exports.getFixture= (file)=> {
    file = path.join(__dirname,"../test_fixtures",file);
    existsSync(file).should.be.eql(true);
    return file;
}
