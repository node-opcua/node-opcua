#!/usr/bin/env node
/**
 * @module node-opcua-role-set-admin
 *
 * `role-set-admin` — administer the RoleSet & User Management (OPC 10000-18) of
 * any OPC UA server over a real session.
 */
import { Command } from "commander";
import {
    addIdentity,
    addRole,
    addUser,
    changePassword,
    type GlobalOpts,
    listRoles,
    listUsers,
    removeIdentity,
    removeRole,
    removeUser,
    showRole
} from "./commands.js";

const program = new Command()
    .name("role-set-admin")
    .description("Administer the RoleSet & User Management of an OPC UA server (OPC 10000-18)")
    .requiredOption("-e, --endpoint <url>", "OPC UA endpoint, e.g. opc.tcp://host:4840")
    .option("-u, --username <name>", "user name (omit for anonymous)")
    .option("-p, --password <password>", "password (prompted with hidden input if omitted)")
    .option("--insecure", "connect without security (None/None) instead of SignAndEncrypt");

const fail = (err: Error): never => {
    console.error(`error: ${err.message}`);
    process.exit(1);
};

/**
 * Adapt one of the {@link GlobalOpts}-first command actions to a commander
 * handler. commander appends an options object (for commands with options) and
 * the `Command` itself after the declared positionals — we keep only the leading
 * string positionals and read the global options off the root program.
 */
function run(action: (opts: GlobalOpts, ...args: string[]) => Promise<void>) {
    return (...args: unknown[]) => {
        const positionals = args.filter((a): a is string => typeof a === "string");
        action(program.opts<GlobalOpts>(), ...positionals).catch(fail);
    };
}

program.command("list-roles").description("list all Roles and their identities").action(run(listRoles));
program.command("show-role <name>").description("show one Role's identities").action(run(showRole));
program.command("add-role <name>").description("add a custom Role").action(run(addRole));
program.command("remove-role <name>").description("remove a custom Role").action(run(removeRole));
program.command("add-identity <role> <user>").description("map a UserName to a Role").action(run(addIdentity));
program.command("remove-identity <role> <user>").description("unmap a UserName from a Role").action(run(removeIdentity));
program.command("list-users").description("list managed users").action(run(listUsers));
program
    .command("add-user <user> <password>")
    .description("add a user, optionally granting Roles")
    .option("-r, --role <name...>", "Role(s) to grant", [])
    .action((user: string, password: string, cmdOpts: { role: string[] }) => {
        addUser(program.opts<GlobalOpts>(), user, password, cmdOpts.role).catch(fail);
    });
program.command("remove-user <user>").description("remove a user").action(run(removeUser));
program.command("change-password <old> <new>").description("change the connected user's password").action(run(changePassword));

program.parse(process.argv);
