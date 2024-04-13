const { Bot, GrammyError, HttpError } = require("grammy");
const { Menu } = require("@grammyjs/menu");
const { autoRetry } = require("@grammyjs/auto-retry");
const { CronJob } = require("cron");
const cron = require("cron");


require('dotenv').config();
const constValue = require('./const');

const bot = new Bot(process.env.BOT_TOKEN)

autoRetry({
    maxRetryAttempts: 1, // повторювати запити лише один раз
    maxDelaySeconds: 5, // запит визначається невдалим негайно, якщо доводиться чекати більше 5-ти секунд
});
// Використовуємо плагін.
bot.api.config.use(autoRetry());

let isGroupOpen = true;

// команды
bot.start((ctx) => ctx.reply(bot.status));

bot.command('test', (ctx) => {
    ctx.reply(' privet bot is running 2 ');
})

const setDateTime = function (date, str) {
    var sp = str.split(':');
    date.setHours(parseInt(sp[0], 10));
    date.setMinutes(parseInt(sp[1], 10));
    date.setSeconds(parseInt(sp[2], 10));
    return date;
}



const generateResponceForUser = function (chatId, firstName, isGroupOpen) {
    if ((chatId === constValue.ID_GROUP_NEDVIJKA && !isGroupOpen) || constValue.isTest) {
        if (firstName.length != 0) {
            return constValue.msgWhenGroupCloseForRealEstate.replace("УЧАСТНИК (ЦА)", firstName);
        } else {
            return constValue.msgWhenGroupCloseForRealEstate;
        }

    }
}

const generateForGroupSleep = function (chatId) {

    if (chatId == constValue.ID_GROUP_NEDVIJKA)
        return constValue.msgWhenGroupSleepNedvijka;
    else if (chatId == constValue.ID_GROUP_AVTO)
        return constValue.msgWhenGroupSleepAvto;
    else
        return "generateForGroupSleep NULL ";

}

const isGroupOpenFunc = function (enterDate) {
    let currentMsgDate = enterDate;

    var curr = currentMsgDate.getTime()
        , start = setDateTime(new Date(currentMsgDate), '07:00:00')
        , end = setDateTime(new Date(currentMsgDate), '21:00:00');

    return (curr >= start.getTime() && curr < end.getTime());

}



bot.on(':new_chat_members', (ctx) => {
    console.log(ctx.message);
    console.log(" addddddddddd users ");
    ctx.message.new_chat_members.forEach((element) =>

        bot.api.sendMessage(6942489298,
            " user " +
            (ctx.message.from.username == undefined ? ctx.message.from.first_name : ctx.message.from.username) +
            " id = " + ctx.message.from.id +
            " add_user " +
            (element.username == undefined ? element.first_name : element.username) +
            " id = " + element.id +
            " at " + new Date(ctx.message.date * 1000).toDateString() +
            " in group " + ctx.message.chat.title
        )
    )
    return
}
);




