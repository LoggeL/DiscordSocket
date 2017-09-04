/*jshint esversion: 6 */
const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const Discord = require('discord.js');
const config = require('./config.json');
const request = require('request')

const client = new Discord.Client();
var users = {};
const base_url = "https://discordapp.com/api";

const oauth2settings = {
  client_id: "354217639335165954",
  client_secret: "iWKdE5j5tCkhPfM3lgZYfri2N8wY4jG9",
  redirect_uri: "http://localhost:8080/auth/discord/code",
  scope: "identify"
}

server.listen(8080);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/discord.html');
});

//Get auth code
app.get('/auth/discord/authorize', (req, res) => {
  res.redirect(base_url + '/oauth2/authorize' +
    '?client_id=' + oauth2settings.client_id +
    '&scope=' + oauth2settings.scope +
    '&redirect_uri=' + oauth2settings.redirect_uri +
    '&response_type=code');
});

//Catch auth code
app.get('/auth/discord/code', (req, res) => {

  //Get auth token
  request.post(base_url + '/oauth2/token' +
    '?client_id=' + oauth2settings.client_id +
    '&scope=' + oauth2settings.scope +
    '&code=' + req.query.code +
    '&client_secret=' + oauth2settings.client_secret +
    '&redirect_uri=' + oauth2settings.redirect_uri +
    '&grant_type=authorization_code',
    (error, response, body) => {
      if (error) return console.error(error);

      var tokenData = JSON.parse(body);

      var options = {
        headers: {
          "Authorization": `${tokenData.token_type} ${tokenData.access_token}`,
          "content-type": "application/x-www-form-urlencoded"
        },
        url: base_url + '/users/@me'
      };

      console.log(options);

      request.get(options,
        (error, response, body) => {
          if (error) return console.error(error);
          res.send(body)
        });
    });

});

client.on('ready', () => {
  console.log("Bot running");
});

client.on('message', message => {
  if (message.channel.id != config.channel) return;
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
    console.log(`${socket.id} (${loginData.name}) authed`);
    socket.emit("loginFeedback", true);

    //Update Userlist
    users[socket.id] = loginData;
    io.emit('onlineUser', {
      name: loginData.name,
      avatar: loginData.avatar
    });
  });

  //Message to Discord
  socket.on('sendMessage', function (messageContent) {
    var messageData = {
      content: messageContent,
      timestamp: new Date(),
      author: {
        name: users[socket.id].name,
        avatar: users[socket.id].avatar
      }
    };
    client.channels.get(config.channel).send({
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
    //Client will get it via Discord Message event
    //io.emit('newMessage', messageData);
  });

  //User closes/timeout
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