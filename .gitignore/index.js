const Discord = require('discord.js');

const client = new Discord.Client();

var prefix = "!";

var bot = new Discord.Client()

const active = new Map();

const { Client, Util } = require('discord.js');
const { PREFIX, GOOGLE_API_KEY } = require('./config');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');
const express = require('express');
const app = express();

//DEBUT PARAMETRE EROKU
app.set('port', (process.env.PORT || 5000))

app.listen(app.get('port'), function(){
  console.log(`Bot en fonctionnement sur le port ${app.get('port')}`);
})

const youtube = new YouTube('AIzaSyCVZ9Le-dBnPMXMuPEmuc491Or21D89UNk');

const queue = new Map();

bot.login(process.env.TOKEN)

bot.on("guildMemberAdd", member => {
  member.guild.channels.find("name", "bienvenue-et-adieux").send(`Bienvenue ${member}!`)
})

bot.on("guildMemberRemove", member => {
  member.guild.channels.find("name", "bienvenue-et-adieux").send(`${member} vien de nous dire aurevoir!`)
})

bot.on('guildMemberAdd', member => {
  var role = member.guild.roles.find('name', 'Membre(Non team)');
  member.addRole(role)
})

bot.login(process.env.TOKEN)

client.on("ready", () => {
    console.log("Je suis prêt !");
    client.user.setActivity("!aide | pour obtenir de l'aide");
})

client.on("message", (message) => {
  if (message.content.startsWith(prefix + "ping")) {
    message.channel.send("pong!");
  }
});//

