var optobj = {
	exceptions: [],
	l: "bgrel", m: "none", r: "none",
	du: "none", dd: "none", dl: "none", dr: "none",
	lurl: "", murl: "", rurl: "", duurl: "", ddurl: "", dlurl: "", drurl: "",
	waittime: 350, splitwait: false,
	mdrag: false, dxval: 100, splitdx: false, dragtrigger: "drop",
	blockmenu: false, closemode: "tree", selfparent: false,
	uitheme: "autodarker"
};

var ACTION_KINDS = [
	["none","None",["none"]],
	["rel","Open Link in New Tab",["bgrel","newrel"]],
	["end","New Tab at End",["bg","new"]],
	["window","Open Link in New Window",["windowbg","window"]],
	["private","Open Link in New Private Window",["privatewindowbg","privatewindow"]],
	["crnt","Open in Current Tab (Forced)",["crnt"]],
	["closetab","Close Current Tab",["closetab"]],
	["save","Save Link",["save"]],
	["copy","Copy Link",["copy"]],
	["web","Send Web Service",["webbg","web"]]
];
// Actions that open a tab or window, and so take a container behavior.
var CONTAINER_ACTIONS = ["bgrel","newrel","bg","new","window","windowbg"];
var WEB_ACTIONS = ["web","webbg"];
// What Copy Link copies when the press or drag starts on an image inside the link.
var IMAGE_BEHAVIORS = [["link","Copy the link"],["image","Copy the image"],["imageurl","Copy the image's address"]];
// Other actions just run on an image. Don't run leaves a press or drag that
// starts on an image to Firefox; drags skip images unless set otherwise.
var IMAGE_RUN = ["run","Run the action"];
var IMAGE_SKIP = ["skip","Don't run"];
var ACTION_NOTES = {
	closetab: "Works anywhere except text fields and scrollbars. Moving the mouse cancels it.",
	windowbg: "Opens in foreground from macOS full screen.",
	privatewindow: "Needs Run in Private Windows allowed for this add-on in Add-ons.",
	privatewindowbg: "Needs Run in Private Windows allowed. Opens in foreground from macOS full screen."
};

var BUTTONS = [
	{key:"l",label:"Left button",own:"waitl",image:true},
	{key:"m",label:"Middle button",own:"waitm",image:true},
	{key:"r",label:"Right button",own:"waitr",image:true}
];
var DRAGS = [
	{key:"du",label:"Drag up",own:"dxup",image:true,drag:true},
	{key:"dd",label:"Drag down",own:"dxdown",image:true,drag:true},
	{key:"dl",label:"Drag left",own:"dxleft",image:true,drag:true},
	{key:"dr",label:"Drag right",own:"dxright",image:true,drag:true}
];
var HOLD = {split:"splitwait",all:"waittime",rows:BUTTONS,min:100,max:3000,step:10,unit:"ms",
	label:"Hold time",same:"Same for all"};
var DISTANCE = {split:"splitdx",all:"dxval",rows:DRAGS,min:30,max:500,step:10,unit:"px",
	label:"Drag distance",same:"Same for all"};

var CLOSE_MODES = [
	["tree","Tree order","Tabs are grouped under the tab that opened them. Closing one goes to the next tab in its group, then the previous one, then the tab that opened it, repeating up the tree. Tabs you opened yourself use Next tab."],
	["next","Next tab","Switches to the tab on the right (below, with vertical tabs). If there is none, switches to the tab on the left (above)."],
	["prev","Previously active tab","Switches to the tab you were on before the one you closed. If that tab is gone, uses Next tab."],
	["default","Firefox default","Leaves it to Firefox, which usually returns to the tab the closed one was opened from, otherwise the tab on the right."]
];

var DRAG_TRIGGERS = [
	["drop","When the link is released"],
	["move","While still dragging"]
];

var THEMES = [
	["auto","Match Firefox (Light or Dark)"],["autodarker","Match Firefox (Light or Darker)"],
	["light","Light"],["dark","Dark"],["darker","Darker"]
];
var OLD_THEMES = {grey:"dark",autogrey:"autodarker"};
var PANES = [
	["buttons","Mouse buttons"],["drag","Drag link"],["closing","Closing tabs"],
	["exceptions","Excluded sites"],["about","About"]
];
var GITHUB_URL = "https://github.com/YousefAYR/long-press-new-tab-plus";
var ORIGINAL_URL = "https://addons.mozilla.org/firefox/addon/long_press_new_tab/";

