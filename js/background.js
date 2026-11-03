var optobj = {};
var tabparents = {};
var removedtabs = {};
var removedttl = 60000;
var lastremovedsweep = 0;
var activehistory = {};
var optbroadcasttimer = null;
var optionloaded = false;
var optionwaiting = [];
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
function setOption(opt){
	var oldmode = getCloseMode();
	var oldpage = pageSettingsKey();
	optobj = opt;
	if(getCloseMode() !== oldmode)refreshSuccessors();
	// Pages fetch settings on a link's mousedown, which is too late for the
	// context menu block on macOS and isn't done away from links (Close Current
	// Tab). So open pages are told to reload their settings when something those
	// use changes. Quick changes are sent once.
	if(pageSettingsKey() !== oldpage){
		clearTimeout(optbroadcasttimer);
		optbroadcasttimer = setTimeout(broadcastOptionChange,300);
	}
}
function pageSettingsKey(){
	return JSON.stringify([!!optobj.blockmenu,optobj.l,optobj.m,optobj.r,optobj.excpetoptionarray,
		optobj.waittime,!!optobj.splitwait,optobj.waitl,optobj.waitm,optobj.waitr]);
}
function broadcastOptionChange(){
	chrome.tabs.query({discarded:false},function(tabs){
		if(chrome.runtime.lastError)return;
		tabs.forEach(function(t){
			// Content scripts only run on web and file pages.
			if(!t.url || !/^(https?|file):/.test(t.url))return;
			chrome.tabs.sendMessage(t.id,{stat:"optchanged"},function(){
				void chrome.runtime.lastError;
			});
		});
	});
}
function getCloseMode(){
	return optobj.closemode || "tree";
}
// Settings live in extension storage, which survives restarts and clearing
// history. Settings saved by older versions in localStorage are moved over once.
function loadOption(callback){
	chrome.storage.local.get("opt_obj",function(stored){
		var lclobj = null;
		try{
			lclobj = localStorage.getItem("opt_obj");
		}catch(e){}
		if(stored && stored.opt_obj){
			optobj = stored.opt_obj;
		}else if(lclobj){
			optobj = JSON.parse(lclobj);
			chrome.storage.local.set({opt_obj:optobj});
		}else{
			setDefaultOption();
		}
		if(lclobj){
			try{
				localStorage.removeItem("opt_obj");
			}catch(e){}
		}
		optionloaded = true;
		var waiting = optionwaiting;
		optionwaiting = [];
		waiting.forEach(function(fn){fn()});
		if(callback)callback();
	});
}
function whenOptionLoaded(fn){
	if(optionloaded){
		fn();
	}else{
		optionwaiting.push(fn);
	}
}
function setDefaultOption(){
	optobj = {};
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
}
function downloadItems(url){
    var opt = {saveAs:true,url:url};
    chrome.downloads.download(opt,function(dlid){
    });
}
// Container behavior for new tabs: "current" keeps the source tab's container
// (or none), "none" opens outside any container, anything else is the
// cookieStoreId of a specific container. Without a setting (web service
// actions) the tab opens in Firefox's default. Private windows keep their own.
function withContainer(opt,srctab,ctr){
	if(!ctr || srctab.incognito)return opt;
	if(ctr === "current"){
		if(srctab.cookieStoreId)opt.cookieStoreId = srctab.cookieStoreId;
	}else if(ctr === "none"){
		opt.cookieStoreId = "firefox-default";
	}else{
		opt.cookieStoreId = ctr;
	}
	return opt;
}
// A container that was deleted since it was chosen falls back to no container.
// It has to be named: without one, a tab with an opener takes the opener's.
function createTab(opt,callback){
	chrome.tabs.create(opt,function(tab){
		if(chrome.runtime.lastError && opt.cookieStoreId){
			if(opt.cookieStoreId !== "firefox-default"){
				opt.cookieStoreId = "firefox-default";
			}else{
				delete opt.cookieStoreId;
			}
			chrome.tabs.create(opt,function(tab){
				void chrome.runtime.lastError;
				if(callback && tab)callback(tab);
			});
			return;
		}
		if(callback && tab)callback(tab);
	});
}
// Open a tab the way Firefox's "Open Link in New Tab" does: linked to the
// source tab, placed after the tabs already opened from it, in the chosen container.
function openRelatedTab(url,srctab,active,ctr){
	chrome.tabs.query({windowId:srctab.windowId},function(tabs){
		var byid = {};
		tabs.forEach(function(t){byid[t.id] = t});
		tabs.sort(function(a,b){return a.index - b.index});
		var idx = srctab.index + 1;
		while(tabs[idx] && isDescendantOf(tabs[idx],srctab.id,byid)){
			idx++;
		}
		var opt = {url:url,active:active,index:idx,openerTabId:srctab.id,windowId:srctab.windowId};
		createTab(withContainer(opt,srctab,ctr || "current"),function(tab){
			tabparents[tab.id] = srctab.id;
			updateSuccessor(tab.windowId);
		});
	});
}
function sweepRemovedTabs(now){
	if(now - lastremovedsweep < removedttl)return;
	lastremovedsweep = now;
	for(var id in removedtabs){
		if(now >= removedtabs[id])delete removedtabs[id];
	}
}
function getParentId(tab){
	var parentid = tabparents[tab.id];
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
// Tree order: for a tab opened from another tab, the tab on its right under the
// same parent, else the one on its left, else the parent. Closing a parent moves
// its children up a level, so this repeats up the tree.
function treeSuccessor(visible,i,byid){
	var parentid = tabparents[visible[i].id];
	if(parentid === undefined)return null;
	var right = visible[i + 1];
	var left = visible[i - 1];
	if(right && isDescendantOf(right,parentid,byid))return right.id;
	if(left && (left.id === parentid || isDescendantOf(left,parentid,byid)))return left.id;
	if(byid[parentid])return parentid;
	return null;
}
// Next tab: the one on the right (below with vertical tabs), else the one on the left.
function nextSuccessor(visible,i){
	var tab = visible[i + 1] || visible[i - 1];
	return tab ? tab.id : chrome.tabs.TAB_ID_NONE;
}
// Previously active tab: the most recent tab in this window's history that is still open.
function prevSuccessor(windowid,crntid,byid){
	var list = activehistory[windowid] || [];
	for(var i = list.length - 1; i >= 0; i--){
		var tab = byid[list[i]];
		if(tab && tab.id !== crntid && !tab.hidden)return tab.id;
	}
	return null;
}
function updateSuccessor(windowid){
	var mode = getCloseMode();
	if(mode === "default")return;
	chrome.tabs.query({windowId:windowid},function(tabs){
		if(chrome.runtime.lastError)return;
		var byid = {};
		// A closing tab stays listed until its close animation ends.
		var visible = tabs.filter(function(t){
			if(removedtabs[t.id])return false;
			byid[t.id] = t;
			return !t.hidden;
		}).sort(function(a,b){return a.index - b.index});
		for(var i = 0; i < visible.length; i++){
			if(visible[i].active)break;
		}
		var crnt = visible[i];
		if(!crnt)return;
		var successor = null;
		if(mode === "tree"){
			successor = treeSuccessor(visible,i,byid);
		}else if(mode === "prev"){
			successor = prevSuccessor(windowid,crnt.id,byid);
		}
		if(successor === null)successor = nextSuccessor(visible,i);
		chrome.tabs.update(crnt.id,{successorTabId:successor},function(){
			void chrome.runtime.lastError;
		});
	});
}
// After a mode change, recompute every window. "Firefox default" clears the
// successors this extension set, so Firefox's own choice applies again.
function refreshSuccessors(){
	chrome.tabs.query({},function(tabs){
		if(chrome.runtime.lastError)return;
		tabs.forEach(function(t){
			if(getCloseMode() === "default"){
				if(t.successorTabId !== undefined && t.successorTabId !== chrome.tabs.TAB_ID_NONE){
					chrome.tabs.update(t.id,{successorTabId:chrome.tabs.TAB_ID_NONE},function(){
						void chrome.runtime.lastError;
					});
				}
			}else if(t.active){
				updateSuccessor(t.windowId);
			}
		});
	});
}
function rememberActive(windowid,tabid){
	var list = activehistory[windowid] || (activehistory[windowid] = []);
	forgetActive(windowid,tabid);
	list.push(tabid);
}
function forgetActive(windowid,tabid){
	var list = activehistory[windowid];
	if(!list)return;
	var idx = list.indexOf(tabid);
	if(idx !== -1)list.splice(idx,1);
}
function onTabsChanged(windowid){
	if(windowid !== undefined)updateSuccessor(windowid);
}
chrome.tabs.onActivated.addListener(function(info){
	rememberActive(info.windowId,info.tabId);
	onTabsChanged(info.windowId);
});
// Record every tab's opener, since Firefox stops reporting it once the opener closes.
function rememberParent(tab){
	if(tab.openerTabId !== undefined && tabparents[tab.id] === undefined){
		tabparents[tab.id] = tab.openerTabId;
	}
}
// With the "tabs I open myself" option, a tab with no opener goes under the tab
// you were on. Restores are skipped: a restored window is new, so it has no
// earlier tab, and restored background tabs are created unloaded (discarded).
function rememberSelfOpenedParent(tab){
	if(!optobj.selfparent || tabparents[tab.id] !== undefined || tab.discarded)return;
	var list = activehistory[tab.windowId] || [];
	for(var i = list.length - 1; i >= 0; i--){
		if(list[i] !== tab.id && !removedtabs[list[i]]){
			tabparents[tab.id] = list[i];
			return;
		}
	}
}
// Tree order: move a tab opened from another tab to the end of that tab's group.
// Firefox only knows the tabs it placed itself, and forgets them on tab switch.
function placeAfterSubtree(tabid,windowid){
	chrome.tabs.query({windowId:windowid},function(tabs){
		if(chrome.runtime.lastError)return;
		var byid = {};
		var tab = null;
		var others = tabs.filter(function(t){
			if(t.id === tabid){
				tab = t;
				return false;
			}
			if(removedtabs[t.id])return false;
			byid[t.id] = t;
			return true;
		}).sort(function(a,b){return a.index - b.index});
		if(!tab)return;
		var parentid = tabparents[tab.id];
		var pos = others.indexOf(byid[parentid]) + 1;
		if(pos === 0)return;
		while(others[pos] && isDescendantOf(others[pos],parentid,byid)){
			pos++;
		}
		var target = -1;
		if(others[pos]){
			target = others[pos].index;
			if(tab.index < target)target--;
		}else if(tab.index === tabs.length - 1){
			return;
		}
		if(target === tab.index)return;
		chrome.tabs.move(tab.id,{index:target},function(){
			void chrome.runtime.lastError;
		});
	});
}
chrome.tabs.onCreated.addListener(function(tab){
	rememberParent(tab);
	rememberSelfOpenedParent(tab);
	if(getCloseMode() === "tree" && tab.openerTabId !== undefined && !tab.discarded && !tab.pinned){
		placeAfterSubtree(tab.id,tab.windowId);
	}
	onTabsChanged(tab.windowId);
});
chrome.tabs.onMoved.addListener(function(id,info){onTabsChanged(info.windowId)});
chrome.tabs.onAttached.addListener(function(id,info){onTabsChanged(info.newWindowId)});
chrome.tabs.onDetached.addListener(function(id,info){
	forgetActive(info.oldWindowId,id);
	onTabsChanged(info.oldWindowId);
});
chrome.tabs.onRemoved.addListener(function(id,info){
	forgetActive(info.windowId,id);
	if(info.isWindowClosing)delete activehistory[info.windowId];
	var parentid = tabparents[id];
	var now = Date.now();
	sweepRemovedTabs(now);
	removedtabs[id] = now + removedttl;
	delete tabparents[id];
	if(parentid !== undefined && !info.isWindowClosing){
		for(var childid in tabparents){
			if(tabparents[childid] === id)tabparents[childid] = parentid;
		}
	}
	if(!info.isWindowClosing)onTabsChanged(info.windowId);
});
chrome.storage.onChanged.addListener(function(changes,area){
	if(area === "local" && changes.opt_obj && changes.opt_obj.newValue){
		setOption(changes.opt_obj.newValue);
	}
});
// Build the tree from the openers Firefox still reports, start each window's
// history with its current tab, then set its successor.
loadOption(function(){
	chrome.tabs.query({},function(tabs){
		if(chrome.runtime.lastError)return;
		tabs.forEach(rememberParent);
		tabs.forEach(function(t){
			if(!t.active)return;
			rememberActive(t.windowId,t.id);
			updateSuccessor(t.windowId);
		});
	});
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
		var url = request.url;
		whenOptionLoaded(function(){
			if(!checkExceptList(url,optobj.excpetoptionarray)){
		        sendResponse({request: "stat",opt:optobj});
			}else{
		        sendResponse({});
			}
		});
		return true;
    }else if(request.tab == "url"){
		var url = request.url;
		var tabid = sender.tab.id;
		if(url){
    		chrome.tabs.update(tabid,{url:url});
		}
        sendResponse({});
    }else if(request.tab == "new"){
		createTab(withContainer({url:request.url,active:true},sender.tab,request.ctr));
        sendResponse({});
    }else if(request.tab == "newbg"){
		createTab(withContainer({url:request.url,active:false},sender.tab,request.ctr));
        sendResponse({});
    }else if(request.tab == "newbgrel"){
		openRelatedTab(request.url,sender.tab,false,request.ctr);
        sendResponse({});
    }else if(request.tab == "newrel"){
		openRelatedTab(request.url,sender.tab,true,request.ctr);
        sendResponse({});
    }else if(request.tab == "close"){
		chrome.tabs.remove(sender.tab.id,function(){
			void chrome.runtime.lastError;
		});
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
