var host = location.protocol+"//"+location.hostname+location.pathname;
var delem = null;
var cancelflg = false;
var addeventflag = false;
var eventtimerid = null;
var canselclickflag = false;
var mouseupflag = true;
var X,Y;
var optobj = {};
var downpos = {};
downpos.x = 0;
downpos.y = 0;

window.addEventListener("dragstart",onDrag,true);
window.addEventListener('drop', checkPostion,true);
// Firefox only sends "drop" to a page that accepts the drag while it passes
// over. Accept it only for a link drag with Drag Link on, so other drag and
// drop on the page is untouched.
function acceptLinkDrag(e){
	if(delem && !cancelflg && optobj && optobj.mdrag){
		e.preventDefault();
	}
}
window.addEventListener("dragenter",acceptLinkDrag,true);
window.addEventListener("dragover",acceptLinkDrag,true);
document.addEventListener("visibilitychange", function(e){
	canselclickflag = false;
	mouseupflag = true;
	clearTimeout(eventtimerid);
}, false);
// A press with Shift, Ctrl, Option/Alt or Cmd held is Firefox's own (new tab,
// context menu, ...), so it never starts a long-press or blocks the menu.
function hasModifier(e){
	return e.shiftKey || e.ctrlKey || e.altKey || e.metaKey;
}
// The menu opens on button down on macOS, so it is blocked on links up front
// when that option is on. Shift+right-click and Ctrl+click still open it.
function blocksMenu(e){
	if(!optobj.blockmenu || !optobj.r || optobj.r === "none")return false;
	if(e.button !== 2 || hasModifier(e))return false;
	// Close Current Tab works anywhere, so its hold needs the block anywhere too.
	if(optobj.r === "closetab" && !isEditable(e.target))return true;
	for(var elem = e.target; elem; elem = elem.parentNode){
		if(elem.tagName === "A")return true;
	}
	return false;
}
window.addEventListener("contextmenu",function(e){
	if(canselclickflag || blocksMenu(e)){
		e.preventDefault();
		e.stopPropagation();
	}
	canselclickflag = false;
},true);

