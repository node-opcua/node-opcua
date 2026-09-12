
function test() {

    let a;
    for (let i of [1, 2, 3, 4, 5]) {
        a = { i: i };
        setImmediate(() => {
            console.log(a);
        });
    }
    /* will produce
    { i: 5 }
    { i: 5 }
    { i: 5 }
    { i: 5 }
    { i: 5 }
    */
    for (let i of [1, 2, 3, 4, 5]) {
        let a = { i: i }; // a is inside a closure
        setImmediate(() => {
            console.log(a);
        });
    }
    /* will produce
    { i: 1 }
    { i: 2 }
    { i: 3 }
    { i: 4 }
    { i: 5 }
    */

}
test();