document.addEventListener("DOMContentLoaded",function(){
	chrome.storage.local.get("opt_obj",function(stored){
		var saved = stored && stored.opt_obj;
		if(saved){
			for(var k in saved)optobj[k] = saved[k];
		}
		optobj.exceptions = exceptionLinesFrom(optobj);
		delete optobj.excpetoptionarray;
		initPage();
	});
},false);
function storeOption(){
	chrome.storage.local.set({opt_obj:optobj});
}
function setOpt(key,value){
	optobj[key] = value;
	storeOption();
	refresh();
}

var updaters = [];
function onUpdate(fn){
	updaters.push(fn);
	fn();
}
function refresh(){
	updaters.forEach(function(fn){fn()});
}

function el(tag,cls,text){
	var e = document.createElement(tag);
	if(cls)e.className = cls;
	if(text !== undefined)e.textContent = text;
	return e;
}
function append(parent){
	for(var i = 1; i < arguments.length; i++){
		var child = arguments[i];
		if(typeof child === "string")child = document.createTextNode(child);
		if(child)parent.appendChild(child);
	}
	return parent;
}
function addOption(sel,value,text){
	var opt = el("option",null,text);
	opt.value = value;
	sel.appendChild(opt);
}
function link(href,text){
	var a = el("a",null,text);
	a.href = href;
	a.target = "_blank";
	a.rel = "noopener";
	return a;
}
function store(key,fallback){
	try{
		return localStorage.getItem(key) || fallback;
	}catch(e){
		return fallback;
	}
}
function keep(key,value){
	try{
		localStorage.setItem(key,value);
	}catch(e){}
}
var containerlist = null;
function withContainers(fn){
	if(containerlist)return fn(containerlist);
	if(typeof browser === "undefined" || !browser.contextualIdentities){
		containerlist = [];
		return fn(containerlist);
	}
	browser.contextualIdentities.query({}).then(function(list){
		containerlist = list || [];
		fn(containerlist);
	},function(){
		containerlist = [];
		fn(containerlist);
	});
}

function kindOf(action){
	for(var i = 0; i < ACTION_KINDS.length; i++){
		if(ACTION_KINDS[i][2].indexOf(action) !== -1)return ACTION_KINDS[i];
	}
	return ACTION_KINDS[0];
}
function actionSelect(row){
	var line = el("div","action-line");
	var sel = el("select","control action");
	sel.id = "action-" + row.key;
	sel.setAttribute("aria-label",row.label + " action");
	ACTION_KINDS.forEach(function(k){addOption(sel,k[0],k[1])});
	var sides = el("div","sides");
	var radios = [["bg","Background",0],["fg","Foreground",1]].map(function(s){
		var label = el("label","check");
		var radio = el("input");
		radio.type = "radio";
		radio.name = "side-" + row.key;
		radio.id = "side-" + row.key + "-" + s[0];
		radio.addEventListener("change",function(){
			if(radio.checked)setOpt(row.key,kindOf(optobj[row.key])[2][s[2]]);
		});
		sides.appendChild(append(label,radio,el("span",null,s[1])));
		return radio;
	});
	sel.addEventListener("change",function(){
		var actions = ACTION_KINDS.filter(function(k){return k[0] === sel.value})[0][2];
		var wasfg = kindOf(optobj[row.key])[2].indexOf(optobj[row.key]) === 1;
		setOpt(row.key,actions[wasfg && actions.length > 1 ? 1 : 0]);
	});
	onUpdate(function(){
		var action = optobj[row.key] || "none";
		var kind = kindOf(action);
		sel.value = kind[0];
		sides.classList.toggle("is-off",kind[2].length < 2);
		radios[0].checked = kind[2][0] === action;
		radios[1].checked = kind[2][1] === action;
	});
	return append(line,sel,sides);
}
function detailSelect(id,label,options,key,fallback){
	var wrap = el("label","detail-select");
	var sel = el("select","control");
	sel.id = id;
	options.forEach(function(o){addOption(sel,o[0],o[1])});
	sel.value = optobj[key] || fallback;
	sel.addEventListener("change",function(){setOpt(key,sel.value)});
	return {wrap:append(wrap,el("span","detail-label",label),sel),sel:sel};
}

