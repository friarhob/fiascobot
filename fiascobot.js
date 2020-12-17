const config = require('./fiasconfig.json');
const Discord = require('discord.js');
const client = new Discord.Client();

const https = require('https');

var servers = {};

function logging(message, type="LOG")
{
    if(type == "LOG")
    {
        console.log(new Date(Date.now()).toISOString() +": "+message)
    }
    else if(type == "ERROR")
    {
        console.error(new Date(Date.now()).toISOString() +": "+ message);
    }
}

function updateServers(message) {
    let server = message.guild.id;
    let serverName = message.guild.name;
    let channel = message.channel.id;
    let channelName = message.channel.name;

    if(!(server in servers))
    {
        logging("Interacting with server "+serverName+" ("+server+") for the first time");
        servers[server] = {};
    }
    if(!(channel in servers[server]))
    {
        logging("Interacting with channel "+channelName+" ("+channel+") of server "+serverName+" ("+server+") for the first time");
        servers[server][channel] = {
            'gameRunning': false,
            'players': {},
            'playset': null,
            'pool': {
                'whiteDice': [],
                'blackDice': []
            }
        };
    }
}

function addPlayers(message, params)
{
    playersAdded = [];

    for(const param of params)
    {
        if(param.startsWith("<@") && param.endsWith(">"))
        {
            var id = param.slice(2,-1);
            if(id.startsWith("!"))
                id = id.slice(1);

            if(!(id in servers[message.guild.id][message.channel.id].players))
            {
                playersAdded.push(id);
            }
            else
            {
                message.channel.send("<@"+message.author.id+"> user <@"+id+"> alerady registered as a player.");
            }
        }
        else
        {
            message.channel.send("<@"+message.author.id+"> I don't understand who or what is \""+param+'".');
        }
    }

    if(servers[message.guild.id][message.channel.id].players.length+playersAdded.length>5)
    {
        message.channel.send("<@"+message.author.id+"> no more than 5 players allowed in a Fiasco game.");
        logging("add> It would end with more than 5 players on a game.");
    } else {
        if(playersAdded.length == 0)
        {
            logging("add> No players added.");
            message.channel.send("<@"+message.author.id+"> no players added (should mention every user you want to add to a Fiasco game).");
        }
        else
        {
            for(const player of playersAdded)
            {
                servers[message.guild.id][message.channel.id].players[player]=
                    {
                        "whiteDice": 0,
                        "blackDice": 0
                    };
                message.channel.send("<@"+message.author.id+"> added <@"+player+"> as a player.");
            }
        }
        logging("add> Players added: "+playersAdded);
    }
}

function removePlayers(message, params)
{
    playersRemoved = [];

    for(const param of params)
    {
        if(param.startsWith("<@") && param.endsWith(">"))
        {
            var id = param.slice(2,-1);
            if(id.startsWith("!"))
                id = id.slice(1);

            if(id in servers[message.guild.id][message.channel.id].players)
            {
                playersRemoved.push(id);
            }
            else
            {
                message.channel.send("<@"+message.author.id+"> user <@"+id+"> not registered as a player.");
            }
        }
        else
        {
            message.channel.send("<@"+message.author.id+"> I don't understand who or what is \""+param+'".');
        }
    }
    if(playersRemoved.length == 0)
    {
        logging("remove> No players removed.");
        message.channel.send("<@"+message.author.id+"> no players removed (should mention every user you want to remove from a Fiasco game).");
    }
    else
    {
        for(const player of playersRemoved)
        {
            delete servers[message.guild.id][message.channel.id].players[player];
            message.channel.send("<@"+message.author.id+"> removed <@"+player+"> from the players' list.");
        }
    }
    logging("remove> Players removed: "+playersRemoved);
}

function listPlayers(message, params)
{
    var res = "<@"+message.author.id+"> Current players: ";

    var mentionList = [];

    for(var user in servers[message.guild.id][message.channel.id].players)
    {
        mentionList.push("<@"+user+">");
    }

    message.channel.send(res+mentionList.join(", "));
}

function helpMessage(message, params)
{
    message.channel.send(`<@${message.author.id}>
**__!fiasco-add <mentions>__**: *adds players mentioned to the channel game (up to 5 players per channel)*
**__!fiasco-remove <mentions>__**: *removes players mentioned to the channel game*
**__!fiasco-players__**: *list current players in channel game*
**__!fiasco-help__**: *this message*

For more information, just Google it.`);
}

client.on('ready', function(){
    logging("Hello, world. Bot started!");
    client.user.setActivity("Fiasco!");
});

client.on('message', function(message) {
    if (message.author.id != config.tokens.clientID)
    { 
        // Prevent bot from responding to its own messages

        if(message.content.startsWith("!fiasco-"))
        {
            updateServers(message);
            //console.log(message);
            
            var fullCommand = message.content.substring(8).split(" ");
            //console.log(fullCommand);

            var command = fullCommand[0];
            var params = fullCommand.slice(1);
            //console.log(command);
            //console.log(params);

            if(command == "add")
            {
                logging("User "+message.author.username+" ("+message.author.id+") try to add "+params+" players on channel "+message.channel.name+" ("+message.channel.id+") of server "+message.guild.name+" ("+message.guild.id+").");
                addPlayers(message, params);
            }
            else if(command == "players")
            {
                logging("User "+message.author.username+" ("+message.author.id+") ask to list players on channel "+message.channel.name+" ("+message.channel.id+") of server "+message.guild.name+" ("+message.guild.id+").");
                listPlayers(message, params);
            }
            else if(command == "remove")
            {
                logging("User "+message.author.username+" ("+message.author.id+") try to remove "+params+" players on channel "+message.channel.name+" ("+message.channel.id+") of server "+message.guild.name+" ("+message.guild.id+").");
                removePlayers(message, params);
            }
            else if(command == "help")
            {
                logging("User "+message.author.username+" ("+message.author.id+") asks for help on channel "+message.channel.name+" ("+message.channel.id+") of server "+message.guild.name+" ("+message.guild.id+").");
                helpMessage(message, params);
            }
            else
            {
                message.channel.send("<@"+message.author.id+"> I didn't understand your command. Type !fiasco-help for usage.");
            }

/*            playsetStr = "";
            
            for(let [key, value] of message.attachments)
            {
                https.get(value.url,
                    function(res) {
                        res.on('data', function(data) {
                            playsetStr+=data;
                        });

                        res.on('end', function() {
                            console.log(playsetStr);
                        });
                    }
                );
            }
*/

        }
    }


});

client.login(config.tokens.botToken);

