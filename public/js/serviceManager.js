"use strict";

var pushManager;
window.pushInst = null;
(function(window) {
	pushManager = function(script) {
		if (!(this instanceof pushManager)) {
			return new pushManager(script)
		}

		this.state = 0;
		this.enabled = false
		this.onLoad = null;
		this.onSubscribe = null;
		this.onUnsubscribe = null;

		var that = this;

		if ('serviceWorker' in navigator) {
			this.state = 1;
			navigator.serviceWorker.register(script || './service-worker.js').then(function() {that.initializeState()});
		} else {
			console.log('Service workers aren\'t supported in this browser.');
		}
		
	}

	pushManager.API_KEY = 'AIzaSyDXd3IVhR0fRLPZPr6BQAXg7Pup8cUD_GY'; //Static Var


	pushManager.prototype.sendSubscriptionToServer = function(subscription) {
		// TODO: Send the subscription.subscriptionId and 
		// subscription.endpoint to your server and save 
		// it to send a push message at a later date
		//console.log('TODO: Implement sendSubscriptionToServer()');
		this.showCurlCommand(subscription)
	}

	pushManager.prototype.showCurlCommand = function(subscription) {
		// The curl command to trigger a push message straight from GCM
		var subscriptionId = subscription.subscriptionId;
		var endpoint = subscription.endpoint;
		if (subscriptionId && endpoint.indexOf(subscriptionId) >= 0) {
			endpoint = endpoint.split("/"+subscriptionId)[0]
		}
		var curlCommand = 'curl --header "Authorization: key=' + pushManager.API_KEY +
			'" --header Content-Type:"application/json" ' + endpoint + 
			' -d "{\\"registration_ids\\":[\\"' + subscriptionId + '\\"]}"';

		this.curl = curlCommand
	}

	pushManager.prototype.unsubscribe = function() {
		var that = this;
		navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
			// To unsubscribe from push messaging, you need get the
			// subcription object, which you can call unsubscribe() on.
			serviceWorkerRegistration.pushManager.getSubscription().then(
				function(pushSubscription) {
					// Check we have a subscription to unsubscribe
					if (!pushSubscription) {
						// No subscription object, so set the state
						// to allow the user to subscribe to push
						that.enabled = false;
						if (that.onUnsubscribe) that.onUnsubscribe()
						return;
					}
					var subscriptionId = pushSubscription.subscriptionId;
					// TODO: Make a request to your server to remove
					// the subscriptionId from your data store so you 
					// don't attempt to send them push messages anymore

					// We have a subcription, so call unsubscribe on it
					pushSubscription.unsubscribe().then(function(successful) {
						that.enabled = false;
						if (that.onUnsubscribe) that.onUnsubscribe(successful)
					}).catch(function(e) {
						// We failed to unsubscribe, this can lead to
						// an unusual state, so may be best to remove 
						// the subscription id from your data store and 
						// inform the user that you disabled push
						that.enabled = true;
						if (that.onUnsubscribe) that.onUnsubscribe(e)
						console.log('Unsubscription error: ', e);
					});
				}).catch(function(e) {
					console.log('Error thrown while unsubscribing from push messaging.', e);
				});
		});
	}


	pushManager.prototype.subscribe = function() {
		var that = this;
		navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
			serviceWorkerRegistration.pushManager.subscribe({userVisibleOnly:true})
				.then(function(subscription) {
					// The subscription was successful
					that.enabled = true;
					that.subscription = subscription;
					that.endpoint = subscription.endpoint;
					that.subscriptionId = subscription.subscriptionId;
					if (!that.subscriptionId) {
						that.subscriptionId = that.endpoint.split("/gcm/send/")[1]
					}
					console.log(that.subscriptionId)
					if (that.onSubscribe) that.onSubscribe(null, subscription)

					// TODO: Send the subscription.subscriptionId and 
					// subscription.endpoint to your server
					// and save it to send a push message at a later date
					return that.sendSubscriptionToServer(subscription);
				})
				.catch(function(e) {
					if (Notification.permission === 'denied') {
						// The user denied the notification permission which
						// means we failed to subscribe and the user will need
						// to manually change the notification permission to
						// subscribe to push messages
						if (that.onSubscribe) that.onSubscribe("denied");
						console.log('Permission for Notifications was denied');
					} else {
						// A problem occurred with the subscription, this can
						// often be down to an issue or lack of the gcm_sender_id
						// and / or gcm_user_visible_only
						console.log('Unable to subscribe to push.', e);
						if (that.onSubscribe) that.onSubscribe(e);
					}
				});
		});
	}

	// Once the service worker is registered set the initial state
	pushManager.prototype.initializeState = function() {
		// Are Notifications supported in the service worker?
		if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
			console.log('Notifications aren\'t supported.');
			return;
		}
		this.state = 2;

		// Check the current Notification permission.
		// If its denied, it's a permanent block until the
		// user changes the permission
		if (Notification.permission === 'denied') {
			console.log('The user has blocked notifications.');
			return;
		}
		this.state = 3;
		// Check if push messaging is supported
		if (!('PushManager' in window)) {
			console.log('Push messaging isn\'t supported.');
			return;
		}
		this.state = 4;
		this.available = true;
		var that = this;
		// We need the service worker registration to check for a subscription
		navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
			// Do we already have a push message subscription?
			serviceWorkerRegistration.pushManager.getSubscription()
				.then(function(subscription) {
					// Enable any UI which subscribes / unsubscribes from
					// push messages.
					if (!subscription) {
						// We aren’t subscribed to push, so set UI
						// to allow the user to enable push
						if (that.onLoad) that.onLoad(null, false);
						return;
					}
					that.subscription = subscription;
					that.endpoint = subscription.endpoint;

					that.subscriptionId = subscription.subscriptionId;
					if (!subscription.subscriptionId) {
						that.subscriptionId = that.endpoint.split("/gcm/send/")[1]
					}
					console.log(that.subscriptionId)
					that.state = 5;
					// Keep your server in sync with the latest subscriptionId
					that.sendSubscriptionToServer(subscription);
					
					// Set your UI to show they have subscribed for
					// push messages
					that.enabled = true;
					if (that.onLoad) that.onLoad(null, true);
				})
				.catch(function(err) {
					console.log('Error during getSubscription()', err);
					if (that.onLoad) that.onLoad(err, false);
				});
		});
	}

})(window)
