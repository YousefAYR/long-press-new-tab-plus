var optobj = {};
var relatedtabs = {};
function checkExceptList(url,list){
	if(list){
		var len = list.length;
	    for(var i = 0; i < len; i++){
	    	var lurl = list[i].url;
	        var regex = new RegExp(lurl);
	        if (url.search(regex) != -1) {
	            return list[i];
	        }
		    if(lurl.match(/^(http|https):\/\/.+$/)){
		    	var idx = url.indexOf(lurl);
				if(idx == 0){
					return list[i];
				}
		    }else{
		    	var urlary = url.split("/");
		    	if(urlary[2]){
			    	var domain = urlary[2];
			    	var idx = domain.indexOf(lurl);
					if(idx == 0){
						return list[i];
					}
			        var regex = new RegExp(lurl);
			        if (domain.search(regex) != -1) {
			            return list[i];
			        }
		    	}
		    }
	    }
	}
    return null;
}
function setOption(opt){optobj = opt}
function loadOption(){
	var lclobj = localStorage.getItem("opt_obj");
	if(lclobj){
		optobj = JSON.parse(lclobj);
	}else{
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
        optobj.lurl = "";
        optobj.murl = "";
        optobj.rurl = "";
        optobj.dlurl = "";
        optobj.drurl = "";
        optobj.duurl = "";
        optobj.ddurl = "";
	}
}
function downloadItems(url){
    var opt = {saveAs:true,url:url};
    chrome.downloads.download(opt,function(dlid){
    });
}
// Open a tab the way Firefox's "Open Link in New Tab" does: linked to the
// source tab, placed after the tabs already opened from it, in the same container.
function openRelatedTab(url,srctab,active){
	chrome.tabs.query({windowId:srctab.windowId},function(tabs){
		var byid = {};
		tabs.forEach(function(t){byid[t.id] = t});
		tabs.sort(function(a,b){return a.index - b.index});
		var idx = srctab.index + 1;
		while(tabs[idx] && isDescendantOf(tabs[idx],srctab.id,byid)){
			idx++;
		}
		var opt = {url:url,active:active,index:idx,openerTabId:srctab.id,windowId:srctab.windowId};
		if(srctab.cookieStoreId){
			opt.cookieStoreId = srctab.cookieStoreId;
		}
		chrome.tabs.create(opt,function(tab){
			if(chrome.runtime.lastError || !tab)return;
			relatedtabs[tab.id] = srctab.id;
			updateSuccessor(tab.windowId);
		});
	});
}
function getParentId(tab){
	var parentid = relatedtabs[tab.id];
	return parentid !== undefined ? parentid : tab.openerTabId;
}
function isDescendantOf(tab,parentid,byid){
	var seen = {};
	while(tab && !seen[tab.id]){
		var crntparent = getParentId(tab);
		if(crntparent === undefined)return false;
		if(crntparent === parentid)return true;
		seen[tab.id] = true;
		tab = byid[crntparent];
	}
	return false;
}
// When the active tab was opened by openRelatedTab, closing it selects the tab
// on its right under the same parent, else the one on its left, else the parent.
// Closing a parent moves its children up a level, so this repeats up the tree.
function updateSuccessor(windowid){
	chrome.tabs.query({windowId:windowid},function(tabs){
		if(chrome.runtime.lastError)return;
		var byid = {};
		var visible = tabs.filter(function(t){
			byid[t.id] = t;
			return !t.hidden;
		}).sort(function(a,b){return a.index - b.index});
		for(var i = 0; i < visible.length; i++){
			if(visible[i].active)break;
		}
		var crnt = visible[i];
		if(!crnt || relatedtabs[crnt.id] === undefined)return;
		var parentid = relatedtabs[crnt.id];
		var right = visible[i + 1];
		var left = visible[i - 1];
		var successor = chrome.tabs.TAB_ID_NONE;
		if(right && isDescendantOf(right,parentid,byid)){
			successor = right.id;
		}else if(left && (left.id === parentid || isDescendantOf(left,parentid,byid))){
			successor = left.id;
		}else if(byid[parentid]){
			successor = parentid;
		}
		chrome.tabs.update(crnt.id,{successorTabId:successor},function(){
			void chrome.runtime.lastError;
		});
	});
}
function onTabsChanged(windowid){
	if(windowid !== undefined)updateSuccessor(windowid);
}
chrome.tabs.onActivated.addListener(function(info){onTabsChanged(info.windowId)});
chrome.tabs.onCreated.addListener(function(tab){onTabsChanged(tab.windowId)});
chrome.tabs.onMoved.addListener(function(id,info){onTabsChanged(info.windowId)});
chrome.tabs.onAttached.addListener(function(id,info){onTabsChanged(info.newWindowId)});
chrome.tabs.onDetached.addListener(function(id,info){onTabsChanged(info.oldWindowId)});
chrome.tabs.onRemoved.addListener(function(id,info){
	var parentid = relatedtabs[id];
	delete relatedtabs[id];
	if(parentid !== undefined){
		for(var childid in relatedtabs){
			if(relatedtabs[childid] === id)relatedtabs[childid] = parentid;
		}
	}
	if(!info.isWindowClosing)onTabsChanged(info.windowId);
});
function copyStrings(str){
    var inpt = document.createElement("input");
    document.body.appendChild(inpt);
    inpt.setAttribute("type","text");
    inpt.value = str;
    inpt.focus();
    inpt.select();
    document.execCommand("copy");
    setTimeout(function(){
        document.body.removeChild(inpt);
    },1000);
}
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if(request.stat == "init"){
		loadOption();
		var url = request.url;
		if(!checkExceptList(url,optobj.excpetoptionarray)){
	        sendResponse({request: "stat",opt:optobj});
		}else{
	        sendResponse({});
		}
    }else if(request.tab == "url"){
		var url = request.url;
		var tabid = sender.tab.id;
		if(url){
    		chrome.tabs.update(tabid,{url:url});
		}
        sendResponse({});
    }else if(request.tab == "new"){
		var url = request.url;
		chrome.tabs.create({url:url,active:true});
        sendResponse({});
    }else if(request.tab == "newbg"){
		var url = request.url;
		chrome.tabs.create({url:url,active:false});
        sendResponse({});
    }else if(request.tab == "newbgrel"){
		openRelatedTab(request.url,sender.tab,false);
        sendResponse({});
    }else if(request.tab == "newrel"){
		openRelatedTab(request.url,sender.tab,true);
        sendResponse({});
    }else if(request.tab == "save"){
		var url = request.url;
    	downloadItems(url);
        sendResponse({});
    }else if(request.tab == "copy"){
		var url = request.url;
		copyStrings(url);        
    }
});