function actionDetails(row){
	var wrap = el("div","details");
	var ctr = detailSelect("ctr-" + row.key,"Container behavior",
		[["current","Current container"],["none","No container"]],row.key + "ctr","current");
	withContainers(function(list){
		list.forEach(function(c){addOption(ctr.sel,c.cookieStoreId,c.name)});
		ctr.sel.value = optobj[row.key + "ctr"] || "current";
		if(!ctr.sel.value)ctr.sel.value = "current";
	});
	var img = row.image ? imageSelect(row) : null;
	var url = el("input","control url");
	url.type = "text";
	url.id = "url-" + row.key;
	url.placeholder = "Web service URL, e.g. https://example.com/?q=";
	url.setAttribute("aria-label",row.label + " web service URL");
	url.value = optobj[row.key + "url"] || "";
	url.addEventListener("change",function(){setOpt(row.key + "url",url.value.trim())});
	append(wrap,ctr.wrap,img && img.wrap,url,actionNote(row));
	onUpdate(function(){
		var action = optobj[row.key];
		ctr.wrap.hidden = CONTAINER_ACTIONS.indexOf(action) === -1;
		if(img)img.wrap.hidden = row.drag ? action === "none" : action !== "copy";
		url.hidden = WEB_ACTIONS.indexOf(action) === -1;
	});
	return wrap;
}

function imageSelect(row){
	var key = row.key + "img";
	var made = detailSelect("img-" + row.key,"On an image",[],key,"");
	var sel = made.sel;
	var kind = null;
	onUpdate(function(){
		var copy = optobj[row.key] === "copy";
		if(kind !== copy){
			kind = copy;
			sel.textContent = "";
			(copy ? IMAGE_BEHAVIORS : [IMAGE_RUN]).concat([IMAGE_SKIP]).forEach(function(o){
				addOption(sel,o[0],o[1]);
			});
		}
		var value = optobj[key] || (row.drag ? "skip" : "link");
		if(value !== "skip")value = !copy ? "run" : value === "run" ? "link" : value;
		sel.value = value;
	});
	return made;
}
function actionNote(row){
	var note = el("div","note action-note");
	onUpdate(function(){
		note.textContent = ACTION_NOTES[optobj[row.key]] || "";
		note.hidden = !note.textContent;
	});
	return note;
}
function numberControl(key,spec,slider,id){
	var wrap = el("span","number");
	var num = el("input","num");
	num.type = "number";
	num.min = spec.min;
	num.max = spec.max;
	num.step = 1;
	if(id)num.id = id;
	num.setAttribute("aria-label",spec.label + " in " + spec.unit);
	var range = null;
	if(slider){
		range = el("input","range");
		range.type = "range";
		range.min = spec.min;
		range.max = spec.max;
		range.step = spec.step;
		range.setAttribute("aria-label",spec.label);
		wrap.appendChild(range);
		range.addEventListener("input",function(){num.value = range.value});
		range.addEventListener("change",function(){setOpt(key,range.value - 0)});
	}
	append(wrap,num,el("span","unit",spec.unit));
	num.addEventListener("input",function(){
		var val = parseInt(num.value,10);
		if(range && !isNaN(val))range.value = val;
	});
	num.addEventListener("change",function(){
		var val = parseInt(num.value,10);
		if(isNaN(val))val = optobj[key];
		val = Math.min(spec.max,Math.max(spec.min,val));
		num.value = val;
		if(range)range.value = val;
		setOpt(key,val);
	});
	onUpdate(function(){
		if(document.activeElement !== num)num.value = optobj[key];
		if(range && document.activeElement !== range)range.value = optobj[key];
	});
	return wrap;
}

function rowNumber(row,spec){
	var split = !!optobj[spec.split];
	return numberControl(split ? row.own : spec.all,spec,true,split ? "num-" + row.key : "num-" + row.key + "-shared");
}

