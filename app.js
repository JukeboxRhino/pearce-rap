var net_ping = require('net-ping');
var net = require('net');
var dns = require('dns');
var fs = require('fs');
var history = [];
var historyChanged = false;
/**Config**/
var host = 'google.com';
var historyFile = 'history.json';
var pingIntervalMs = 15000;
var historySaveIntervalMs = 60000;
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
	session.pingHost(host, function(err, target, sent, rcvd){
		if(!err){
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
	var countTotal = 0;
	var countSuccess = 0;
	var timeTotal = 0;
	for(i = 0; i < history.length; i++){
		if(history[i].success){
			countTotal++;
			countSuccess++;
			timeTotal += history[i].time;
		} else {
			countTotal++;
		}
	}
	var percentUptime = Math.round(countSuccess / countTotal * 10000) / 100 + '%';
	var averageTime = Math.round(timeTotal / countSuccess * 100) / 100;
	console.log('--- ' + percentUptime + ' uptime with an average round-trip time of ' + averageTime + 'ms');
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
setInterval(ping, pingIntervalMs, host, function(result){
	history.push(result);
	historyChanged = true;
	parseHistory();
});
setInterval(saveHistory, historySaveIntervalMs);