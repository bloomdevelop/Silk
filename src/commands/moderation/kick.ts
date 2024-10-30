import { ICommand } from "../../types";
import { commandLogger } from "../../utils";

const kick: ICommand = {
    name: "kick",
    description: "Kicks to a user with reason provided",
    usage: "kick <userId> <reason>",
    async execute(msg) {
        if (msg.member) {
            for (const role of msg.member?.orderedRoles) {
                if (role.permissions?.a) {
                    commandLogger.debug(role.permissions.a << 6);
                }
            }
        }
    },
};

module.exports = kick;
