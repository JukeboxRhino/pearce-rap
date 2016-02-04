var colors = require('colors');
var exec = require('child_process').exec;
var fs = require('fs');
var historyFile = 'history.json';
var msregex = new RegExp(/time[=<](\d+)ms/);
//NOTE: This only works on Windows!
var pingInterval = 5000;//In milliseconds
var historyInterval = 7000;//In milliseconds
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
	tag = tag.green
	console.log(tag + text);
}

function error(text){
	out(text.red.underline);
}

function ping(host, callback){
	var ts = Date.now();//Timestamp
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
	var linecount = hosts.length;
	out('[STATUS]'.cyan);
	process.stdout.write('╔════════════════╦════════╦═════════╦══════════════╦═════════════╦═════════════╗');
	process.stdout.write('║    Hostname    ║ Uptime ║Avg. Time║Req. Timed Out║Unknown Error║Tracking Time║');
	for(i = 0; i < hosts.length; i++){
		var host = hosts[i];
		var total = GHistory[host].length;
		var since = new Date(GHistory[host][0].ts);
		var diff = Date.now() - since.getTime();
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
		diff = diff / 1000;
		if(diff < 60){
			diff = Math.round(diff*10)/10 + 's';
		} else if(diff/60 < 60){
			diff = Math.round(diff/60*10)/10 + 'm';
		} else if(diff/360 < 24){
			diff = Math.round(diff/360*10)/10 + 'h';
		} else {
			diff = Math.round(diff/(360*24)*10)/10 + 'd';
		}
		var hpad = 16 - host.length;
		for(i = 0; i < hpad; i++){host += ' '}
		var uptime = (Math.round(success/total*10000)/100).toString() + '%';
		var upad = 8 - uptime.length;
		for(i = 0; i < upad; i++){uptime += ' '}
		var average = Math.round(totalms/success*100)/100 + 'ms';
		var apad = 9 - average.length;
		for(i = 0; i < apad; i++){average += ' '}
		timeout = timeout.toString();
		var rpad = 14 - timeout.length;
		for(i = 0; i < rpad; i++){timeout += ' '}
		unknown = unknown.toString();
		var ukpad = 13 - unknown.length;
		for(i = 0; i < ukpad; i++){unknown += ' '}
		var tpad = 13 - diff.length;
		for(i = 0; i < tpad; i++){diff += ' '}
		process.stdout.write('║'+host+'║'+uptime+'║'+average+'║'+timeout+'║'+unknown+'║'+diff+'║');
	}
}

function saveHistory(history, callback){
	var data = JSON.stringify(history);
	fs.writeFile(__dirname + '/' + historyFile, data, function(err){
		if(!err){
			out('Saved history');
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
			out('Successfully read history file');
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
});