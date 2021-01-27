const config = require("./fiasconfig.json");
const Discord = require("discord.js");
const client = new Discord.Client();

const https = require("https");

var servers = {};

function debug(message, params) {
  // add user ids authorized here
  if (["433258286540652545"].includes(message.author.id))
    logging("debug> authorized " + message.author.id);
  else {
    logging("debug> denied " + message.author.id);
    return;
  }
  if (
    servers[message.guild.id][message.channel.id].gameStatus < 2 &&
    params.length > 0 &&
    params[0] == "skipToActOne"
  ) {
    logging("debug> skipping to Act One");
    servers[message.guild.id][message.channel.id].gameStatus = 2;
    if (
      !(
        message.author.id in
        servers[message.guild.id][message.channel.id].players
      )
    ) {
      servers[message.guild.id][message.channel.id].players[
        message.author.id
      ] = {
        setups: {},
        whiteDice: 0,
        blackDice: 0
      };
    }
  } else {
    logging("debug> invalid params: " + params);
  }
}

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
      // player: { setups: {},
      //    whiteDice: 0,
      //    blackDice: 0 }
      playset: require("./playsets/mainstreet.json"),
      dicepool: {
        values: [],
        white: 0,
        black: 0
      },
      scene: {
        active: false,
        type: "",
        // establish,resolve
        player: -1,
        outcome: "undefined"
        // undefined,positive,negative
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
          setups: {},
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

  //list initial available setups
  availableSetups(message, params);
}