function sameToggle(spec){
	var label = el("label","check same");
	var box = el("input");
	box.type = "checkbox";
	box.id = spec.split + "-same";
	box.checked = !optobj[spec.split];
	box.addEventListener("change",function(){
		if(!box.checked){
			spec.rows.forEach(function(row){
				if(optobj[row.own] === undefined)optobj[row.own] = optobj[spec.all];
			});
		}
		optobj[spec.split] = !box.checked;
		storeOption();
		render();
	});
	return append(label,box,el("span",null,spec.same));
}
function checkbox(key,text,id){
	var label = el("label","check");
	var box = el("input");
	box.type = "checkbox";
	box.id = id || key;
	box.checked = !!optobj[key];
	box.addEventListener("change",function(){setOpt(key,box.checked)});
	return append(label,box,el("span",null,text));
}

function blockMenuControl(){
	var wrap = el("div","setting block-menu");
	var check = checkbox("blockmenu","Block the context menu so right-hold works (macOS)");
	append(wrap,check,
		el("div","note","macOS opens the context menu as soon as you press, so holding needs it blocked. A quick right-click on a link then shows no menu; right-click with Shift, Ctrl, Option or Cmd, or Ctrl+click, still opens it. Not needed on Windows."));
	onUpdate(function(){
		var off = optobj.r === "none";
		check.querySelector("input").disabled = off;
		wrap.classList.toggle("is-off",off);
	});
	return wrap;
}
function dragToggle(){
	return checkbox("mdrag","Run an action when a link is dragged","enabledrag");
}
function dragFieldset(){
	var set = el("fieldset","drag-set");
	onUpdate(function(){set.disabled = !optobj.mdrag});
	return set;
}
function dragOption(title,group){
	group.classList.add("option-line");
	group.insertBefore(el("span","option-title",title),group.firstChild);
	return append(el("div","setting drag-option"),group);
}
function dragTriggerControl(){
	var group = el("div","radio-group");
	group.setAttribute("role","radiogroup");
	group.setAttribute("aria-label","Run the action");
	DRAG_TRIGGERS.forEach(function(t){
		var label = el("label","check");
		var radio = el("input");
		radio.type = "radio";
		radio.name = "dragtrigger";
		radio.id = "dragtrigger-" + t[0];
		radio.value = t[0];
		radio.addEventListener("change",function(){if(radio.checked)setOpt("dragtrigger",t[0])});
		onUpdate(function(){radio.checked = (optobj.dragtrigger || "drop") === t[0]});
		group.appendChild(append(label,radio,el("span",null,t[1])));
	});
	return dragOption("Run the action",group);
}
function closeModeControl(){
	var wrap = el("div","setting close-mode");
	var label = el("label","field");
	var sel = el("select","control");
	sel.id = "closemode";
	CLOSE_MODES.forEach(function(m){addOption(sel,m[0],m[1])});
	sel.value = optobj.closemode || "tree";
	sel.addEventListener("change",function(){setOpt("closemode",sel.value)});
	append(label,el("span","field-label","After closing a tab, switch to"),sel);
	var desc = el("div","note");
	var self = el("div","setting");
	append(self,checkbox("selfparent","Treat tabs I open myself as children of the current tab"),
		el("div","note","New tabs, bookmarks and address-bar tabs go under the tab you were on, so closing one returns there. Restored tabs are left out."));
	onUpdate(function(){
		var mode = optobj.closemode || "tree";
		CLOSE_MODES.forEach(function(m){if(m[0] === mode)desc.textContent = m[2]});
		self.hidden = mode !== "tree";
	});
	return append(wrap,label,desc,self);
}

var EXCEPTION_INTRO = "Long-press and drag are turned off on pages whose address matches a rule. It is the page you are on that counts, not the link you press, and its address is checked without the ?query or #part. One rule per line; press Enter for a new one. Each line is read on its own, so address patterns and regular expressions can be mixed.";
var EXCEPTION_HELP = [
	["example.com","The site and its subdomains."],
	["example.com/docs","That page and pages under it."],
	["\"example.com/docs\"","Only that page. Quotes mean exactly this address; * still works inside them."],
	["example.com/*.pdf","PDFs anywhere on the site. * matches anything."],
	["https://example.com/page","That address and pages under it."],
	["re:(?i)^https?://(www\\.)?example\\.(com|org)/","A regular expression, tested on the full address. Flags go at the start."],
	["/^https?:\\/\\/(www\\.)?example\\.(com|org)\\//i","A regular expression. Flags go after the last slash."],
	["# note","A note. Ignored, as are blank lines."]
];

