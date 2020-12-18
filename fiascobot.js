const config = require("./fiasconfig.json");
const Discord = require("discord.js");
const client = new Discord.Client();

const https = require("https");

var servers = {};

function logging(message, type = "LOG") {
  if (type == "LOG") {
    console.log(new Date(Date.now()).toISOString() + ": " + message);
  } else if (type == "ERROR") {
    console.error(new Date(Date.now()).toISOString() + ": " + message);
  }
}

function updateServers(message) {
  let server = message.guild.id;
  let serverName = message.guild.name;
  let channel = message.channel.id;
  let channelName = message.channel.name;

  if (!(server in servers)) {
    logging(
      "Interacting with server " +
        serverName +
        " (" +
        server +
        ") for the first time"
    );
    servers[server] = {};
  }
  if (!(channel in servers[server])) {
    logging(
      "Interacting with channel " +
        channelName +
        " (" +
        channel +
        ") of server " +
        serverName +
        " (" +
        server +
        ") for the first time"
    );
    servers[server][channel] = {
      gameStatus: 0,
      // 0: Not Started
      // 1: Setup
      // 2: First Act
      // 3: Tilt
      // 4: Second Act
      // 5: Aftermath
      players: {},
      playset: require("./playsets/mainstreet.json"),
      dicepool: {
        values: [],
        white: 0,
        black: 0
      }
    };
  }
}

function addPlayers(message, params) {
  playersAdded = [];

  if (servers[message.guild.id][message.channel.id].gameStatus > 0) {
    logging("add> Can't add players with game running.");
    message.channel.send(
      "<@" + message.author.id + "> can't add players with game running."
    );
    return;
  }

  for (const param of params) {
    if (param.startsWith("<@") && param.endsWith(">")) {
      var id = param.slice(2, -1);
      if (id.startsWith("!")) id = id.slice(1);

      if (!(id in servers[message.guild.id][message.channel.id].players)) {
        playersAdded.push(id);
      } else {
        message.channel.send(
          "<@" +
            message.author.id +
            "> user <@" +
            id +
            "> alerady registered as a player."
        );
      }
    } else {
      message.channel.send(
        "<@" +
          message.author.id +
          "> I don't understand who or what is \"" +
          param +
          '".'
      );
    }
  }

  if (
    Object.keys(servers[message.guild.id][message.channel.id].players).length +
      playersAdded.length >
    5
  ) {
    message.channel.send(
      "<@" +
        message.author.id +
        "> no more than 5 players allowed in a Fiasco game (consider splitting in two or more groups, in separate channels)."
    );
    logging("add> It would end with more than 5 players on a game.");
  } else {
    if (playersAdded.length == 0) {
      logging("add> No players added.");
      message.channel.send(
        "<@" +
          message.author.id +
          "> no players added (should mention every user you want to add to a Fiasco game)."
      );
    } else {
      for (const player of playersAdded) {
        servers[message.guild.id][message.channel.id].players[player] = {
          whiteDice: 0,
          blackDice: 0
        };
        message.channel.send(
          "<@" + message.author.id + "> added <@" + player + "> as a player."
        );
      }
    }
    logging("add> Players added: " + playersAdded);
  }
}

function removePlayers(message, params) {
  playersRemoved = [];

  if (servers[message.guild.id][message.channel.id].gameStatus > 0) {
    logging("add> Can't remove players with game running.");
    message.channel.send(
      "<@" + message.author.id + "> can't remove players with game running."
    );
    return;
  }

  for (const param of params) {
    if (param.startsWith("<@") && param.endsWith(">")) {
      var id = param.slice(2, -1);
      if (id.startsWith("!")) id = id.slice(1);

      if (id in servers[message.guild.id][message.channel.id].players) {
        playersRemoved.push(id);
      } else {
        message.channel.send(
          "<@" +
            message.author.id +
            "> user <@" +
            id +
            "> not registered as a player."
        );
      }
    } else {
      message.channel.send(
        "<@" +
          message.author.id +
          "> I don't understand who or what is \"" +
          param +
          '".'
      );
    }
  }
  if (playersRemoved.length == 0) {
    logging("remove> No players removed.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> no players removed (should mention every user you want to remove from a Fiasco game)."
    );
  } else {
    for (const player of playersRemoved) {
      delete servers[message.guild.id][message.channel.id].players[player];
      message.channel.send(
        "<@" +
          message.author.id +
          "> removed <@" +
          player +
          "> from the players' list."
      );
    }
  }
  logging("remove> Players removed: " + playersRemoved);
}

function listPlayers(message, params) {
  var res = "<@" + message.author.id + "> Current players: ";

  var mentionList = [];

  for (var user in servers[message.guild.id][message.channel.id].players) {
    mentionList.push("<@" + user + ">");
  }

  message.channel.send(res + mentionList.join(", "));
}

function checkStatus(message, params) {
  message.channel.send(
    "<@" +
      message.author.id +
      "> Fiasco game in this channel is currently " +
      [
        "not running",
        "at setup phase",
        "in act one",
        "at tilt phase",
        "in act two",
        "at aftermath"
      ][servers[message.guild.id][message.channel.id].gameStatus] +
      "."
  );
}

function rollDice(n) {
  var res = [];
  while (n > 0) {
    res.push(Math.floor(Math.random() * 6 + 1));
    n--;
  }
  return res;
}

