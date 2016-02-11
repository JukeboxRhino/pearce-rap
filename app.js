var colors = require('colors');
var jsftp = require('jsftp');
var exec = require('child_process').exec;
var fs = require('fs');
var historyFile = 'history.json';
var msregex = new RegExp(/time[=<](\d+)ms/);
var dnsregex = new RegExp(/Ping request could not find host (.*)\. Please check the name and try again\./);
//NOTE: This only works on Windows!
var pingInterval = 15 * 1000;
var historyInterval = 15 * 1000;
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
	var timestamp = new Date().toLocaleString();
	var string = timestamp + '\r\n';
	var hosts = Object.keys(GHistory);
	for(i = 0; i < hosts.length; i++){
		var host = hosts[i];
		var d = new Date();
		var tag = '['+d.toLocaleTimeString()+'] ';
		process.stdout.write(tag+'Parsing data for ' + host+'...');
		var total = GHistory[host].length;
		var success = 0;
		var totalms = 0;
		var timeout = 0;
		var unknown = 0;
		var total24 = 0;
		var success24 = 0;
		var totalms24 = 0;
		var timeout24 = 0;
		var unknown24 = 0;
		var lastunknown = '';
		var lastunknownts = '';
		for(j = 0; j < total; j++){
			if(GHistory[host][j].ts >= d.getTime() - (24 * 60 * 60 * 1000)){
					total24++;
				}
			if(GHistory[host][j].success){
				success++;
				totalms += parseInt(GHistory[host][j].ms);
				if(GHistory[host][j].ts >= d.getTime() - (24 * 60 * 60 * 1000)){
					success24++;
					totalms24 += parseInt(GHistory[host][j].ms);
				}
			} else {
				if(GHistory[host][j].timeout){
					timeout++;
				} else {
					unknown++;
					lastunknown = GHistory[host][j].error;
					lastunknownts = GHistory[host][j].ts;
				}
				if(GHistory[host][j].ts >= d.getTime() - (24 * 60 * 60 * 1000)){
					GHistory[host][j].timeout ? timeout24++ : unknown24++;
				}
			}
		}
		var uptime = Math.round(success/total*10000)/100+'%';
		var uptime24 = Math.round(success24/total24*10000)/100+'%';
		var average = Math.round(totalms/success*100)/100+'ms';
		var average24 = Math.round(totalms24/success24*100)/100+'ms';
		string += '['+host+']\r\n\
		Uptime:\t\t\t\t' + uptime + '\t(24h):' + uptime24 + '\r\n\
		Average response time:\t\t' + average + '\t(24h):' + average24 + '\r\n\
		Total echo-requests sent:\t' + total + '\t(24h):' + total24 + '\r\n\
		Total successful echo-replies:\t' + success + '\t(24h):' + success24 + '\r\n\
		Total echo-requests timed out:\t' + timeout + '\t(24h):' + timeout24 + '\r\n\
		Total unknown errors:\t\t' + unknown + '\t(24h):' + unknown24 + '\r\n';
		if(lastunknown){
			var ts = new Date(lastunknownts).toLocaleString();
			string += 'Last unknown error: ' + lastunknown + 'at ' + ts + '\r\n';
		}
		process.stdout.write('Done\r\n');
	}
	var buffer = new Buffer(string);
	var ftp = new jsftp({
		host: printer
	});
	ftp.on('error', function(err){
		error('FTP Error')
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
	var ts = new Date().getTime();//Timestamp
	exec('ping ' + host + ' -n 1', function(err, stdout, stderr){
		line3 = stdout.toString().split('\r\n')[2];
		stdout = stdout.toString();
		if(line3 == 'Request timed out.'){
			callback(1, null, null, host, ts);
		} else if(msregex.exec(line3)){
			var ms = msregex.exec(line3)[1];
			callback(null, null, ms, host, ts);
		} else {
			//Unknown ping response
			callback(2, stdout, null, host, ts);
		}
	});
}

function startMonitoring(host){
	if(!GHistory[host]){
		GHistory[host] = [];
	}
	function resultHandler(err, error, result, host, ts){
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
				if(dnsregex.exec(error)){
					obj.error = '(DNS Error)';
				} else {
					obj.error = error;
				}
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

function deleteRecords(host, callback){
	if(GHistory[host]){
		delete GHistory[host];
		callback(true);
	} else {
		callback(false);
	}
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
		if(process.argv[2] == '-d'){
			var deleted = 0;
			for(i = 3; i < process.argv.length; i++){
				deleteRecords(process.argv[i], function(success){
					if(success) deleted++;
				});
			}
			saveHistory(GHistory, function(err){
				out(('Deleted ' + deleted + ' records, exiting...').green);
				process.exit();
			});
		} else if(process.argv[2] == '-p'){
			printToFTP();
			setTimeout(process.exit, 5000);
		} else {
			for(i = 2; i < process.argv.length; i++){
				startMonitoring(process.argv[i]);
			}
		}
	}
	setInterval(parseHistory, historyInterval);
});