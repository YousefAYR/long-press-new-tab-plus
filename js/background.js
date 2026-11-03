var optobj = {};
var tabparents = {};
var removedtabs = {};
var removedttl = 60000;
var lastremovedsweep = 0;
var activehistory = {};
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
	optobj = opt;
	if(getCloseMode() !== oldmode)refreshSuccessors();
}
function getCloseMode(){
	return optobj.closemode || "tree";
}
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
loadOption();
// Build the tree from the openers Firefox still reports, start each window's
// history with its current tab, then set its successor.
chrome.tabs.query({},function(tabs){
	if(chrome.runtime.lastError)return;
	tabs.forEach(rememberParent);
	tabs.forEach(function(t){
		if(!t.active)return;
		rememberActive(t.windowId,t.id);
		updateSuccessor(t.windowId);
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