function exceptionsEditor(){
	var wrap = el("div","exceptions");
	append(wrap,el("p","note",EXCEPTION_INTRO));
	var help = el("dl","exception-help");
	EXCEPTION_HELP.forEach(function(h){append(help,el("dt",null,h[0]),el("dd",null,h[1]))});
	wrap.appendChild(help);

	var editor = el("div","editor");
	var gutter = el("div","gutter");
	gutter.setAttribute("aria-hidden","true");
	var numbers = el("div","gutter-lines");
	gutter.appendChild(numbers);
	var field = el("div","editor-field");
	var backdrop = el("div","editor-backdrop");
	backdrop.setAttribute("aria-hidden","true");
	var copy = el("div","editor-lines");
	backdrop.appendChild(copy);
	var text = el("textarea","editor-text");
	text.id = "exceptions";
	text.spellcheck = false;
	text.setAttribute("aria-label","Excluded site rules, one per line");
	text.setAttribute("wrap","soft");
	text.value = (optobj.exceptions || []).join("\n");
	append(field,backdrop,text);
	append(editor,gutter,field);
	var status = el("div","note editor-status");
	status.setAttribute("aria-live","polite");

	var tester = el("label","field tester");
	var testurl = el("input","control");
	testurl.type = "text";
	testurl.id = "exception-test";
	testurl.placeholder = "https://example.com/page";
	var testresult = el("span","tester-result");
	append(tester,el("span","field-label","Test an address"),testurl,testresult);
	append(wrap,editor,status,tester);

	function lines(){
		return text.value.split("\n");
	}
	function layout(){
		var all = lines();
		copy.style.width = text.clientWidth + "px";
		copy.textContent = "";
		numbers.textContent = "";
		var errors = [];
		var counts = {glob:0,regex:0};
		var rows = all.map(function(line,i){
			var rule = parseExceptionLine(line);
			if(counts[rule.type] !== undefined)counts[rule.type]++;
			if(rule.type === "error")errors.push("line " + (i + 1) + ": " + rule.error);
			var row = el("div","editor-line is-" + rule.type,line || "​");
			copy.appendChild(row);
			return {row:row,rule:rule};
		});
		rows.forEach(function(r,i){
			var num = el("div","gutter-line is-" + r.rule.type,String(i + 1));
			num.style.height = r.row.offsetHeight + "px";
			if(r.rule.error)num.title = r.rule.error;
			numbers.appendChild(num);
		});
		text.style.height = "auto";
		text.style.height = text.scrollHeight + "px";
		var total = counts.glob + counts.regex;
		status.textContent = (total ? total + " rule" + (total === 1 ? "" : "s") + " (" + counts.glob + " address, " + counts.regex + " regular expression)" : "No rules yet.") +
			(errors.length ? ". Not used: " + errors.join("; ") : "");
		status.classList.toggle("has-error",errors.length > 0);
		test();
	}
	function test(){
		var url = testurl.value.trim();
		if(!url){
			testresult.textContent = "";
			return;
		}
		if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(url))url = "https://" + url;
		// The address as the extension sees a page: scheme, host and path.
		try{
			var parsed = new URL(url);
			url = parsed.protocol + "//" + parsed.hostname + parsed.pathname;
		}catch(e){
			testresult.textContent = "Not an address";
			testresult.className = "tester-result is-nomatch";
			return;
		}
		var line = matchException(url,compileExceptions(lines()));
		testresult.textContent = (line ? "Excluded by line " + line : "Not excluded") + " (checked as " + url + ")";
		testresult.className = "tester-result " + (line ? "is-match" : "is-nomatch");
	}
	var savetimer = null;
	text.addEventListener("input",function(){
		layout();
		clearTimeout(savetimer);
		savetimer = setTimeout(function(){
			optobj.exceptions = lines();
			storeOption();
		},400);
	});
	testurl.addEventListener("input",test);
	if(window.ResizeObserver)new ResizeObserver(layout).observe(text);
	setTimeout(layout,0);
	return wrap;
}