function availableSetupsPerType(message, type) {
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

function availableSetups(message, params) {
  if (servers[message.guild.id][message.channel.id].gameStatus != 1) {
    logging("availableSetups> called out of Setup Phase");
    message.channel.send(
      "<@" +
        message.author.id +
        "> available setups makes sense just in Setup Phase (run **__!fiasco-status__** to check status of the game)."
    );
    return;
  }
  if (
    servers[message.guild.id][message.channel.id].dicepool.values.length == 0
  ) {
    logging(
      "availableSetups> called during Setup Phase without dice in pool",
      (type = "ERROR")
    );
    return;
  }

  message.channel.send(
    "Dice Pool available: " +
      servers[message.guild.id][message.channel.id].dicepool.values
  );

  message.channel.send(
    "**Available Relationships**" +
      availableSetupsPerType(message, "relationships")
  );
  message.channel.send(
    "**Available Needs**" + availableSetupsPerType(message, "needs")
  );
  message.channel.send(
    "**Available Locations**" + availableSetupsPerType(message, "locations")
  );
  message.channel.send(
    "**Available Objects**" + availableSetupsPerType(message, "objects")
  );
}

function addSetup(message, params) {
  if (servers[message.guild.id][message.channel.id].gameStatus != 1) {
    logging("addSetup> called out of Setup Phase");
    message.channel.send(
      "<@" +
        message.author.id +
        "> add a setup makes sense just in Setup Phase (run **__!fiasco-status__** to check status of the game)."
    );
    return;
  }

  if (params.length < 4) {
    logging("addSetup> less than 4 parameters");
    message.channel.send(
      "<@" +
        message.author.id +
        "> **!fiasco-addSetup** usage: *!fiasco-addSetup <type> <player> <typeDie> <detailDie>*."
    );
    return;
  }

  if (!["relationship", "object", "need", "location"].includes(params[0])) {
    logging("addSetup> type invalid: " + params[0]);
    message.channel.send(
      "<@" +
        message.author.id +
        "> " +
        params[0] +
        " is not a valid setup. Setup types: *relationship, object, need* or *location*"
    );
    return;
  }

  if (!(params[1].startsWith("<@") && params[1].endsWith(">"))) {
    logging("addSetup> player not mentioned: " + params[1]);
    message.channel.send(
      "<@" +
        message.author.id +
        "> you should mention the player you'll have a relationship with."
    );
    return;
  }

  var otherPlayer = params[1].slice(2, -1);
  if (otherPlayer.startsWith("!")) otherPlayer = otherPlayer.slice(1);

  if (otherPlayer === message.author.id) {
    logging("addSetup> try to create a relationship with itself");
    message.channel.send(
      "<@" + message.author.id + "> no one can add a relationship with itself."
    );
    return;
  }

  if (!(otherPlayer in servers[message.guild.id][message.channel.id].players)) {
    logging(
      "addSetup> try to create a relationship with a non-player: " +
        params[1] +
        ". Players: " +
        Object.keys(servers[message.guild.id][message.channel.id].players)
    );
    message.channel.send(
      "<@" +
        message.author.id +
        "> " +
        params[1] +
        " isn't listed as a player. Use **!fiasco-players** to check who's playing this game."
    );

    return;
  }

  if (
    servers[message.guild.id][message.channel.id].dicepool.values.filter(
      x => x == params[2]
    ).length < 1 ||
    servers[message.guild.id][message.channel.id].dicepool.values.filter(
      x => x == params[3]
    ).length < (params[2] != params[3] ? 1 : 2)
  ) {
    logging(
      "addSetup> " +
        params[2] +
        " and " +
        params[3] +
        " should be valid dice. Available dice: " +
        servers[message.guild.id][message.channel.id].dicepool.values
    );

    message.channel.send(
      "<@" +
        message.author.id +
        "> you should use two dice available in the pool. Use **!fiasco-availablesetups** to check which setups are available."
    );

    return;
  }

  //TODO: add setup to players
  if (
    !(
      otherPlayer in
      servers[message.guild.id][message.channel.id].players[message.author.id]
        .setups
    )
  ) {
    servers[message.guild.id][message.channel.id].players[
      message.author.id
    ].setups[otherPlayer] = [];
  }
  if (
    !(
      message.author.id in
      servers[message.guild.id][message.channel.id].players[otherPlayer].setups
    )
  ) {
    servers[message.guild.id][message.channel.id].players[otherPlayer].setups[
      message.author.id
    ] = [];
  }

  /* Remove dice */
  for (var i = 2; i <= 3; i++) {
    var index = servers[message.guild.id][
      message.channel.id
    ].dicepool.values.indexOf(parseInt(params[i], 10));
    if (index == -1) {
      logging(
        "addSetup> try to remove unexisting die " +
          params[i] +
          " from " +
          servers[message.guild.id][message.channel.id].dicepool.values,
        (type = "ERROR")
      );
      abortGame(message, params);
      message.channel.send(
        "Internal error (try to remove unexisting die). Game aborted."
      );
      return;
    }
    servers[message.guild.id][message.channel.id].dicepool.values.splice(
      index,
      1
    );
  }

  var setupCreated =
    params[0] +
    ": (" +
    servers[message.guild.id][message.channel.id].playset[params[0] + "s"][
      params[2]
    ]["type"] +
    ") " +
    servers[message.guild.id][message.channel.id].playset[params[0] + "s"][
      params[2]
    ]["descriptions"][params[3]];

  servers[message.guild.id][message.channel.id].players[
    message.author.id
  ].setups[otherPlayer].push(setupCreated);

  servers[message.guild.id][message.channel.id].players[otherPlayer].setups[
    message.author.id
  ].push(setupCreated);

  logging(
    "addSetup> setup " +
      setupCreated +
      " added to users " +
      message.author.id +
      " and " +
      otherPlayer
  );

  message.channel.send(
    "<@" +
      message.author.id +
      "> setup added. Run **!fiasco-setups** to list all setups defined and **!fiasco-availablesetups** to check new available setups."
  );

  if (
    servers[message.guild.id][message.channel.id].dicepool.values.length == 0
  ) {
    servers[message.guild.id][message.channel.id].gameStatus = 2;
    message.channel.send("Setups defined. Act One started!");
  }
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

function listSetups(message, params) {
  if (servers[message.guild.id][message.channel.id].gameStatus == 0) {
    logging("listSetups> Game not running.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> game is not running (run **!fiasco-start** to start a new game)."
    );
    return;
  }
  for (var player in servers[message.guild.id][message.channel.id].players) {
    var setupsMessage = `<@${player}> setups:`;
    for (var otherPlayer in servers[message.guild.id][message.channel.id]
      .players[player].setups) {
      for (
        var i = 0;
        i <
        servers[message.guild.id][message.channel.id].players[player].setups[
          otherPlayer
        ].length;
        i++
      ) {
        setupsMessage +=
          `
` +
          servers[message.guild.id][message.channel.id].players[player].setups[
            otherPlayer
          ][i] +
          ` with <@${otherPlayer}>`;
      }
    }
    message.channel.send(setupsMessage);
  }
  logging("listSetups> setups listed.");
}

function listDicepool(message, params) {
  if (servers[message.guild.id][message.channel.id].gameStatus == 0) {
    logging("listDicepool> Game not running.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> game is not running (run **!fiasco-start** to start a new game)."
    );
    return;
  }
  message.channel.send(
    "<@" +
      message.author.id +
      "> available dice: " +
      servers[message.guild.id][message.channel.id].dicepool.white +
      " white and " +
      servers[message.guild.id][message.channel.id].dicepool.black +
      " black."
  );

  logging("listDicepool> dicepool listed.");
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

function startScene(message, params) {
  if (
    ![2, 4].includes(servers[message.guild.id][message.channel.id].gameStatus)
  ) {
    logging("startScene> Called out of an act.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> scenes can only be started on acts (run **!fiasco-status** to see current status of a game)."
    );
  } else if (
    params.length == 0 ||
    !["establish", "resolve"].includes(params[0])
  ) {
    message.channel.send(
      "<@" +
        message.author.id +
        "> usage: __!fiasco-scene <type>__ (Types: *establish* or *resolve*)."
    );
    logging("startScene> invalid params: " + params);
  } else if (
    !Object.keys(
      servers[message.guild.id][message.channel.id].players
    ).includes(message.author.id)
  ) {
    logging("startScene> " + message.author.id + " is not a player.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> only registered players can start scenes (run **!fiasco-players** to see currently registered players)."
    );
  } else if (servers[message.guild.id][message.channel.id].scene.active) {
    logging("startScene> scene already running.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> already running a scene requested by <@ " +
        servers[message.guild.id][message.channel.id].scene.player +
        "> to " +
        servers[message.guild.id][message.channel.id].scene.type +
        " with outcome " +
        servers[message.guild.id][message.channel.id].scene.outcome +
        "."
    );
  } else {
    servers[message.guild.id][message.channel.id].scene = {
      type: params[0],
      active: true,
      player: message.author.id,
      outcome: "undefined"
    };
    message.channel.send(
      "<@" +
        message.author.id +
        "> request to " +
        params[0] +
        " a scene. Current outcomes available: " +
        servers[message.guild.id][message.channel.id].dicepool.white +
        " positive(s) and " +
        servers[message.guild.id][message.channel.id].dicepool.black +
        " negative(s)."
    );
    logging(
      "startScene> " +
        message.author.id +
        " requested to " +
        params[0] +
        " a scene."
    );
  }
}

function setOutcome(message, params) {
  if (
    ![2, 4].includes(servers[message.guild.id][message.channel.id].gameStatus)
  ) {
    logging("setOutcome> Called out of an act.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> outcomes can only be set on acts (run **!fiasco-status** to see current status of a game)."
    );
  } else if (
    params.length == 0 ||
    !["negative", "positive"].includes(params[0])
  ) {
    message.channel.send(
      "<@" +
        message.author.id +
        "> usage: __!fiasco-outcome <type>__ (Types: *positive* or *negative*)."
    );
    logging("setOutcome> invalid params: " + params);
  } else if (
    !Object.keys(
      servers[message.guild.id][message.channel.id].players
    ).includes(message.author.id)
  ) {
    logging("setOutcome> " + message.author.id + " is not a player.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> only registered players can set outcomes (run **!fiasco-players** to see currently registered players)."
    );
  } else if (!servers[message.guild.id][message.channel.id].scene.active) {
    logging("setOutcome> scene not running.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> scene not running (run **!fiasco-scene <type>** to start a new scene)."
    );
  } else if (
    servers[message.guild.id][message.channel.id].scene.outcome != "undefined"
  ) {
    logging(
      "setOutcome> outcome already defined as " +
        servers[message.guild.id][message.channel.id].scene.outcome
    );
    message.channel.send(
      "<@" +
        message.author.id +
        "> outcome already defined as " +
        servers[message.guild.id][message.channel.id].scene.outcome +
        "."
    );
  } else if (
    servers[message.guild.id][message.channel.id].scene.type == "establish" &&
    servers[message.guild.id][message.channel.id].scene.player ==
      message.author.id
  ) {
    logging("setOutcome> try to set outcome for own establishing scene.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> other players should decide the outcome of your establishing scene."
    );
  } else if (
    servers[message.guild.id][message.channel.id].scene.type == "resolve" &&
    servers[message.guild.id][message.channel.id].scene.player !=
      message.author.id
  ) {
    logging("setOutcome> try to set outcome for other player resolving scene.");
    message.channel.send(
      "<@" +
        message.author.id +
        "> only <@" +
        servers[message.guild.id][message.channel.id].scene.player +
        "> can set the outcome of the resolving scene."
    );
  } else if (
    params[0] == "positive" &&
    servers[message.guild.id][message.channel.id].dicepool.white == 0
  ) {
    logging(
      "setOutcome> try to set positive outcome without white dice available."
    );
    message.channel.send(
      "<@" + message.author.id + "> no more white dice available."
    );
  } else if (
    params[0] == "negative" &&
    servers[message.guild.id][message.channel.id].dicepool.black == 0
  ) {
    logging(
      "setOutcome> try to set negative outcome without black dice available."
    );
    message.channel.send(
      "<@" + message.author.id + "> no more black dice available."
    );
  } else {
    if (params[0] == "positive") {
      servers[message.guild.id][message.channel.id].dicepool.white -= 1;
    } else {
      servers[message.guild.id][message.channel.id].dicepool.black -= 1;
    }
    servers[message.guild.id][message.channel.id].scene.outcome = params[0];
    logging("setOutcome> setting " + params[0] + " outcome.");
    message.channel.send(
      "<@" + message.author.id + "> outcome now defined as " + params[0] + "."
    );
    if (servers[message.guild.id][message.channel.id].gameStatus == 4) {
      //Act two
      if (params[0] == "positive") {
        servers[message.guild.id][message.channel.id].players[
          servers[message.guild.id][message.channel.id].scene.player
        ].whiteDice += 1;
      } else {
        //negative
        servers[message.guild.id][message.channel.id].players[
          servers[message.guild.id][message.channel.id].scene.player
        ].blackDice += 1;
      }
      servers[message.guild.id][message.channel.id].scene.active = false;
      if (
        servers[message.guild.id][message.channel.id].dicepool.white +
          servers[message.guild.id][message.channel.id].dicepool.black ==
        0
      ) {
        servers[message.guild.id][message.channel.id].gameStatus = 5;
      }
    }
  }
}

function helpMessage(message, params) {
  message.channel.send(`<@${message.author.id}>
**Before game starts:**
__!fiasco-add <mentions>__: *adds players mentioned to the channel game (up to 5 players per channel)*
__!fiasco-remove <mentions>__: *removes players mentioned to the channel game*
__!fiasco-start__: *starts game (should have at least 3 players)*

**At setup phase:**
__!fiasco-availablesetups__: *list available setups from dicepool*
__!fiasco-addsetup__ <type> <player> <typeDie> <detailDie>: *add a new setup between yourself and player mentioned*
    **Types:** *relationship, object, need* or *location*

**During acts:**
__!fiasco-scene <type>__: *define a scene type when is your turn*
    **Types:** *establish* or *resolve*
__!fiasco-outcome <type>__: *define an outcome for the scene currently being described*
    **Types:** *positive* or *negative*
__!fiasco-giveDie <player>__: *give the resulting die to a player* (only in Act One)

**While game is running:**
__!fiasco-abort__: *abort current game (keeps registered players)*
__!fiasco-setups__: *list all setups defined*
__!fiasco-dicepool__: *available dice in center*

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

      if (command == "debug") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") try to debug with params " +
            params +
            " on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        debug(message, params);
      } else if (command == "add") {
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
      } else if (command == "availablesetups") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") asks for available setups on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        availableSetups(message, params);
      } else if (command == "addsetup") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") try to add a setup with params " +
            params +
            " on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        addSetup(message, params);
      } else if (command == "setups") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") ask to list setups from " +
            params +
            " on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        listSetups(message, params);
      } else if (command == "dicepool") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") ask the dicepool available on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        listDicepool(message, params);
      } else if (command == "scene") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") try to start a scene with params " +
            params +
            " on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        startScene(message, params);
      } else if (command == "outcome") {
        logging(
          "User " +
            message.author.username +
            " (" +
            message.author.id +
            ") try to set an outcome with params " +
            params +
            " on channel " +
            message.channel.name +
            " (" +
            message.channel.id +
            ") of server " +
            message.guild.name +
            " (" +
            message.guild.id +
            ")."
        );
        setOutcome(message, params);
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
