import { ICommand } from "@/types";
import { log } from "../../utilities/log";

const kick: ICommand = {
    name: "kick",
    description: "Kicks to a user with reason provided",
    usage: "kick <userId> <reason>",
    wip: true,
    async execute(msg, args, client) {
        if (msg.member) {
            for (const role of msg.member?.orderedRoles) {
                if (role.permissions?.a) {
                    log.debug(role.permissions.a << 6);
                }
            }
        }
    },
};

module.exports = kick;