client.on('message', async msg => { // eslint-disable-line
	if (msg.author.bot) return undefined;
	if (!msg.content.startsWith(PREFIX)) return undefined;

	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(' ')[0];
	command = command.slice(PREFIX.length)

	if (command === 'play') {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('Tu a besoin d\' etres dans un salon vocale pour mettre de la musique!');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.send('Je ne peut pas me connecter,est tu sur d\'avoir les permission!');
		}
		if (!permissions.has('SPEAK')) {
			return msg.channel.send('Je ne peut pas parler,est tu sur d\' avoir les permisssion!');
		}

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
			}
			return msg.channel.send(`✅ Playlist: **${playlist.title}** a bien était ajoutée!`);
		} else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					msg.channel.send(`
__**Song séléctionner:**__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}
Donne-moi un nombre entre 1 et 10 pour choisir ta musique!.
					`);
					// eslint-disable-next-line max-depth
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 10000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return msg.channel.send('Mauvaise valeur entrer,arret de la selection de vidéo');
					}
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send('🆘 Je ne peut pas obtenir de résultats.');
				}
			}
			return handleVideo(video, msg, voiceChannel);
		}
	} else if (command === 'skip') {
		if (!msg.member.voiceChannel) return msg.channel.send('Tu n\'est pas dans un salon vocale!');
		if (!serverQueue) return msg.channel.send('Il n\'a aucun song jouer,tu ne peut donc pas skip!');
		serverQueue.connection.dispatcher.end('Commande skip réussie!');
		return undefined;
	} else if (command === 'stop') {
		if (!msg.member.voiceChannel) return msg.channel.send('Tu n\'est pas dans un salon vocale!');
		if (!serverQueue) return msg.channel.send('Il n\'a aucun song jouer,tu ne peut donc pas stop!');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('Commande stop réussie!');
		return undefined;
	} else if (command === 'volume') {
		if (!msg.member.voiceChannel) return msg.channel.send('Tu n\'est pas dans un salon vocale!');
		if (!serverQueue) return msg.channel.send('Il n\'y a aucune musique jouer!');
		if (!args[1]) return msg.channel.send(`Le volume acctuel est: **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`Le volume est mit à: **${args[1]}**`);
	} else if (command === 'np') {
		if (!serverQueue) return msg.channel.send('Il n\'y a aucune musique jouer!');
		return msg.channel.send(`🎶 Jouer maintenant: **${serverQueue.songs[0].title}**`);
	} else if (command === 'queue') {
		if (!serverQueue) return msg.channel.send('Il n\'y a aucune musique jouer!');
		return msg.channel.send(`
__**Liste de musique:**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
**Jouer maintenant:** ${serverQueue.songs[0].title}
		`);
	} else if (command === 'pause') {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('⏸ Musique en pause!');
		}
		return msg.channel.send('Il n\'y a aucune musique jouer!');
	} else if (command === 'resume') {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('▶ Musique remise!');
		}
		return msg.channel.send('Il n\'y a aucune musique jouer!');
	}

	return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`Je ne peut pas rejoindre le salon vocale: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`Je ne peut pas rejoindre le salon vocale: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		else return msg.channel.send(`✅ **${song.title}** a bien été ajouter à la queue!`);
	}
	return undefined;
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === 'Stream is not generating quickly enough.') console.log('Song ended.');
			else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`🎶 Commence à etre jouer: **${song.title}**`);
}

bot.login(process.env.TOKEN)

client.on("message", (message) => {

if (message.content.startsWith(prefix + "aide")) {
    var help_embed = new Discord.RichEmbed()
    .setColor("#339933")
    .setTitle("Liste de mes commandes")
    .addField("!stop", "arrete la musique")
    .addField("!play", "lance une musique")
    .addField("!info", "affiche les informations du bot et du serveur")
    .addField("!kick @", "kick l'utilisateur mentionner")
    .addField("skip", "Passe à la prochaine musique")
    .addField("!volume", "Met le volume à la valeur séléctionner(0.5 est très bien)")
    .addField("!np", "Affiche la musique jouer en ce moments")
    .addField("!queue", "Affiches les musqiues dans la queue")
    .addField("!pause", "Met en pause la musqiue")
    .addField("!resume", "Réactive la musique")
    .addField("!ping", "Surprise!")
    .addField("PS :", "toutes les commandes doivent avoir un ! au début.")
    .setThumbnail(client.user.avatarURL)
    .setFooter("Galactical's bot | By Galactical_ŴỉяĚ")
    message.channel.sendMessage(help_embed);
    console.log("Un utilisateur à effectuer la commande d'aide");
}

if(message.content === prefix + "info"){
    var info_embed = new Discord.RichEmbed()
    .setColor("#339933")
    .setTitle("Voici mes informations")
    .addField("Mon nom :", `${client.user.tag}`, true)
    .addField("Mon descriminateur :", `#${client.user.discriminator}`)
    .addField("Mon id :", `${client.user.id}`)
    .setThumbnail(client.user.avatarURL)
    .setFooter("Discraft | By Théo'Stronaute")
    message.channel.sendMessage(info_embed);
    var info_embed_deux = new Discord.RichEmbed()
    .setColor("#339933")
    .setTitle("Informations du serveur")
    .addField("Nombre de membres :", message.guild.members.size)
    .addField("Nombre de catégories et de salons :", message.guild.channels.size)
    .setFooter("Discraft | By Théo'Stronaute")
    message.channel.sendMessage(info_embed_deux);
    console.log("Un utilisateur à effectuer la commande d'information");
}

if(message.content.startsWith(prefix + "kick")){
                // Easy way to get member object though mentions.
                var member= message.mentions.members.first();
                //Erreurs
                if(message.mentions.users.size === 0){
                    return message.channel.send("Vous devez mentionner un utilisateur");
                }

                var kick = message.guild.member(message.mentions.users.first());

                if(!kick) {
                    return message.channel.send("Je ne sais pas si l'utilsateur existe :/");
                }

                if(!message.guild.member(client.user).hasPermission("KICK_MEMBERS")) {
                    return message.channel.send("Je n'ai pas la permission pour kick");
                }
                // Kick
                member.kick().then((member) => {
                    // Successmessage
                    message.channel.send(":wave: " + member.displayName + " à bien était kick :point_right: ");
                }).catch(() => {
                     // Failmessage
                    message.channel.send("Accès interdit");
                })
}
})
