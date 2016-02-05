var colors = require('colors');
var jsftp = require('jsftp');
var exec = require('child_process').exec;
var fs = require('fs');
var historyFile = 'history.json';
var msregex = new RegExp(/time[=<](\d+)ms/);
//NOTE: This only works on Windows!
var pingInterval = 5000;//In milliseconds
var historyInterval = 7000;//In milliseconds
var printInterval = 24 * 60 * 60 * 1000;//In milliseconds
var printer = '192.5.5.5';
var GHistory;
/*History Structure
{GHistory}----
             |
		   [Host]
		     |
	      {Result}
		     |
ts(number) - success(Boolean) - ms(number/null) - timeOut(Boolean)
*/

function out(text){
	var d = new Date();
	var tag = '['+d.toLocaleTimeString()+'] ';
	console.log(tag + text);
}

function error(text){
	out(text.red.underline);
}

function printToFTP(){
	out('Printing results...');
	var string = '';
	var hosts = Object.keys(GHistory);
	for(i = 0; i < hosts.length; i++){
		var host = hosts[i];
		var total = GHistory[host].length;
		var success = 0;
		var totalms = 0;
		var timeout = 0;
		var unknown = 0;
		for(j = 0; j < total; j++){
			if(GHistory[host][j].success){
				success++;
				totalms += parseInt(GHistory[host][j].ms);
			} else {
				GHistory[host][j].timeout ? timeout++ : unknown++;
			}
		}
		var uptime = Math.round(success/total*10000)/100+'%';
		var average = Math.round(totalms/success*100)/100+'ms';
		var timestamp = new Date().toLocaleString();
		string += '['+host+'] (' + timestamp + ')\r\n\
		\tUptime:\t\t\t\t' + uptime + '\r\n\
		\tAverage response time:\t\t' + average + '\r\n\
		\tTotal echo-requests sent:\t' + total + '\r\n\
		\tTotal successful echo-replies:\t' + success + '\r\n\
		\tTotal echo-requests timed out:\t' + timeout + '\r\n\
		\tTotal unknown errors:\t\t' + unknown + '\r\n';
	}
	var buffer = new Buffer(string);
	var ftp = new jsftp({
		host: printer
	});
	ftp.put(buffer, '/prt0/ftpresults.txt', function(err) {
		if(!err){
			out('FTP PUT successful'.green);
		}
		ftp.raw.quit(function(err, data) {
			out('FTP QUIT');
		});
	});
}

function ping(host, callback){
	var ts = new Date();//Timestamp
	exec('ping ' + host + ' -n 1', function(err, stdout, stderr){
		stdout = stdout.toString().split('\r\n');
		if(stdout[2] == 'Request timed out.'){
			callback(1, null, host, ts);
		} else if(msregex.exec(stdout[2])){
			var ms = msregex.exec(stdout[2])[1];
			callback(null, ms, host, ts);
		} else {
			//Unknown ping response
			callback(2, null, host, ts);
		}
	});
}

function startMonitoring(host){
	if(!GHistory[host]){
		GHistory[host] = [];
	}
	function resultHandler(err, result, host, ts){
		var obj = {};
		if(!err){
			obj.ts = ts;
			obj.success = true;
			obj.ms = result;
			obj.timeout = false;
		} else {
			obj.ts = ts;
			obj.success = false;
			if(err == 1){
				obj.timeout = true;
			} else {
				obj.timeout = false;
			}
		}
		GHistory[host].push(obj);
	}
	ping(host, resultHandler);
	setInterval(ping, pingInterval, host, resultHandler);
}

function parseHistory(){
	var hosts = Object.keys(GHistory);
	out('[STATUS]'.cyan)
	for(i = 0; i < hosts.length; i++){
		var host = hosts[i];
		var total = GHistory[host].length;
		var success = 0;
		var totalms = 0;
		var timeout = 0;
		var unknown = 0;
		for(j = 0; j < total; j++){
			if(GHistory[host][j].success){
				success++;
				totalms += parseInt(GHistory[host][j].ms);
			} else {
				GHistory[host][j].timeout ? timeout++ : unknown++;
			}
		}
		out(host.gray+' has '+Math.round(success/total*10000)/100+'% uptime ('+success+'/'+total+') Avg. time: ' + Math.round(totalms/success*100)/100 + 'ms');
	}
}

function saveHistory(history, callback){
	var data = JSON.stringify(history);
	fs.writeFile(__dirname + '/' + historyFile, data, function(err){
		if(!err){
			out('Saved history'.green);
			if(callback){
				callback(null);
			}
		} else {
			error('Error saving history');
			if(callback){
				callback(err);
			}
		}
	});
}

function readHistory(callback){
	fs.readFile(__dirname + '/' + historyFile, function(err, data){
		if(!err){
			callback(JSON.parse(data));
			out('Successfully read history file'.green);
		} else {
			error('Error reading history file, writing new history file');
			saveHistory({});//Save empty object
			callback({});//Return empty object
		}
	});
}

process.on('SIGINT', function(){
	out('Gracefully exiting...');
	saveHistory(GHistory, function(err){
		process.exit();
	});
});

readHistory(function(history){
	GHistory = history;
	if(process.argv.length < 3){
		error('Please enter one or more hosts as arguments');
		process.exit();
	} else {
		for(i = 2; i < process.argv.length; i++){
			startMonitoring(process.argv[i]);
		}
	}
	setInterval(parseHistory, historyInterval);
	setInterval(printToFTP, printInterval);
});