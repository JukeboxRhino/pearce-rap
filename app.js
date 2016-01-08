var net_ping = require('net-ping');
var net = require('net');
var dns = require('dns');
var fs = require('fs');
var history = {};
var historyChanged = false;
/**Config**/
var showTime = false;
var hosts = ['google.com', 'yahoo.com', 'mvctc.com', '127.0.0.1'];
var historyFile = 'history.json';
var pingIntervalMs = 5000;
var historySaveIntervalMs = 30000;
var historyDisplayMs = 5000;
/**********/
function writeHistory(history){
	fs.writeFile(historyFile, history, function(err){
		if(!err){
			
		} else {
			console.log('Error writing history file');
		}
	});
}
function readHistory(callback){
	fs.readFile(historyFile, function(err, data){
		if(!err && data){
			callback(JSON.parse(data));
		} else {
			callback(false);
			console.dir(err);
		}
	});
}
function saveHistory(){
	if(historyChanged){
		writeHistory(JSON.stringify(history));
		historyChanged = false;
	}
}
function ping(host, callback){
	if(net.isIPv4(host)){
		echo(host, callback);
	} else {
		//Resolve DNS
		dns.lookup(host, 4, function(err, addr, family){
			if(!err){
				host = addr;
				echo(host, callback);
			} else {
				var result = {
					success: false,
					error: err,
					type: 'DNS Lookup Error'
				};
				callback(result);
				return;
			}
		});
	}
}
function echo(host, callback){
	var session = net_ping.createSession();
	session.on('close', function(){
		console.log('Socket closed');
	});
	session.on('error', function(err){
		var result = {
			success: false,
			error: err,
			type: 'Session error'
		};
		callback(result);
	});
	var sent = new Date();
	var rcvd;
	session.pingHost(host, function(err, target){
		if(!err){
			rcvd = new Date();
			var result = {
				success: true,
				time: rcvd.getTime() - sent.getTime()
			};
			callback(result);
		} else {
			var result = {
				success: false,
				error: err,
				type: 'Unsuccessful ping'
			}
			callback(result);
		}
	});
}
function parseHistory(){
	for(i = 0; i < hosts.length; i++){
		var countTotal = 0;
		var countSuccessful = 0;
		var timeTotal = 0;
		for(j = 0; j < history[hosts[i]].length; j++){
			if(history[hosts[i]][j].success){
				countTotal++;
				countSuccessful++;
				timeTotal += history[hosts[i]][j].time;
			} else {
				countTotal++;
			}
		}
		var uptimePercent = Math.round(countSuccessful / countTotal * 10000) / 100 + '%';
		var averageTime = Math.round(timeTotal / countSuccessful * 100) / 100;
		if(showTime){
			console.log(hosts[i] + ' has ' + uptimePercent + ' uptime with an average round-trip time of ' + averageTime + 'ms');
		} else {
			console.log(hosts[i] + ' has ' + uptimePercent + ' uptime');
		}
	}
	for(i = 0; i < process.stdout.rows - hosts.length - 1; i++){
		console.log('');
	}
}
//On startup, try to load history
readHistory(function(loadedHistory){
	if(loadedHistory){
		history = loadedHistory;
		console.log('Successfully loaded history');
	} else {
		console.log('Could not load history file');
	}
});
function startMonitoring(host){
	if(!history[host]){
		history[host] = [];
	}
	setInterval(ping, pingIntervalMs, host, function(result){
		history[host].push(result);
		historyChanged = true;
	});
}
setInterval(saveHistory, historySaveIntervalMs);
setInterval(parseHistory, historyDisplayMs);
for(i = 0; i < hosts.length; i++){
	console.log('Started monitoring ' + hosts[i]);
	startMonitoring(hosts[i]);
}