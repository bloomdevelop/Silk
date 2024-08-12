import { ICommand } from "@/types";

const kick: ICommand = {
    name: 'kick',
    description: 'Kicks to a user with reason provided',
    usage: 'kick <userId> <reason>',
    async execute (msg, args, client) {
        
    }
}

module.exports = kick;