bot.on('message', async (ctx) => {
    console.log(ctx.message);




    isGroupOpen = isGroupOpenFunc(new Date(ctx.message.date * 1000));
    const subscribe = bot.api.getChatMember(ctx.chat.id, ctx.from.id);
    userStatus = (await subscribe).status;
    console.log(` Статус пользователя ( ${ctx.from.username} )= ${userStatus} , isGroupOpen = ${isGroupOpen} `);

    isAdmin = (userStatus.toUpperCase() == "CREATOR" || userStatus.toUpperCase() == "ADMINISTRATOR")


    // если группа закрыта удалить сообщение из группы и сообщить отправителю о нарушении правил группы !!!! 
    if (!isGroupOpen) {
        console.log(` ctx.chat.id = ${ctx.chat.id}    ctx.message_id = ${ctx.message.message_id}`);
        try {
            if (userStatus.toUpperCase() !== "CREATOR" && userStatus.toUpperCase() !== "ADMINISTRATOR") {

                let temp = await ctx.reply("З 21.00 до 07.00 повідовлення в группу публікуються через Адміністратора", {
                    reply_parameters: { message_id: ctx.msg.message_id },
                });
                console.log(` id message from temp = ${temp.message_id}`);
                setTimeout(() => {
                    ctx.api.deleteMessage(ctx.chat.id, temp.message_id);
                    ctx.api.deleteMessage(ctx.chat.id, temp.message_thread_id);
                }, 5000);
                return;
            }
        } catch (error) {
            console.error('Ошибка при удалении сообщения:', error.description);
        }

    }

    const msg = ctx.message.text ?? ctx.message.caption ?? "";
    // проверка тематическая для недвижки
    if (msg.length > 0 && !isAdmin && ctx.chat.id == constValue.ID_GROUP_NEDVIJKA) {
        let regexp = (/сниму|зніму|шукаю|ищу|куплю|голые/);
        if (msg.toLowerCase().search(regexp) >= 0) {
            let replyMessage = await ctx.reply(`
            Публікація дозволена тільки по продажу або сдачі нерухомості !!! 
            За розміщенням реклами іншого характеру звертайтесь до адміністратора https://t.me/UramXpert `, {
                reply_parameters: { message_id: ctx.msg.message_id, parse_mode: "HTML" }
            });
            setTimeout(() => {
                ctx.api.deleteMessage(ctx.chat.id, replyMessage.message_id);
                ctx.api.deleteMessage(ctx.chat.id, replyMessage.message_thread_id);
            }, 5000);
            return;


        }
    }
    // проверка тематическая для авто 
    if (msg.length > 0 && !isAdmin && ctx.chat.id == constValue.ID_GROUP_AVTO) {
        let regexp = (/куплю|ищу|шукаю|голые/);
        if (msg.toLowerCase().search(regexp) >= 0) {
            let replyMessage = await ctx.reply(`
            Публікувати можна тільки авто на продаж!!! 
            За розміщенням реклами іншого характеру звертайтесь до адміністратора https://t.me/UramXpert `, {
                reply_parameters: { message_id: ctx.msg.message_id, parse_mode: "HTML" }
            });
            setTimeout(() => {
                ctx.api.deleteMessage(ctx.chat.id, replyMessage.message_id);
                ctx.api.deleteMessage(ctx.chat.id, replyMessage.message_thread_id);
            }, 5000);
            return;


        }
    }




})


//cron //- выполнять по расписанию когда группа засыпает 
const job = new CronJob(
    '0 59 20 * * *', // cronTime
    function () {
        bot.api.sendMessage(constValue.ID_GROUP_NEDVIJKA,
            generateForGroupSleep(constValue.ID_GROUP_NEDVIJKA),
            { parse_mode: "HTML" });

        bot.api.sendMessage(constValue.ID_GROUP_AVTO,
            generateForGroupSleep(constValue.ID_GROUP_AVTO),
            { parse_mode: "HTML" });
    }

    , // onTick
    null, // onComplete
    true, // start
    'Europe/Kyiv' // timeZone
);

//cron //- выполнять по расписанию когда группа просыпается 
const jobWakeup = new CronJob(
    '0 59 06 * * *', // cronTime
    function () {
        bot.api.sendMessage(constValue.ID_GROUP_NEDVIJKA,
            constValue.msgWhenGroupWakeUpNedvijka,
            { parse_mode: "HTML" });

        bot.api.sendMessage(constValue.ID_GROUP_AVTO,
            constValue.msgWhenGroupWakeUpAvto,
            { parse_mode: "HTML" });
    }

    , // onTick
    null, // onComplete
    true, // start
    'Europe/Kyiv' // timeZone
);

bot.catch((err) => {
    const ctx = err.ctx;
    console.log(`Error while hundling update ${ctx.update_id}`);
    const e = err.error;

    if (e instanceof GrammyError) {
        console.log("error in request:", e.description);
    } else if (e instanceof HttpError) {
        console.log("Could not contact Telegram", e);
    } else {
        console.log("unknown error ", e);
    }
}
);

bot.start();

// Enable graceful stop

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))