var exec = require('child_process').exec;
var msregex = new RegExp(/time[=<](\d+)ms/);
//NOTE: This only works on Windows!

function ping(host, bytes, callback){
	if(typeof bytes == 'function'){
		callback = bytes;
		bytes = 32;
	} else if(typeof bytes == 'number' && bytes >= 0 && bytes <= 65500){
		
	} else if(!bytes){
		var bytes = 32;
	}
	exec('ping ' + host + ' -n 1 -l ' + bytes, function(err, stdout, stderr){
		stdout = stdout.toString().split('\r\n');
		if(stdout[2] == 'Request timed out.'){
			callback(1);
		} else if(msregex.exec(stdout[2])){
			var ms = msregex.exec(stdout[2])[1];
			callback(null, ms);
		} else {
			//Unknown ping response
			callback(2);
		}
	});
}