const Tail = require('tail').Tail;
const dateFormat = require('dateformat');
const Discord = require('discord.js');
const {TOKEN, LOG_LOCATION, GUILD_ID, CHANNEL_NAME} = require('./config.json');
const verifyBedWord = require('./lib/verifyBedWord');
const client = new Discord.Client();
const pool = require('./lib/PoolConnection');
const connection = pool.promise();

const data = {
    test: 1,
    text: "345345"
};

var sqlMessage, userName1, GUID;

let logsQueue = [];
let logBeingTreated = false;

function sendsql(name, GUID, message) {
    var fullDate = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    const users = [[name, GUID, message, fullDate]];
    const sql = `INSERT INTO GameChat(name, GUID, message, date)
    VALUES
    ?`;
    connection.query(sql, [users], function (err, results) {
        if (err) console.log(err);
    });
}

function sendOnline(online) {
    var fullDate = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    const sql = 'UPDATE `Online` SET `online` = ?';
    connection.query(sql, online, function (err, results) {
        if (err) console.log(err);
    });
    const sql2 = 'UPDATE `Online` SET `date` = ?';
    connection.query(sql2, fullDate, function (err, results) {
        if (err) console.log(err);
    });
}

client.once('ready', () => {
    client.user.setActivity('');

    const tail = new Tail(LOG_LOCATION, {
        useWatchFile: true
    });

    tail.on("line", (data) => {
        logsQueue.push(getLog(data));
        treatLogs();
    }).on("error", function (error) {
        console.log('Ошибочка при чтении файлика: ', error);
    });
});

client.login(TOKEN);

function getLog(data) {
    const splittedData = data.split('|');

    if (data.includes('Chat(') && data.includes('<!G>')) {
        const id = splittedData[1].indexOf('=)):');
        GUID = splittedData[1].substring(splittedData[1].indexOf('id=') + 3, id + 1);
        userName1 = splittedData[1].substring(splittedData[1].indexOf('Chat("') + 6, splittedData[1].indexOf('"(id'));
        if (data.includes('Surv')) {
            this.userName = userName1 + " - СМЕНИТЕ НИК!";
        } else this.userName = userName1;
        var strFinalChat = splittedData[1].replace(splittedData[1].substring(splittedData[1].indexOf('(id='), id), '')
            .replace(splittedData[1].substring(splittedData[1].indexOf(' Chat('), 6), '');
        var temp = strFinalChat.replace("=)): <!G>", ":");
        sqlMessage = temp.substring(temp.indexOf('":') + 3);
        console.log("Текст сообщения:" + sqlMessage);
        sendsql(userName1, GUID, sqlMessage);

        return {
            'hour': splittedData[0].trim(),
            'data': sqlMessage,
            'type': getLogType(splittedData[1]),
            'username': this.userName
        }
    } else
        return {
            'hour': splittedData[0].trim(),
            'data': "STOPLogsKolobok",
            'type': getLogType(splittedData[1])
        }
}

function getLogType(data) {
    if (data.includes('hit by') || data.includes('is unconscious') || data.includes('regained consciousness')) {
        return 'ORANGE';
    } else if (data.includes('[ADMIN]')) {
        return 'GREEN';
    } else if (data.includes('[SS88]')) {
        return 'BLUE';
    } else if (data.includes('[PH]')) {
        return 'ORANGE';
    } else if (data.includes('[COT]')) {
        return 'DARK_ORANGE';
    } else if (data.includes('placed')) {
        return 'PURPLE';
    } else if (data.includes('built') || data.includes('dismantled')) {
        return 'LUMINOUS_VIVID_PINK';
    } else if (data.includes('Survivor')) {
        return 'BLACK';
    } else if (data.includes('Chat(')) {
        return 'GREY';
    } else {
        return 'BLURPLE';
    }
}

function treatLogs() {
    if (logBeingTreated || !logsQueue.length) return;
    logBeingTreated = true;
    const log = logsQueue.shift();
    const guild = client.guilds.cache.get("6");
    const channel = guild.channels.cache.find(channel => channel.id === "7");
    const messageId = channel.lastMessageID;

    if (messageId) {
        channel.messages.fetch(messageId)
            .then((lastMessage) => {
                if (lastMessage && lastMessage.embeds && lastMessage.embeds.length && lastMessage.embeds[0].color === log.type && lastMessage.embeds[0].fields && lastMessage.embeds[0].fields.length < 25) {
                    try {
                        editMessage(lastMessage, log);
                    } catch (e) {
                        console.log("Ошибка отправки сообщения:" + e);
                    }
                } else {
                    try {
                        sendMessage(channel, log);
                    } catch (e) {
                        console.log("Ошибка отправки сообщения:" + e);
                    }
                }
            })
            .catch(() => {
                try {
                    sendMessage(channel, log)
                } catch (e) {
                    console.log("Ошибка отправки сообщения:" + e);
                }

            });
    } else {
        try {
            sendMessage(channel, log);
        } catch (e) {
            console.log("Ошибка отправки сообщения:" + e);
        }
    }
}

function endTreatLog() {
    logBeingTreated = false;
    treatLogs();
}

function sendMessage(channel, log) {
    let forAdmin = false;
    if (log.data.includes("@admin")) forAdmin = true;
    if (log.data.includes('')) {
        endTreatLog();
    } else if (!forAdmin) {
        let embed = new Discord.MessageEmbed({
            fields: [{
                name: log.hour + ' - ' + log.username,
                value: log.data
            }],
        });
        embed.setColor(log.type);
        channel.send(embed).then(endTreatLog);
    } else {
        let embed = new Discord.MessageEmbed({
            fields: [{
                name: log.hour + ' - ' + log.username,
                value: log.data
            }],
        });
        embed.setColor(log.type);
        channel.send('<@&661439411384221716>');
        channel.send(embed).then(endTreatLog);
    }
}

function editMessage(message, log) {
    if (log.data.includes('STOPLogsKolobok')) {
        endTreatLog();
    } else {
        let lastEmbed = message.embeds[0];
        lastEmbed = new Discord.MessageEmbed({
            fields: lastEmbed.fields.concat([{
                name: log.hour + ' - ' + log.username,
                value: log.data
            }])
        });

        lastEmbed.setColor(log.type);
        // lastEmbed.setFooter("Онлайн: "+misc.online);
        // lastEmbed.setAuthor("Имя", "https://i.imgur.com/lm8s41J.png") //Имя и аватарка в заголовке блока
        message.edit(lastEmbed).then(endTreatLog);
    }
}
