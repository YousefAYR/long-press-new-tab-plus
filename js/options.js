var excptidex = -1;
var excpetoptionarray = [];
var optobj = {};
optobj.excpetoptionarray = [];
optobj.l = "bgrel";
optobj.m = "none";
optobj.r = "none";
optobj.waittime = 350;
optobj.mdrag = false;
optobj.dl = "none";
optobj.dr = "none";
optobj.du = "none";
optobj.dd = "none";
optobj.dxval = 100;
optobj.splitwait = false;
optobj.splitdx = false;
optobj.blockmenu = false;
optobj.closemode = "tree";
optobj.selfparent = false;

optobj.lurl = "";
optobj.murl = "";
optobj.rurl = "";
optobj.dlurl = "";
optobj.drurl = "";
optobj.duurl = "";
optobj.ddurl = "";

// Actions offered in every long-press and drag dropdown, in display order.
var actionoptions = [
	["none","NONE"],
	["bgrel","Open Link in New Tab (Background)"],
	["newrel","Open Link in New Tab (Foreground)"],
	["bg","New Tab at End (Background)"],
	["new","New Tab at End (Foreground)"],
	["window","Open Link in New Window (Foreground)"],
	["windowbg","Open Link in New Window (Background)"],
	["privatewindow","Open Link in New Private Window (Foreground)"],
	["privatewindowbg","Open Link in New Private Window (Background)"],
	["crnt","Open in Current Tab (Forced)"],
	["closetab","Close Current Tab"],
	["save","Save Link"],
	["copy","Copy"],
	["web","Send Web Service"],
	["webbg","Send Web Service(Background)"]
];
// Each action dropdown and the setting name its choices are saved under.
var actionrows = [
	["dragactionleft","l"],["dragactionmiddle","m"],["dragactionright","r"],
	["ddragactionup","du"],["ddragactiondown","dd"],["ddragactionleft","dl"],["ddragactionright","dr"]
];
var newtabactions = ["bgrel","newrel","bg","new","window","windowbg"];
// Notes under the container dropdown, for new window actions.
var extranotes = {
	windowbg: "Opens in foreground from macOS full screen."
};
// Short notes shown in the slot for actions that need explaining.
var slotnotes = {
	closetab: "Works anywhere except text fields and scrollbars. Moving the mouse cancels it.",
	privatewindow: "Needs Run in Private Windows allowed for this add-on in Add-ons.",
	privatewindowbg: "Needs Run in Private Windows allowed. Opens in foreground from macOS full screen."
};
// Under each action dropdown is one slot: the URL box for a web service, or the
// container behavior for a new tab action.
function setupContainerRows(){
	var selects = [];
	for(var i = 0; i < actionrows.length; i++){
		var actionsel = document.getElementById(actionrows[i][0]);
		var optname = actionrows[i][1] + "ctr";
		var lbl = document.createElement("label");
		lbl.setAttribute("class","slotlabel");
		lbl.textContent = "Container behavior";
		var sel = document.createElement("select");
		sel.setAttribute("class","selectclass ctrselect");
		addOption(sel,"current","Current container");
		addOption(sel,"none","No container");
		sel.optname = optname;
		sel.value = optobj[optname] || "current";
		sel.addEventListener("change",function(e){
			optobj[this.optname] = this.value;
			storeOption();
		},false);
		var note = document.createElement("div");
		note.setAttribute("class","slotnote");
		actionsel.parentNode.appendChild(lbl);
		actionsel.parentNode.appendChild(sel);
		actionsel.parentNode.appendChild(note);
		// A line under the container dropdown, for actions that also need a note.
		var extra = document.createElement("div");
		extra.setAttribute("class","slotextranote");
		actionsel.parentNode.appendChild(extra);
		selects.push(sel);
		showActionSlot(actionsel);
	}
	// The container API only takes promises, through browser.* (Firefox only).
	if(typeof browser === "undefined" || !browser.contextualIdentities)return;
	browser.contextualIdentities.query({}).then(function(containers){
		selects.forEach(function(sel){
			containers.forEach(function(c){
				addOption(sel,c.cookieStoreId,c.name);
			});
			sel.value = optobj[sel.optname] || "current";
			if(!sel.value)sel.value = "current";
		});
	},function(){});
}
function addOption(sel,value,text){
	var opt = document.createElement("option");
	opt.value = value;
	opt.textContent = text;
	sel.appendChild(opt);
}
function showActionSlot(actionsel){
	var row = actionsel.parentNode;
	var isweb = actionsel.value === "web" || actionsel.value === "webbg";
	var istab = newtabactions.indexOf(actionsel.value) !== -1;
	row.querySelector(".urlrow").style.visibility = isweb ? "visible" : "hidden";
	var ctr = row.querySelector(".ctrselect");
	if(!ctr)return;
	ctr.style.visibility = istab ? "visible" : "hidden";
	row.querySelector(".slotlabel").style.visibility = istab ? "visible" : "hidden";
	var note = row.querySelector(".slotnote");
	note.textContent = slotnotes[actionsel.value] || "";
	note.style.visibility = slotnotes[actionsel.value] ? "visible" : "hidden";
	// Takes a line only while shown.
	var extra = row.querySelector(".slotextranote");
	extra.textContent = extranotes[actionsel.value] || "";
	extra.style.display = extranotes[actionsel.value] ? "block" : "none";
}
function fillActionSelects(){
	var selects = document.querySelectorAll("select.actionselect");
	for(var i = 0; i < selects.length; i++){
		for(var j = 0; j < actionoptions.length; j++){
			var opt = document.createElement("option");
			opt.value = actionoptions[j][0];
			opt.textContent = actionoptions[j][1];
			selects[i].appendChild(opt);
		}
	}
}
// Settings live in extension storage, which survives restarts and clearing
// history (localStorage does not).
document.addEventListener("DOMContentLoaded",function(e){
	chrome.storage.local.get("opt_obj",function(stored){
		if(stored && stored.opt_obj)optobj = stored.opt_obj;
		initOptionsPage();
	});
}, false);
function initOptionsPage(){
	fillActionSelects();
	setupContainerRows();
	var eurlary = optobj.excpetoptionarray;
	if(eurlary.length > 0){
		for(var i = 0; i < eurlary.length; i++){
			excpetoptionarray.push(eurlary[i]);
			createExceptItem(eurlary[i].url);
		}
	}else{
		optobj.excpetoptionarray = [];
	}
	setupSplitRows("splitwait","waitrows",waitrows);
	document.getElementById("dragactionleft").value = optobj.l;
	if(optobj.m)document.getElementById("dragactionmiddle").value = optobj.m;
	document.getElementById("dragactionright").value = optobj.r;
	if(optobj.closemode)document.getElementById("closemode").value = optobj.closemode;
	showCloseModeDesc();
	document.getElementById("closemode").addEventListener("change",changeCloseMode,false);
	showBlockMenu();
	document.getElementById("dragactionright").addEventListener("change",showBlockMenu,false);
	document.getElementById("blockmenu").checked = !!optobj.blockmenu;
	document.getElementById("blockmenu").addEventListener("change",function(e){
		optobj.blockmenu = this.checked;
		storeOption();
	},false);
	document.getElementById("selfparent").checked = !!optobj.selfparent;
	document.getElementById("selfparent").addEventListener("change",changeSelfParent,false);
	document.getElementById("addbutton2").addEventListener("click",clickAddButton2,false);
	changeLongPressAction(document.getElementById("dragactionleft"),"l","web_service_lurl_container",true)
	changeLongPressAction(document.getElementById("dragactionmiddle"),"m","web_service_murl_container",true)
	changeLongPressAction(document.getElementById("dragactionright"),"r","web_service_rurl_container",true)
	document.getElementById("web_service_lurl_input").value = optobj.lurl;
	document.getElementById("web_service_murl_input").value = optobj.murl;
	document.getElementById("web_service_rurl_input").value = optobj.rurl;
	document.getElementById("dragactionleft").addEventListener("change",function(e){
		changeLongPressAction(e.currentTarget,"l","web_service_lurl_container");
	},false);
	document.getElementById("dragactionmiddle").addEventListener("change",function(e){
		changeLongPressAction(e.currentTarget,"m","web_service_murl_container");
	},false);
	document.getElementById("dragactionright").addEventListener("change",function(e){
		changeLongPressAction(e.currentTarget,"r","web_service_rurl_container");
	},false);
	document.getElementById("web_service_lurl_input").addEventListener("change",function(e){
		changeWebServiceURL(this,"lurl")
	},false);
	document.getElementById("web_service_murl_input").addEventListener("change",function(e){
		changeWebServiceURL(this,"murl")
	},false);
	document.getElementById("web_service_rurl_input").addEventListener("change",function(e){
		changeWebServiceURL(this,"rurl")
	},false);



	document.getElementById("ddragactionup").value = optobj.du;
	document.getElementById("ddragactiondown").value = optobj.dd;
	document.getElementById("ddragactionleft").value = optobj.dl;
	document.getElementById("ddragactionright").value = optobj.dr;
	document.getElementById("web_service_duurl_input").value = optobj.duurl;
	document.getElementById("web_service_ddurl_input").value = optobj.ddurl;
	document.getElementById("web_service_drurl_input").value = optobj.drurl;
	document.getElementById("web_service_dlurl_input").value = optobj.dlurl;

	changeLongPressAction(document.getElementById("ddragactionup"),"du","web_service_duurl_container",true)
	changeLongPressAction(document.getElementById("ddragactiondown"),"dd","web_service_ddurl_container",true)
	changeLongPressAction(document.getElementById("ddragactionleft"),"dl","web_service_dlurl_container",true)
	changeLongPressAction(document.getElementById("ddragactionright"),"dr","web_service_drurl_container",true)

	document.getElementById("ddragactionup").addEventListener("change",dchangeActionUp,false);
	document.getElementById("ddragactiondown").addEventListener("change",dchangeActionDown,false);
	document.getElementById("ddragactionleft").addEventListener("change",dchangeActionLeft,false);
	document.getElementById("ddragactionright").addEventListener("change",dchangeActionRight,false);




	document.getElementById("ddragactionup").addEventListener("change",function(e){
		changeLongPressAction(e.currentTarget,"du","web_service_duurl_container");
	},false);
	document.getElementById("ddragactiondown").addEventListener("change",function(e){
		changeLongPressAction(e.currentTarget,"dd","web_service_ddurl_container");
	},false);
	document.getElementById("ddragactionleft").addEventListener("change",function(e){
		changeLongPressAction(e.currentTarget,"dl","web_service_dlurl_container");
	},false);
	document.getElementById("ddragactionright").addEventListener("change",function(e){
		changeLongPressAction(e.currentTarget,"dr","web_service_drurl_container");
	},false);

	document.getElementById("web_service_duurl_input").addEventListener("change",function(e){
		changeWebServiceURL(this,"duurl")
	},false);
	document.getElementById("web_service_ddurl_input").addEventListener("change",function(e){
		changeWebServiceURL(this,"ddurl")
	},false);
	document.getElementById("web_service_dlurl_input").addEventListener("change",function(e){
		changeWebServiceURL(this,"dlurl")
	},false);
	document.getElementById("web_service_drurl_input").addEventListener("change",function(e){
		changeWebServiceURL(this,"drurl")
	},false);















	document.getElementById("enabledrag").addEventListener("change",changeEnableDrag,false);
	setupSplitRows("splitdx","dxrows",dxrows);
	if(optobj.mdrag){
		document.getElementById("enabledrag").checked = true;
		document.getElementById("dragcontainer").style.display = "block"
	}
}










