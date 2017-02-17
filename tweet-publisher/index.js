var sentiment = require('sentiment');
var Twit = require('twit');
var Pubnub = require('pubnub');
var fs = require('fs');
var nconf = require('nconf');

nconf.file({ file: 'config.json' }).env();

TweetPublisher = { };

var twitter = TweetPublisher.twitter = new Twit({
	consumer_key: nconf.get('8hBtQHHYCG32jvNDTc9VZpCVj'),
	consumer_secret: nconf.get('8tE3W54IexnVFP8CqJi2M119sjy1z7ceMqhCvwOcYJeTIPe3tl'),
	access_token: nconf.get('318514505-6q105MKOSQFxoWWRV8JyzLWQBehq0Wq4y8HQLXG4'),
	access_token_secret: nconf.get('WOiyS4VoPRW7lb1R7iHk8Z3uE9Zciy3SjE2YA0PeZ4scC')
});

var pubnub = TweetPublisher.pubnub = Pubnub({
	publish_key: nconf.get('pub-c-446f3359-f8f8-46c9-8fbc-c67e1e6d43e9'),
	subscribe_key: nconf.get('sub-c-0c949b90-f546-11e6-bb94-0619f8945a4f')
});

var stream, cachedTweet, publishInterval;

/**
 * Starts Twitter stream and publish interval
 */
TweetPublisher.start = function () {

	var response = { };

	// If the stream does not exist create it
	if (!stream) {

		// Connect to stream and filter by a geofence that is the size of the Earth
		stream = twitter.stream('statuses/filter', { locations: '-180,-90,180,90' });

		// When Tweet is received only process it if it has geo data
		stream.on('tweet', function (tweet) {	
			// calculate sentiment with "sentiment" module
			tweet.sentiment = sentiment(tweet.text);

			// save the Tweet so that the very latest Tweet is available and can be published
			cachedTweet = tweet
		});

		response.message = 'Stream created and started.'
	}
	// If the stream exists start it
	else {
		stream.start();
		response.message = 'Stream already exists and started.'
	}
	
	// Clear publish interval just be sure they don't stack up (probably not necessary)
	if (publishInterval) {
		clearInterval(publishInterval);
	}

	// Only publish a Tweet every 100 millseconds so that the browser view is not overloaded
	// This will provide a predictable and consistent flow of real-time Tweets
	publishInterval = setInterval(function () {
		if (cachedTweet) {
			publishTweet(cachedTweet);
		}
	}, 100); // Adjust the interval to increase or decrease the rate at which Tweets sent to the clients

	return response;
}

/**
 * Stops the stream and publish interval
 **/
TweetPublisher.stop = function () {

	var response = { };

	if (stream) {
		stream.stop();
		clearInterval(publishInterval);
		response.message = 'Stream stopped.'
	}
	else {
		response.message = 'Stream does not exist.'
	}

	return response;
}

var lastPublishedTweetId;

/**
 * Publishes Tweet object through PubNub to all clients
 **/
function publishTweet (tweet) {

	if (tweet.id == lastPublishedTweetId) {
		return;
	}
	
	lastPublishedTweetId = tweet.id;

	pubnub.publish({
		post: false,
		channel: 'tweet_stream',
		message: tweet,
		callback: function (details) {
			// success
		}
	});
}

module.exports = TweetPublisher;