function startGame(message, params) {
  if (servers[message.guild.id][message.channel.id].gameStatus > 0) {
    logging("start> Game already running.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> game already running (run **!fiasco-status** to verify the status of a game, and **!fiasco-abort** if you want to abort the game)."
    );
    return;
  }

  if (
    Object.keys(servers[message.guild.id][message.channel.id].players).length <
    3
  ) {
    logging(
      "start> Not enough players (" +
        Object.keys(servers[message.guild.id][message.channel.id].players)
          .length +
        " player(s) registered)"
    );
    message.channel.send(
      "<@" +
        message.author.id +
        "> can't play a Fiasco game with less than 3 players (run **!fiasco-players** to verify registered players)."
    );
    return;
  }

  servers[message.guild.id][message.channel.id].gameStatus = 1;
  logging("start> Game started");
  message.channel.send(
    "<@" + message.author.id + "> game started. Setup phase."
  );

  //Setup phase
  //Rolling dice
  servers[message.guild.id][message.channel.id].dicepool.values = rollDice(
    Object.keys(servers[message.guild.id][message.channel.id].players).length *
      4
  );

  //adding dice colours
  servers[message.guild.id][message.channel.id].dicepool.white = servers[
    message.guild.id
  ][message.channel.id].dicepool.black =
    Object.keys(servers[message.guild.id][message.channel.id].players).length *
    2;

  //calling first Setup
  setupPhase(message, params);
}

function availableSetups(message, type) {
  var res = "";
  for (var i = 1; i <= 6; i++) {
    if (
      servers[message.guild.id][message.channel.id].dicepool.values.filter(
        x => x === i
      ).length >= 1
    ) {
      res += `
__(${i}) ${
        servers[message.guild.id][message.channel.id].playset[type][
          i.toString()
        ]["type"]
      }__`;
      for (var j = 1; j <= 6; j++) {
        if (
          (i == j &&
            servers[message.guild.id][
              message.channel.id
            ].dicepool.values.filter(x => x === j).length >= 2) ||
          (i != j &&
            servers[message.guild.id][
              message.channel.id
            ].dicepool.values.filter(x => x === j).length >= 1)
        ) {
          res += `
(${i},${j}) ${
            servers[message.guild.id][message.channel.id].playset[type][
              i.toString()
            ]["descriptions"][j.toString()]
          }`;
        }
      }
    }
  }
  return res;
}

function setupPhase(message, params) {
  if (
    servers[message.guild.id][message.channel.id].dicepool.values.length == 0
  ) {
    logging("setupPhase called without dice in pool", (type = "ERROR"));
    return;
  }
  if (servers[message.guild.id][message.channel.id].gameStatus != 1) {
    logging("setupPhase called out of setup phase", (type = "ERROR"));
    return;
  }

  // message.channel.send(
  //   "Object: " +
  //     servers[message.guild.id][message.channel.id].playset["relationships"][
  //       "1"
  //     ]["descriptions"]["1"]
  // );

  message.channel.send(
    "Dice Pool available: " +
      servers[message.guild.id][message.channel.id].dicepool.values
  );

  message.channel.send(
    "**Available Relationships**" + availableSetups(message, "relationships")
  );
  message.channel.send(
    "**Available Needs**" + availableSetups(message, "needs")
  );
  message.channel.send(
    "**Available Locations**" + availableSetups(message, "locations")
  );
  message.channel.send(
    "**Available Objects**" + availableSetups(message, "objects")
  );
}

function abortGame(message, params) {
  if (servers[message.guild.id][message.channel.id].gameStatus == 0) {
    logging("abort> Game already not running.");
    message.channel.send(
      "<@" + message.author.id + "> game already not running."
    );
    return;
  }

  servers[message.guild.id][message.channel.id].gameStatus = 0;
  logging("abort> Stopping game.");
  message.channel.send(
    "<@" +
      message.author.id +
      "> game aborted. Run **!fiasco-start** to start a new game with same players."
  );
}

function helpMessage(message, params) {
  message.channel.send(`<@${message.author.id}>
**Before game starts:**
__!fiasco-add <mentions>__: *adds players mentioned to the channel game (up to 5 players per channel)*
__!fiasco-remove <mentions>__: *removes players mentioned to the channel game*
__!fiasco-start__: *starts game (should have at least 3 players)*

**While game is running:**
__!fiasco-abort__: *abort current game (keeps registered players)*

**At all times:**
__!fiasco-players__: *list current players in channel game*
__!fiasco-help__: *this message*
__!fiasco-status__: *current status of a game (Not Running, Setup, Act One, Tilt, Act Two or Aftermath)*

For more information, check https://github.com/friarhob/fiascobot.`);
}

client.on("ready", function() {
  logging("Hello, world. Bot started!");
  client.user.setActivity("Fiasco!");
});

client.on("message", function(message) {
  if (message.author.id != config.tokens.clientID) {
    // Prevent bot from responding to its own messages

    if (message.content.startsWith("!fiasco-")) {
      updateServers(message);
      //console.log(message);

      var fullCommand = message.content.substring(8).split(" ");
      //console.log(fullCommand);

      var command = fullCommand[0];
      var params = fullCommand.slice(1);
      //console.log(command);
      //console.log(params);

      if (command == "add") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") try to add " +
            params +
            " players on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        addPlayers(message, params);
      } else if (command == "players") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") ask to list players on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        listPlayers(message, params);
      } else if (command == "remove") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") try to remove " +
            params +
            " players on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        removePlayers(message, params);
      } else if (command == "help") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") asks for help on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        helpMessage(message, params);
      } else if (command == "status") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") asks for status on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        checkStatus(message, params);
      } else if (command == "start") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") try to start game on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        startGame(message, params);
      } else if (command == "abort") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") try to abort game on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        abortGame(message, params);
      } else {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") sent the invalid command " +
            command +
            " at " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        message.channel.send(
          "<@" +
            message.author.id +
            "> I didn't understand your command. Type **!fiasco-help** for usage."
        );
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
