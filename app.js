var ping = require('net-ping');
var net = require('net');
var dns = require('dns');
/**Config**/
var host = 'google.com';
/**********/
function echo(host, callback){
	if(net.isIPv4(host)){
		echo(host);
	} else {
		//Resolve DNS
		console.log('Performing DNS lookup for ' + host);
		dns.lookup(host, 4, function(err, addr, family){
			if(!err){
				console.log(host + ' resolved to ' + addr);
				host = addr;
				echo(host);
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
	var session = ping.createSession();
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
				success: false;
				error: err,
				type: 'Unsuccessful ping'
			}
			callback(result);
		}
	});
}
echo(host, function(result){
	console.dir(result);
});