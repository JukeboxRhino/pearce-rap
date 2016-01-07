var net_ping = require('net-ping');
var net = require('net');
var dns = require('dns');
/**Config**/
var host = 'google.com';
/**********/
function ping(host, callback){
	if(net.isIPv4(host)){
		echo(host, callback);
	} else {
		//Resolve DNS
		console.log('Performing DNS lookup for ' + host);
		dns.lookup(host, 4, function(err, addr, family){
			if(!err){
				console.log(host + ' resolved to ' + addr);
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
	console.log(percentUptime + ' uptime with an average round-trip time of ' + averageTime + 'ms');
}
var history = [];
setInterval(ping, 10000, host, function(result){
	history.push(result);
	parseHistory();
});