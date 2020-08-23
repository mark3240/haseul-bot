const Discord = require("discord.js");
const { Client } = require("../haseul.js");
const { checkPermissions, resolveMember } = require("../functions/discord.js");

let inviteCache = new Map();
let vanityCache = new Map();

async function cacheGuildInvites(guild) {
    let botMember = await resolveMember(guild, Client.user.id);
    if (checkPermissions(botMember, ["MANAGE_GUILD"])) {
        try {
            let guildInvites = await guild.fetchInvites();
            inviteCache.set(guild.id, guildInvites || new Map());
        } catch(e) {
            inviteCache.set(guild.id, new Map());
            console.error(e);
        }
        try {
            let vanityInvite = await guild.fetchVanityData();
            vanityInvite.url = `https://discord.gg/${vanityInvite.code}`;
            vanityCache.set(guild.id, vanityInvite);
        } catch(e) {
            vanityCache.set(guild.id, null);
        }
    } else {
        inviteCache.set(guild.id, new Map());
        vanityCache.set(guild.id, null);
    }
}

exports.newGuild = async function(guild) {
    cacheGuildInvites(guild);
}

exports.onReady = async function() {
    for (let guild of Client.guilds.cache.array()) {
        await cacheGuildInvites(guild);
    }
    console.log(`Cached invites for ${inviteCache.size} servers.`);
}

exports.resolveUsedInvite = async function(guild) {
    let currentCache = await inviteCache.get(guild.id);
    let currentVanity = await vanityCache.get(guild.id);
    let newInvites;
    let newVanity;

    let usedInvite = null;
    let inviteChanges = 0;

    newInvites = await guild.fetchInvites().catch(() => {});
    if (currentCache && newInvites && newInvites.size > 0) {
        for (let newInvite of newInvites.array()) {
            let currentInvite = currentCache.get(newInvite.code);
            if (currentInvite) {
                if (currentInvite.uses !== null && newInvite.uses > currentInvite.uses) {
                    usedInvite = newInvite;
                    inviteChanges++;
                }
            } else if (newInvite.uses > 0) {
                usedInvite = newInvite;
                inviteChanges++;
            }
        }
    }

    newVanity = await guild.fetchVanityData().catch(() => {});
    if (currentVanity && newVanity && inviteChanges < 2) {
        newVanity.url = `https://discord.gg/${newVanity.code}`;
        if (currentVanity) {
            if (currentVanity.uses !== null && newVanity.uses > currentVanity.uses) {
                usedInvite = newVanity;
                inviteChanges++;
            }
        } else if (newVanity.uses > 0) {
            usedInvite = newVanity;
            inviteChanges++;
        }
    }

    inviteCache.set(guild.id, newInvites);
    vanityCache.set(guild.id, newVanity);
    return inviteChanges == 1 ? usedInvite : null;
}
