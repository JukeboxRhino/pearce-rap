var ping = require('net-ping');
var net = require('net');
var dns = require('dns');
/**Config**/
var host = 'google.com';
/**********/
//Check if host is IP or domain name
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
			console.log('ERROR: DNS could not resolve ' + host);
		}
	});
}
function echo(host){
	var session = ping.createSession();
	session.on('close', function(){
		console.log('Socket closed');
	});
	session.on('error', function(err){
		console.log('ERROR');
		console.dir(err);
	});
	session.pingHost(host, function(err, target, sent, rcvd){
		if(!err){
			console.log(target + ' responded in ' + (rcvd.getTime() - sent.getTime()) + 'ms');
		} else {
			console.log('ERROR');
			console.dir(err);
		}
	});
}