function changeLongPressAction(elem,optname,contname,cs){
	var val = elem.value;
	showActionSlot(elem);
	if(cs)return;
	optobj[optname] = val;
	storeOption();
}
function changeWebServiceURL(elem,optname){
	optobj[optname] = elem.value.replace(/^\s+|\s+$/g, "");
	storeOption();
}








function dchangeActionUp(e){
	var val = this.value;
	optobj.du = val;
	storeOption();
}
function dchangeActionDown(e){
	var val = this.value;
	optobj.dd = val;
	storeOption();
}
function dchangeActionLeft(e){
	var val = this.value;
	optobj.dl = val;
	storeOption();
}
function dchangeActionRight(e){
	var val = this.value;
	optobj.dr = val;
	storeOption();
}
function changeEnableDrag(e){
	if (this.checked) {
		optobj.mdrag = true;
		document.getElementById("dragcontainer").style.display = "block"
	}else{
		optobj.mdrag = false;
		document.getElementById("dragcontainer").style.display = "none"
	};
	storeOption();
}
// Durations and drag distances: one shared value, or one per button/direction.
// "all" is the shared value; the others are used when the split box is checked.
var waitrows = {
	splitname: "splitwait", unit: "ms", min: 100, max: 3000, step: 10,
	all: "waittime",
	rows: [["waitl","Left button"],["waitm","Middle button"],["waitr","Right button"]]
};
var dxrows = {
	splitname: "splitdx", unit: "pixels", min: 30, max: 500, step: 10,
	all: "dxval",
	rows: [["dxup","Up"],["dxdown","Down"],["dxleft","Left"],["dxright","Right"]]
};
function setupSplitRows(checkid,containerid,spec){
	var check = document.getElementById(checkid);
	check.checked = !!optobj[spec.splitname];
	showSplitRows(containerid,spec);
	check.addEventListener("change",function(e){
		optobj[spec.splitname] = this.checked;
		showSplitRows(containerid,spec);
		storeOption();
	},false);
}
function showSplitRows(containerid,spec){
	var cont = document.getElementById(containerid);
	cont.textContent = "";
	if(!optobj[spec.splitname]){
		addNumberRow(cont,"",spec.all,spec);
		return;
	}
	for(var i = 0; i < spec.rows.length; i++){
		var optname = spec.rows[i][0];
		if(optobj[optname] === undefined)optobj[optname] = optobj[spec.all];
		addNumberRow(cont,spec.rows[i][1],optname,spec);
	}
}
// A slider and a number box that stay in sync and save to optobj[optname].
function addNumberRow(cont,label,optname,spec){
	var row = document.createElement("div");
	row.setAttribute("class","numberrow");
	cont.appendChild(row);
	// Three columns: label, slider, number box. The slider column is centered.
	var lbl = document.createElement("label");
	lbl.setAttribute("class","numberrowlabel");
	lbl.textContent = label;
	row.appendChild(lbl);
	var range = document.createElement("input");
	range.setAttribute("type","range");
	range.min = spec.min;
	range.max = spec.max;
	range.step = spec.step;
	row.appendChild(range);
	var num = document.createElement("input");
	num.setAttribute("type","number");
	num.setAttribute("class","numberinput");
	num.min = spec.min;
	num.max = spec.max;
	num.step = 1;
	var numcell = document.createElement("span");
	numcell.setAttribute("class","numbercell");
	numcell.appendChild(num);
	numcell.appendChild(document.createTextNode(spec.unit));
	row.appendChild(numcell);
	range.value = num.value = optobj[optname];
	range.addEventListener("input",function(e){
		num.value = range.value;
	},false);
	range.addEventListener("change",function(e){
		setNumberOption(optname,range.value);
	},false);
	// Move the slider while typing; save once the value is committed.
	num.addEventListener("input",function(e){
		var val = parseInt(num.value,10);
		if(!isNaN(val))range.value = val;
	},false);
	num.addEventListener("change",function(e){
		var val = parseInt(num.value,10);
		if(isNaN(val))val = optobj[optname];
		val = Math.min(spec.max,Math.max(spec.min,val));
		num.value = range.value = val;
		setNumberOption(optname,val);
	},false);
}
// The context menu option only matters when the right button has an action.
function showBlockMenu(){
	var val = document.getElementById("dragactionright").value;
	document.getElementById("blockmenucontainer").style.display = val === "none" ? "none" : "block";
}
function setNumberOption(optname,val){
	optobj[optname] = val - 0;
	storeOption();
}
var closemodedescs = {
	tree: "Tabs are grouped under the tab that opened them. Closing one goes to the next tab in its group, then the previous one, then the tab that opened it, repeating up the tree. Tabs you opened yourself use Next tab.",
	next: "Switches to the tab on the right (below, with vertical tabs). If there is none, switches to the tab on the left (above).",
	prev: "Switches to the tab you were on before the one you closed. If that tab is gone, uses Next tab.",
	default: "Leaves it to Firefox, which usually returns to the tab the closed one was opened from, otherwise the tab on the right."
};
function showCloseModeDesc(){
	var val = document.getElementById("closemode").value;
	document.getElementById("closemodedesc").textContent = closemodedescs[val];
	document.getElementById("selfparentcontainer").style.display = val === "tree" ? "block" : "none";
}
function changeSelfParent(e){
	optobj.selfparent = this.checked;
	storeOption();
}
function changeCloseMode(e){
	optobj.closemode = this.value;
	showCloseModeDesc();
	storeOption();
}
function createExceptItem(inpuval){
	excptidex++;
	var maincont = document.getElementById("exceptpopupllist");

	var cont = document.createElement("div");
	maincont.appendChild(cont);
	cont.setAttribute("class","oinputcontclass");

	var cimg = document.createElement("img");
	cont.appendChild(cimg);
	cimg.setAttribute("src","img/closee.png");
	cimg.setAttribute("class","closeimgclass");
	cimg.index = excptidex;
	cimg.addEventListener("click",clickCloseImg2,false);

	var inpt = document.createElement("input");
	cont.appendChild(inpt);
	inpt.setAttribute("type","text");
	inpt.setAttribute("class","openurlitemclass");
	inpt.setAttribute("placeholder","URL");
	inpt.index = excptidex;
	inpt.value = inpuval;
	inpt.addEventListener("blur",blurExceptInput,false);
	inpt.setAttribute("id","exceptinput"+excptidex);
}
function blurExceptInput(e){
	var row = e.currentTarget;
	var val = row.value;
	val = val.replace(/^\s+|\s+$/g, "");
	if(val){
		setExceptOption(val,row.index);
	}else{
		setExceptOption(null,row.index);
		var prntnd = row.parentNode;
		prntnd.parentNode.removeChild(prntnd);
	}
}
function setExceptOption(val,index){
	if(val){
		var optionobj = {};
		optionobj.url = val;
		optionobj.sel = "1"	;	
		excpetoptionarray[index] = optionobj;
	}else{
		excpetoptionarray[index] = null;
	}

	var opt =[];
	for(var i = 0; i < excpetoptionarray.length; i++){
		if(excpetoptionarray[i]){
			opt.push(excpetoptionarray[i]);
		}
	}
	optobj.excpetoptionarray = opt;
	storeOption();
}
function clickCloseImg2(e){
	var eindx = e.currentTarget.index;
	var row = document.getElementById("exceptinput"+eindx);
	row.focus();
	row.value = "";
	row.blur();
}
function clickAddButton2(){
	createExceptItem("");
}
// The background page picks up the change through storage.onChanged.
function storeOption(){
	chrome.storage.local.set({opt_obj:optobj});
}
