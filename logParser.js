const discord = require("discord.js");
const steam = require("steam-community")();
const fetch = require("request");
const config = require("./config");
const sql = require("sqlite");

const SEARCH_URL = "http://logs.tf/json_search?limit=5&";
const DATA_URL = "http://logs.tf/json/";

var bot = new discord.Client();

function toSQLReadable(num = new String()) {
	var r = "enc";
	var l = ["A","B","C","D","E","F","G","H","I","J"];
	num.split("").forEach(char => {
		r += l[parseInt(char)];
	});
	return r;
}
function fetchAlias(alias, _msg) {
	var r;
	sql.open("./data/dat.sqlite").then(() => {
		sql.get(`SELECT * FROM ${toSQLReadable(_msg.guild.id)} WHERE name = "${alias}"`).then(row => {
			if(!row) {
				_msg.channel.send("Alias does not exist!");
			}
			else {
				r = row.id;
			}
		}).catch(() => {
			sql.run(`CREATE TABLE IF NOT EXISTS ${toSQLReadable(_msg.guild.id)} (name TEXT, id INTEGER)`);
		});
	});
	return r;
}

bot.on("message", msg => {
	if(msg.author.bot) return;
	if(msg.author.id = "151044827738275840" && msg.content.startsWith("!!--")) {
		var shout = msg.content.replace("!!--", "");
		bot.guilds.forEach(guild => {
			if(guild.available) {
				guild.channels.forEach(channel => {
					if(channel.type === "text" && channel.name.toLowerCase() === "general") {
						msg.channel.send("Found general text channel in server: "+channel.guild.name+" "+channel.guild.id);
						var e = new discord.RichEmbed()
							.setTitle("Announcement")
							.setColor("39FF14")
							.setThumbnail(bot.user.avatarURL)
							.setTimestamp()
							.setDescription(shout);
						channel.send({embed: e});
					}
				});
			}
		});
	}
	else if(msg.channel.type === "dm") {
		bot.guilds.find("ownerID", "151044827738275840").owner.send("`" + msg.author.tag + "` " + msg.cleanContent);
	}
	else if(msg.mentions.users) {
		if(msg.mentions.users.first().id === bot.user.id || msg.mentions.members.first().id === bot.user.id) {
			bot.guilds.find("ownerID", "151044827738275840").owner.send("`" + msg.author.tag + "` " + msg.cleanContent);
		}
	}
});