// Load the settings up front and again whenever they change: on macOS the
// context menu event follows mousedown before settings requested there arrive.
function loadSettings(){
	chrome.runtime.sendMessage({stat:"init",url:host},function(resp){
		optobj = (resp && resp.opt && resp.opt.l) ? resp.opt : {};
	});
}
loadSettings();
chrome.runtime.onMessage.addListener(function(request){
	if(request.stat === "optchanged")loadSettings();
});
// After a middle-button hold runs its action, stop Firefox's own middle-click
// from also opening the link when the button is released. This has its own
// flag because a foreground tab hides the page, which clears canselclickflag.
var middleheldflag = false;
window.addEventListener("auxclick",function(e){
	if(e.button === 1 && (canselclickflag || middleheldflag)){
		e.preventDefault();
		e.stopPropagation();
		canselclickflag = false;
		middleheldflag = false;
	}
},true);
function addTag(){
	if(!addeventflag){
		addeventflag = true;
		window.addEventListener("mousedown",function(e){
			clearTimeout(eventtimerid);
			canselclickflag = false;
			middleheldflag = false;
			mouseupflag = false;
			cancelflg = false;
			delem = null;
			if(e.button === 0){
				X = e.screenX;
				Y = e.screenY;
			}else{
				X = 0;
				Y = 0;
			}
			checkA(e.target,e.button,e)
			if(e.target&&e.target.tagName === "IMG"){
				delem = null;
			}			
		},true);
		window.addEventListener("mouseup",function(e){
			clearTimeout(eventtimerid);
			mouseupflag = true;
		},true);
		// Moving cancels a hold anywhere on the page, so selecting text still works.
		window.addEventListener("mousemove",mouseMoveLink,true);
	}
}
function onDrag(e){
	mouseupflag = true;
	clearTimeout(eventtimerid);
}
function getSelectedNode(){
    if (document.selection)
    	return document.selection.createRange().parentElement();
    else{
    	var selection = window.getSelection();
    	if (selection.rangeCount > 0)return selection.getRangeAt(0).startContainer.parentNode;
    }
    return;
}
function checkA(elem,button,e,mode){
	if(elem.tagName&&elem.tagName === "A"){
		elem.removeEventListener("mousemove",mouseMoveLink,true);
		elem.addEventListener("mousemove",mouseMoveLink,true);
		elem.removeEventListener("click",clickLink,true);
		elem.addEventListener("click",clickLink,true);
		chrome.runtime.sendMessage({stat:"init",url:host},function(resp){
			if(!resp.opt || !resp.opt.l)return;
			optobj = resp.opt;
			if(hasModifier(e))return;
			if(button === 0 && optobj.l !== "none"){
				press(e,elem,button);
			}else if(button === 1 && optobj.m !== "none"){
				press(e,elem,button);
			}else if(button === 2 && optobj.r !== "none"){
				press(e,elem,button);
			}
			function press(e,elem,button){
				if(!mouseupflag){
					downpos.x = e.x;
					downpos.y = e.y;
					clearTimeout(eventtimerid);
					eventtimerid = setTimeout(function(){
						clickEmulate(elem,button);
						canselclickflag = true;
						if(button === 1)middleheldflag = true;
					},getWaitTime(button));
				}
			}
		});
		if(getSelectedNode() == elem){
			delem = null;
		}else{
			delem = elem;
		}
	}else if(elem.tagName&&elem.tagName === "BODY"){
		delem = null;
		pressOffLink(button,e);
	}else if(elem.parentNode){
		checkA(elem.parentNode,button,e,mode);
	}else{
		delem = null;
		pressOffLink(button,e);
	}
}
// Close Current Tab also works away from links. Text fields and scrollbars are
// left alone so holding there never closes the tab. Uses the settings the page
// already has, which are kept current when an action changes.
function pressOffLink(button,e){
	var action = [optobj.l,optobj.m,optobj.r][button];
	if(action !== "closetab" || hasModifier(e) || isEditable(e.target) || onScrollbar(e))return;
	clearTimeout(eventtimerid);
	downpos.x = e.x;
	downpos.y = e.y;
	eventtimerid = setTimeout(function(){
		canselclickflag = true;
		runAction(null,"closetab");
	},getWaitTime(button));
}
function isEditable(elem){
	if(!elem || !elem.tagName)return false;
	return elem.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(elem.tagName);
}
// Overlay scrollbars (macOS) sit over the content, so a press near the
// scrolling edge of the page or of any scrollable box counts as the scrollbar.
var scrollbaredge = 16;
function onScrollbar(e){
	var root = document.documentElement;
	if(e.clientX >= root.clientWidth || e.clientY >= root.clientHeight)return true;
	for(var el = e.target; el && el.nodeType === 1; el = el.parentElement){
		var isroot = el === root;
		var rect = isroot ? {left:0,top:0,right:window.innerWidth,bottom:window.innerHeight} : el.getBoundingClientRect();
		var style = window.getComputedStyle(el);
		var canscrolly = isroot ? root.scrollHeight > window.innerHeight
			: el.scrollHeight > el.clientHeight && /auto|scroll/.test(style.overflowY);
		var canscrollx = isroot ? root.scrollWidth > window.innerWidth
			: el.scrollWidth > el.clientWidth && /auto|scroll/.test(style.overflowX);
		var rtl = style.direction === "rtl";
		if(canscrolly && (rtl ? e.clientX <= rect.left + scrollbaredge : e.clientX >= rect.right - scrollbaredge))return true;
		if(canscrollx && e.clientY >= rect.bottom - scrollbaredge)return true;
	}
	return false;
}
// Per-button and per-direction values apply only when their split option is on.
function getWaitTime(button){
	if(optobj.splitwait){
		var val = [optobj.waitl,optobj.waitm,optobj.waitr][button];
		if(val !== undefined)return val - 0;
	}
	return optobj.waittime - 0;
}
function getDragDistance(dir){
	if(optobj.splitdx){
		var val = optobj["dx" + dir];
		if(val !== undefined)return val - 0;
	}
	return optobj.dxval - 0;
}
function checkPostion(e){
	var flg = null;
	if(delem&&!cancelflg&&X&&Y){
		cancelflg = true;
		if(optobj&&optobj.mdrag){
			e.preventDefault();
			e.stopPropagation();
			var x = e.screenX;
			var y = e.screenY;
			if(y >= (Y+getDragDistance("down"))){
				flg = "down";
			}else if(y <= (Y-getDragDistance("up"))){
				flg = "up";
			}else if(x >= (X+getDragDistance("right"))){
				flg = "right";
			}else if(x <= (X-getDragDistance("left"))){
				flg = "left";
			}
			if(flg){
				var elemType = window.document.activeElement.type;
				if((elemType != "text") && (elemType != "textarea")){
					if(flg === "up"){
						clickEmulate(delem,optobj.du,optobj.duurl,optobj.ductr);
					}else if(flg === "down"){
						clickEmulate(delem,optobj.dd,optobj.ddurl,optobj.ddctr);
					}else if(flg === "right"){
						clickEmulate(delem,optobj.dr,optobj.drurl,optobj.drctr);
					}else if(flg === "left"){
						clickEmulate(delem,optobj.dl,optobj.dlurl,optobj.dlctr);
					}
				}
				delem = null;
			}else{
				delem = null;
			}
		}else{
			delem = null;
		}
	}
}
function clickLink(e){
	clearTimeout(eventtimerid);
	if(canselclickflag){
		e.preventDefault();
		e.stopPropagation();
	}
	canselclickflag = false;
}
function mouseMoveLink(e){
	if(!mouseupflag){
		if(Math.abs(downpos.x - e.x) > 6){
			clearTimeout(eventtimerid);
			canselclickflag = false;
		}
		if(Math.abs(downpos.y - e.y) > 6){
			clearTimeout(eventtimerid);
			canselclickflag = false;
		}
	}
}
// Long press passes the mouse button; drag passes the action and its settings.
function clickEmulate(elem,button,wurl,ctr){
	if(button === 0){
		runAction(elem,optobj.l,optobj.lurl,optobj.lctr);
	}else if(button === 1){
		runAction(elem,optobj.m,optobj.murl,optobj.mctr);
	}else if(button === 2){
		runAction(elem,optobj.r,optobj.rurl,optobj.rctr);
	}else{
		runAction(elem,button,wurl,ctr);
	}
}
// New tab and window actions and the message each sends; they also take a
// container behavior.
var newtabactions = {bgrel:"newbgrel",newrel:"newrel",bg:"newbg",new:"new",window:"newwindow",windowbg:"newwindowbg"};
function runAction(elem,action,wurl,ctr){
	if(newtabactions[action]){
		chrome.runtime.sendMessage({tab:newtabactions[action],url:elem.href,ctr:ctr || "current"});
	}else if(action === "crnt"){
		chrome.runtime.sendMessage({tab:"url",url:elem.href});
	}else if(action === "copy"){
		chrome.runtime.sendMessage({tab:"copy",url:elem.href});
	}else if(action === "save"){
		chrome.runtime.sendMessage({tab:"save",url:elem.href});
	}else if(action === "web"){
		chrome.runtime.sendMessage({tab:"new",url:wurl+elem.href});
	}else if(action === "webbg"){
		chrome.runtime.sendMessage({tab:"newbg",url:wurl+elem.href});
	}else if(action === "privatewindow" || action === "privatewindowbg"){
		chrome.runtime.sendMessage({tab:action,url:elem.href});
	}else if(action === "closetab"){
		chrome.runtime.sendMessage({tab:"close"});
	}
}
addTag()
