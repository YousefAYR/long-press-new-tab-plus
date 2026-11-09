function parseExceptionLine(line){
	var text = line.trim();
	if(!text)return {type:"blank"};
	if(text.charAt(0) === "#")return {type:"comment"};
	var source = null,flags = "";
	var slashed = /^\/(.+)\/([a-z]*)$/.exec(text);
	if(/^re:/i.test(text)){
		source = text.slice(3).trim();
		// JavaScript has no (?i) at the start, so it becomes the flags.
		var inline = /^\(\?([a-z]+)\)/.exec(source);
		if(inline){
			source = source.slice(inline[0].length);
			flags = inline[1];
		}
	}else if(slashed){
		source = slashed[1];
		flags = slashed[2];
	}
	flags = flags.replace(/[gy]/g,"");
	if(source !== null){
		try{
			return {type:"regex",re:new RegExp(source,flags),full:true};
		}catch(e){
			return {type:"error",error:e.message};
		}
	}
	var exact = text.length > 1 && text.charAt(0) === '"' && text.slice(-1) === '"';
	if(exact)text = text.slice(1,-1).trim();
	var body = text.replace(/[.+?^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*");
	var end = exact ? "/?(?=[?#]|$)" : /[\/*]$/.test(text) ? "" : "(?=[/:?#]|$)";
	if(/^[a-z*][a-z0-9+.*-]*:\/\//i.test(text)){
		return {type:"glob",re:new RegExp("^" + body + end,"i"),full:true};
	}
	return {type:"glob",re:new RegExp("^([^/]*\\.)?" + body + end,"i"),full:false};
}
function compileExceptions(lines){
	var rules = [];
	for(var i = 0; i < lines.length; i++){
		var rule = parseExceptionLine(lines[i]);
		if(rule.re)rules.push({line:i + 1,re:rule.re,full:rule.full});
	}
	return rules;
}
function matchException(url,rules){
	var noscheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i,"");
	for(var i = 0; i < rules.length; i++){
		if(rules[i].re.test(rules[i].full ? url : noscheme))return rules[i].line;
	}
	return 0;
}
function exceptionLinesFrom(opt){
	if(Array.isArray(opt.exceptions))return opt.exceptions;
	var old = Array.isArray(opt.excpetoptionarray) ? opt.excpetoptionarray : [];
	return old.filter(function(item){return item && item.url}).map(function(item){return item.url});
}
