
var thenify = require("thenify");
function MyClass()
{

}
MyClass.prototype.open = function open(endpoint,callback)
{
    setTimeout(function() {
        console.log("opening",endpoint);
        callback(null,42);
    },1000);
};
MyClass.prototype.open = thenify.withCallback(MyClass.prototype.open);


function test() {

var t = new MyClass()
    .open("qsdqdsqsd")
    .then(function(a) {
        console.log("done",a);
    })
    .catch(()=>console.log("f"));
}

async function test_async_function() {
    var t = new MyClass();
    var a = await t.open("somefile");
    console.log(a);
    return a;
}
try {
    test_async_function();
}
catch(err)
{
}
