var vogels = require('vogels');
var Joi = require('joi');
vogels.AWS.config.loadFromPath('./config.json');

var Chat = vogels.define('chat', {
    hashKey: 'from',
    rangeKey: 'to',

    schema: {
        from: Joi.string(),
        to: Joi.string(),
        messages: Joi.array().items(Joi.object().keys({
            timestamp: Joi.date().default(Date.now(), 'current date'),
            content: Joi.string()
        }).optional())
    }
});

//helper method to initiate chat
var initiateChat = function(user1, user2, callback) {
    var item1 = {
        from: user1,
        to: user2,
        messages: []
    };
    var item2 = {
        from: user2,
        to: user1,
        messages: []
    };
    Chat.create([item1, item2], function(err, data) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, "successfully initiated chat between: " + user1 + " and " + user2);
        }
    });
};

//sends a message by adding to db
var sendMessage = function(from, to, content, callback) {
    var params = {};
    params.UpdateExpression = 'SET messages = list_append(if_not_exists(messages, :empty_list), :message)';

    params.ExpressionAttributeValues = {
        ':empty_list': [],
        ':message': [{
            timestamp: Date.now(),
            content: content
        }]
    };

    Chat.update({
        from: from,
        to: to
    }, params, function(err, post) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, 'successfully posted messgae');
        }
    });
};

//if messages exist, loads them.  Otherwise instantiates a ne chat session.
var getMessages = function(user1, user2, callback) {
    var chatKey1 = {
        from: user1,
        to: user2
    };
    var chatKey2 = {
        from: user2,
        to: user1
    };

    Chat.getItems([chatKey1, chatKey2], function(err, chats) {
        if (err) {
            callback(err, null);
        } else if (chats === undefined || chats.length == 0) {
            initiateChat(user1, user2, function(err, response) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, response);
                }
            });
        } else {
            var data1 = chats[0].attrs;
            var data2 = chats[1].attrs;
            var results = [];
            if (data1.messages) {
                data1.messages.forEach(function(element) {
                    results.push({
                        from: data1.from,
                        time: element.timestamp,
                        message: element.content
                    });
                });
            }
            if (data2.messages) {
                data2.messages.forEach(function(element) {
                    results.push({
                        from: data2.from,
                        time: element.timestamp,
                        message: element.content
                    });
                });
            }
            results = results.sort(function(a, b) {
                return a.time - b.time
            });
            callback(null, results);
        }
    });
}

var createTables = function(callback) {
    vogels.createTables(function(err) {
        if (err) {
            callback('Error creating tables: ' + err, null);
        } else {
            callback(null, 'Tables has been created');
        }
    });
};

var database = {
    get_messages: getMessages,
    send_message: sendMessage
}

module.exports = database;

// createTables(function(err,data){});
// getMessages('u3', 'u2', function(err, data) {
//     if (err) {
//         console.log(err);
//     }
//     console.log(data);
// });

// sendMessage('u3', 'u2', 'hi', function(err, data) {
//     console.log(data);
//     sendMessage('u2', 'u3', 'hello!', function(err, data) {
//         console.log(data);
//         sendMessage('u3', 'u2', 'bye', function(err, data) {
//             console.log(data);
//             getMessages('u2', 'u3', function(err, data) {
//                 console.log(data);
//             })
//         })
//     })
// })