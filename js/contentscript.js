var host = location.protocol+"//"+location.hostname+location.pathname;
var delem = null;
var cancelflg = false;
var addeventflag = false;
var eventtimerid = null;
var canselclickflag = false;
var pressimg = null;
var mouseupflag = true;
var X,Y;
var optobj = {};
var downpos = {};
downpos.x = 0;
downpos.y = 0;

window.addEventListener("dragstart",onDrag,true);
window.addEventListener('drop', checkPostion,true);
]var DRAG_KEYS = {up:"du",down:"dd",left:"dl",right:"dr"};
]function onLinkImage(){
	return !!(pressimg && delem && delem.contains(pressimg));
}
function skipsImage(key){
	return onLinkImage() && (!optobj[key] || optobj[key] === "none" || (optobj[key + "img"] || "skip") === "skip");
}

function draggedLink(){
	if(!delem || cancelflg || !optobj || !optobj.mdrag)return null;
	if(onLinkImage() && Object.keys(DRAG_KEYS).every(function(d){return skipsImage(DRAG_KEYS[d])}))return null;
	return delem;
}
// Firefox only sends "drop" to a page that accepts the drag while it passes
// over. Accept it only for a link drag with Drag Link on, so other drag and
// drop on the page is untouched. With "as soon as the drag passes the
// distance", the action runs here instead, and the drop is then refused so the
// link just snaps back when released.
function acceptLinkDrag(e){
	if(!draggedLink())return;
	if(optobj.dragtrigger === "move" && X && Y){
		var flg = dragDirection(e);
		if(flg){
			cancelflg = true;
			runDragAction(flg);
			delem = null;
			return;
		}
	}
	e.preventDefault();
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
		if(elem.tagName === "A")return !skipsPressImage(elem,e.target,"r");
	}
	return false;
}
// Copy Link set to Don't run on an image: a press that starts on an image
// inside the link is left to Firefox, as if the button had no action.
function skipsPressImage(link,target,key){
	return optobj[key] === "copy" && optobj[key + "img"] === "skip" &&
		!!target && target.tagName === "IMG" && link.contains(target);
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
			pressimg = e.target && e.target.tagName === "IMG" ? e.target : null;
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
			if(skipsPressImage(elem,e.target,["l","m","r"][button]))return;
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
// The direction the drag has gone past its distance in, if any.
function dragDirection(e){
	var x = e.screenX;
	var y = e.screenY;
	if(y >= (Y+getDragDistance("down"))){
		return "down";
	}else if(y <= (Y-getDragDistance("up"))){
		return "up";
	}else if(x >= (X+getDragDistance("right"))){
		return "right";
	}else if(x <= (X-getDragDistance("left"))){
		return "left";
	}
	return null;
}
function runDragAction(flg){
	var elemType = window.document.activeElement.type;
	if((elemType == "text") || (elemType == "textarea"))return;
	var key = DRAG_KEYS[flg];
	if(!key || skipsImage(key))return;
	clickEmulate(delem,optobj[key],optobj[key + "url"],optobj[key + "ctr"],optobj[key + "img"]);
}
var CLICK_SLOP = 12;
function checkPostion(e){
	if(delem&&!cancelflg&&X&&Y){
		var dragging = draggedLink();
		cancelflg = true;
		if(dragging){
			e.preventDefault();
			e.stopPropagation();
			var flg = dragDirection(e);
			if(flg){
				runDragAction(flg);
			}else if(!hasModifier(e) && Math.abs(e.screenX - X) <= CLICK_SLOP && Math.abs(e.screenY - Y) <= CLICK_SLOP){
				setTimeout(function(){dragging.click()},0);
			}
		}
		delem = null;
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
function clickEmulate(elem,button,wurl,ctr,img){
	if(button === 0){
		runAction(elem,optobj.l,optobj.lurl,optobj.lctr,optobj.limg);
	}else if(button === 1){
		runAction(elem,optobj.m,optobj.murl,optobj.mctr,optobj.mimg);
	}else if(button === 2){
		runAction(elem,optobj.r,optobj.rurl,optobj.rctr,optobj.rimg);
	}else{
		runAction(elem,button,wurl,ctr,img);
	}
}
// New tab and window actions and the message each sends; they also take a
// container behavior.
var newtabactions = {bgrel:"newbgrel",newrel:"newrel",bg:"newbg",new:"new",window:"newwindow",windowbg:"newwindowbg"};

function copyImage(image,src){
	pageImageBytes(image).catch(function(){
		return fetch(src,{credentials:"include"}).then(function(resp){
			if(!resp.ok)throw new Error(resp.status);
			return resp.blob();
		}).then(function(blob){
			return blob.arrayBuffer().then(function(buf){return {data:buf,type:blob.type}});
		});
	}).then(function(bytes){
		chrome.runtime.sendMessage({tab:"copyimagedata",data:bytes.data,type:bytes.type});
	},function(){
		chrome.runtime.sendMessage({tab:"copyimage",url:src});
	});
}
function pageImageBytes(image){
	return new Promise(function(resolve,reject){
		var width = image.naturalWidth || image.width;
		var height = image.naturalHeight || image.height;
		if(!image.complete || !width || !height)return reject(new Error("not loaded"));
		var canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		canvas.getContext("2d").drawImage(image,0,0,width,height);
		canvas.toBlob(function(blob){
			if(!blob)return reject(new Error("no image"));
			blob.arrayBuffer().then(function(buf){resolve({data:buf,type:"image/png"})},reject);
		},"image/png");
	});
}
function runAction(elem,action,wurl,ctr,img){
	if(newtabactions[action]){
		chrome.runtime.sendMessage({tab:newtabactions[action],url:elem.href,ctr:ctr || "current"});
	}else if(action === "crnt"){
		chrome.runtime.sendMessage({tab:"url",url:elem.href});
	}else if(action === "copy"){
		var image = pressimg && elem && elem.contains(pressimg) ? pressimg : null;
		var src = image && (image.currentSrc || image.src);
		if(src && img === "image"){
			copyImage(image,src);
		}else{
			chrome.runtime.sendMessage({tab:"copy",url:src && img === "imageurl" ? src : elem.href});
		}
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