function section(title,intro,headerextra){
	var sec = el("section","section");
	var head = el("div","section-head");
	append(head,el("h2",null,title),headerextra);
	append(sec,head,intro ? el("p","note section-intro",intro) : null);
	return sec;
}
var BUTTONS_INTRO = "Hold a mouse button on a link to run an action. A quick click still works as usual. Holding with Shift, Ctrl, Option or Cmd is left to Firefox.";
var DRAG_INTRO = "Drag a link in a direction, past the drag distance, to run that direction's action.";
function inputRows(parent,rows,spec){
	var head = el("div","rows-head");
	append(head,el("div"),append(el("div","rows-head-number"),el("span",null,spec.label),sameToggle(spec)));
	parent.appendChild(head);
	rows.forEach(function(row){
		var left = el("div","row-main");
		append(left,el("h3",null,row.label),actionSelect(row),actionDetails(row),row.key === "r" ? blockMenuControl() : null);
		append(parent,append(el("div","setting-row"),left,
			append(el("div","row-number"),rowNumber(row,spec))));
	});
	return parent;
}
function aboutSection(){
	var sec = section("About");
	append(sec,
		el("p",null,"Long Press New Tab Plus " + chrome.runtime.getManifest().version),
		append(el("p",null),"Source code and issues: ",link(GITHUB_URL,GITHUB_URL.replace("https://",""))),
		append(el("p","note"),"Based on ",link(ORIGINAL_URL,"Long Press New Tab")," by Kunihiro Ando, released under the MIT License. This fork is not affiliated with or endorsed by the original author."));
	return sec;
}
function renderPane(pane,current){
	if(current === "buttons"){
		pane.appendChild(inputRows(section("Mouse buttons",BUTTONS_INTRO),BUTTONS,HOLD));
	}else if(current === "drag"){
		var drag = section("Drag link",DRAG_INTRO,dragToggle());
		drag.appendChild(inputRows(append(dragFieldset(),dragTriggerControl()),DRAGS,DISTANCE));
		pane.appendChild(drag);
	}else if(current === "closing"){
		pane.appendChild(append(section("Closing tabs","Which tab Firefox switches to after you close one."),closeModeControl()));
	}else if(current === "exceptions"){
		pane.appendChild(append(section("Excluded sites"),exceptionsEditor()));
	}else{
		pane.appendChild(aboutSection());
	}
}

var darkquery = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme(){
	var theme = OLD_THEMES[optobj.uitheme] || optobj.uitheme || "autodarker";
	if(theme === "auto")theme = darkquery.matches ? "dark" : "light";
	if(theme === "autodarker")theme = darkquery.matches ? "darker" : "light";
	document.documentElement.setAttribute("data-theme",theme);
}
applyTheme();
darkquery.addEventListener("change",applyTheme);

function initPage(){
	document.getElementById("version").textContent = chrome.runtime.getManifest().version;
	var theme = document.getElementById("theme");
	THEMES.forEach(function(t){addOption(theme,t[0],t[1])});
	theme.value = OLD_THEMES[optobj.uitheme] || optobj.uitheme || "autodarker";
	if(!theme.value)theme.value = "autodarker";
	theme.addEventListener("change",function(){
		optobj.uitheme = theme.value;
		storeOption();
		applyTheme();
	});
	applyTheme();

	var opentab = document.getElementById("open-tab");
	chrome.tabs.getCurrent(function(tab){
		opentab.hidden = !!(tab && tab.url && tab.url.indexOf(chrome.runtime.getURL("")) === 0);
	});
	opentab.addEventListener("click",function(){
		chrome.tabs.create({url:chrome.runtime.getURL("options.html")});
	});
	render();
}
function render(){
	var focused = document.activeElement && document.activeElement.id;
	var app = document.getElementById("app");
	var current = store("lpnt-pane","buttons");
	if(!PANES.some(function(p){return p[0] === current}))current = "buttons";
	updaters = [];
	app.textContent = "";
	var nav = el("nav","sidebar");
	PANES.forEach(function(p){
		var btn = el("button","nav-item",p[1]);
		btn.type = "button";
		btn.id = "pane-" + p[0];
		btn.setAttribute("aria-current",p[0] === current ? "page" : "false");
		btn.addEventListener("click",function(){
			keep("lpnt-pane",p[0]);
			render();
		});
		nav.appendChild(btn);
	});
	var pane = el("div","pane");
	renderPane(pane,current);
	append(app,append(el("div","sidebar-layout"),nav,pane));
	if(focused && document.getElementById(focused))document.getElementById(focused).focus();
}