bot.on("message", msg => {
	if(msg.author.bot) return;
	if(msg.channel.type !== "text") return;
	var logs = msg.content.match(/\[\[(.*?)\]\]/g);
	if(logs && logs.length) {
		var cmd = logs[0].replace(/\[\[|\]\]/g, "");
		var args = cmd.split(" ");
		var type;
		args.forEach(arg => {
			if(arg === "search") type = "search";
			if(arg === "alias") type = "alias";
		});

		if(type === "search") {
			//http://logs.tf/json_search?title=[TITLE]&uploader=[STEAMID]&player=[STEAMID]&limit=[LIMIT]
			var url = SEARCH_URL;
			args.forEach(arg => {
				if(arg.startsWith("title=")) url += arg + "&";
				if(arg.startsWith("uploader=")) url += arg + "&";
				if(arg.startsWith("player=")) {
					if(isNaN(arg)) {
						url += "player=" + fetchAlias(arg.replace("player=", ""), msg) + "&";
					}
					else {
						url += arg + "&";
					}
				}
			});
			if(url === SEARCH_URL) return;
			url = url.slice(0, -1);
			fetch(url, (err, resp, body) => {
				console.log('error:', err);
				console.log('statusCode:', resp && resp.statusCode);
				var json = JSON.parse(body);
				var e = new discord.RichEmbed().setThumbnail("http://logs.tf/assets/img/logo-social.png");
				json.logs.forEach(prop => {
					e.addField(prop.title, "http://logs.tf/"+prop.id);
				});
				msg.channel.send({embed: e});
			});
		}
		else if(type === "alias") {
			console.log(msg.guild.id, toSQLReadable(msg.guild.id));
			var n = args[1];
			var i = args[2];
			sql.open("./data/dat.sqlite").then(() => {
				sql.get(`SELECT * FROM ${toSQLReadable(msg.guild.id)} WHERE name = "${n}"`).then(row => {
					if(!row) {
						sql.run(`INSERT INTO ${toSQLReadable(msg.guild.id)} (name, id) VALUES (?, ?)`, [n, i]);
						msg.channel.send("Alias added.");
					}
					else {
						msg.channel.send(`The alias ${n} has already been taken.`);
					}
				}).catch(() => {
					sql.run(`CREATE TABLE IF NOT EXISTS ${toSQLReadable(msg.guild.id)} (name TEXT, id INTEGER)`);
					sql.run(`INSERT INTO ${toSQLReadable(msg.guild.id)} (name, id) VALUES (?, ?)`, [n, i]);
				});
			});
		}
		else {
			//http://logs.tf/json/[LOGID]
			var cleanArgs = [];
			var url = DATA_URL;
			args.forEach(arg => {
				if(!arg.includes("/")) cleanArgs.push(arg);
				else url += arg.split("/").pop().split("#").shift();
			});
			fetch(url, (err, resp, body) => {
				console.log('error:', err);
				console.log('statusCode:', resp && resp.statusCode);
				var json = JSON.parse(body);
				if(cleanArgs.length) {
					//[0] => playername
					//[1+] => specific stats
					var playerExists = false;
					var playerID = "[U:1:0]";
					for(var id in json.names) {
						if(json.names[id].toLowerCase().includes(cleanArgs[0].toLowerCase())) {
							playerExists = true;
							playerID = id;
						}
					}
					var e = new discord.RichEmbed();
					if(playerExists) {
						e.setTitle(json.names[playerID])
						 .setURL(url.replace("json/", ""))
						 .setThumbnail("http://logs.tf/assets/img/logo-social.png")
						 .setColor(victor);
						cleanArgs.shift();
						cleanArgs.forEach(stat => {
							if(json.players[playerID][stat.toLowerCase()]) {
								e.addField(stat.toUpperCase(), json.players[playerID][stat.toLowerCase()], true);
							}
						});
					}
					else {
						e.setTitle(url.replace("json/", ""))
						 .setURL(url.replace("json/", ""))
						 .setThumbnail("http://logs.tf/assets/img/logo-social.png")
						 .setColor(victor);
						cleanArgs.shift();
						cleanArgs.forEach(stat => {
							if(stat.toLowerCase() === "length") {
								e.addField("LENGTH", json.length, true);
							}
							if(stat.toLowerCase() === "players") {
								var li = "";
								for(var pid in json.names) {
									li += `${json.names[pid]} | ${pid}\n`;
								}
								e.addField("PLAYERS", li, true);
							}
							if(stat.toLowerCase() === "rounds") {
								e.addField("ROUNDS", json.rounds.length, true);
							}
						});
					}
					msg.channel.send({embed: e});
				}
				else {
					var victor = (json.teams.Red.score > json.teams.Blue.score) ? ("B8383B") : ((json.teams.Red.score < json.teams.Blue.score) ? ("5885A2") : ("FFFFFF"));
					var averages = {red:{kills:0,dmg:0,ubers:0,drops:0,best:""},blu:{kills:0,dmg:0,ubers:0,drops:0,best:""}};
					averages.red.kills = json.teams.Red.kills;
					averages.blu.kills = json.teams.Blue.kills;
					averages.red.dmg = json.teams.Red.dmg;
					averages.blu.dmg = json.teams.Blue.dmg;
					averages.red.ubers = json.teams.Red.charges;
					averages.red.drops = json.teams.Red.drops;
					averages.blu.ubers = json.teams.Blue.charges;
					averages.blu.drops = json.teams.Blue.drops;
					var redInfo = `${averages.red.kills} Kills\n${averages.red.dmg} DMG\n${averages.red.ubers} Ubers\n${averages.red.drops} Drops`;
					var bluInfo = `${averages.blu.kills} Kills\n${averages.blu.dmg} DMG\n${averages.blu.ubers} Ubers\n${averages.blu.drops} Drops`
					var p = "";
					for(var pid in json.names) {
						p += json.names[pid] + " " + pid + "\n";
					}
					var e = new discord.RichEmbed()
						.setTitle(url.replace("json/", ""))
						.setURL(url.replace("json/", ""))
						.setThumbnail("http://logs.tf/assets/img/logo-social.png")
						.addField("RED - "+json.teams.Red.score, redInfo, true)
						.addField("BLU - "+json.teams.Blue.score, bluInfo, true)
						.setColor(victor);
					if(msg.content.includes("--d")) {
						e.addField("Players", p);
					}
					msg.channel.send({embed: e});
				}
			});
		}

	}
	else if(msg.content.match(/(http:\/\/|https:\/\/)logs\.tf\/\d+/g)) {
		var url = DATA_URL + msg.content.match(/(http:\/\/|https:\/\/)logs\.tf\/\d+/g)[0].split("/").pop().split("#").shift();
		fetch(url, (err, resp, body) => {
			console.log('error:', err);
			console.log('statusCode:', resp && resp.statusCode);
			var json = JSON.parse(body);
			var victor = (json.teams.Red.score > json.teams.Blue.score) ? ("B8383B") : ((json.teams.Red.score < json.teams.Blue.score) ? ("5885A2") : ("FFFFFF"));
			var e = new discord.RichEmbed()
				.setTitle(url.replace("json/", ""))
				.setURL(url.replace("json/", ""))
				.setThumbnail("http://logs.tf/assets/img/logo-social.png")
				.addField("RED - "+json.teams.Red.score, json.teams.Red.kills+" kills", true)
				.addField("BLU - "+json.teams.Blue.score, json.teams.Blue.kills+" kills", true)
				.setColor(victor);
			if(msg.content.split(" ").length === 1) msg.delete();
			msg.channel.send({embed: e});
		});
	}
});

bot.login(config.TOKEN);