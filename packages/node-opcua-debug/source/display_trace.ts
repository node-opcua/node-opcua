import chalk from "chalk";

export function trace_from_this_projet_only(err: Error): string {

    const str = [];
    str.push(chalk.cyan.bold(" display_trace_from_this_project_only = "));
    if (err) {
        str.push(err.message);
    }
    err = err || new Error();
    let stack: any = err.stack;
    if (stack) {
        stack = stack.split("\n").filter((el:string) => el.match(/node-opcua/) && !el.match(/node_modules/));
        str.push(chalk.yellow(stack.join("\n")));
    } else {
        str.push(chalk.red(" NO STACK TO TRACE !!!!"));
    }
    return str.join("\n");
}


export function display_trace_from_this_projet_only(err: Error): void {
    console.log(trace_from_this_projet_only(err));
}
