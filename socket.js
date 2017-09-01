/*jshint esversion: 6 */
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var Discord = require('discord.js');
var config = require('./config.json');

const client = new Discord.Client();

var users = {};

server.listen(8080);

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/discord.html');
});

client.on('ready', () => {
  console.log("Bot running");
});

client.on('message', message => {
  if (message.channel.id != "301783104371294219") return;
  var images = [];
  for (i = 0; i < message.embeds.length; i++) {
    if (!message.embeds[i].thumbnail) continue;
    delete message.embeds[i].thumbnail.embed;
    images.push(message.embeds[i].thumbnail);
  }
  if (message.author == client.user && message.embeds && message.embeds[0] && message.embeds[0].author) {
    var embed = message.embeds[0];
    io.emit("newMessage", {
      author: {
        name: embed.author.name,
        avatar: embed.author.iconURL
      },
      content: embed.description,
      timestamp: embed.createdAt,
      images: images
    });
  } else {
    io.emit("newMessage", {
      author: {
        name: message.author.username,
        avatar: message.author.avatarURL
      },
      content: message.content,
      timestamp: message.createdAt,
      images: images
    });
  }
});


io.on('connection', function (socket) {
  console.log(socket.id + ' connected');

  socket.on('login', function (loginData) {

    if (!loginData || !loginData.name || !loginData.avatar) return socket.emit("loginFeedback", false);

    //Add Auth
    console.log(loginData.name + " authed");
    socket.emit("loginFeedback", true);

    //Update Userlist
    users[socket.id] = loginData;
    io.emit('onlineUser', {
      name: loginData.name,
      avatar: loginData.avatar
    });
  });

  socket.on('sendMessage', function (messageContent) {
    var messageData = {
      content: messageContent,
      timestamp: new Date(),
      author: {
        name: users[socket.id].name,
        avatar: users[socket.id].avatar
      }
    };
    client.channels.get("301783104371294219").send({
      "embed": {
        "description": messageData.content,
        "color": 11813441,
        "timestamp": messageData.timestamp,
        "author": {
          "name": messageData.author.name,
          "icon_url": messageData.author.avatar
        }
      }
    });
    //io.emit('newMessage', messageData);
  });

  socket.on('disconnect', function () {
    users[socket.id] = users[socket.id] ? users[socket.id] : {
      name: "Unknown",
      avatar: "http://s3.amazonaws.com/37assets/svn/765-default-avatar.png"
    };
    console.log(`${users[socket.id].name} (${socket.id}) closed`);
    io.emit('offlineUser', {
      name: users[socket.id].name,
      avatar: users[socket.id].avatar
    });
  });
});

client.login(config.token);