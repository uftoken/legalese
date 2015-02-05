// xml2pdf-sleep.jsx
// An InDesign CS6 JavaScript
//
// the idletask thing really just faints after a while and doesn't wake up. here we do the sleep by hand.
//
// run it a second time to kill it.
//
//
// how do new files arrive in that tree?
// maybe we have a simple nodejs server that accepts XML uploads, pushes them through InDesign, and returns a PDF.
// 

#include "xml2pdf-lib.jsx"

main();

var lastIdle = new Date();

function main() {
  rootFolder = new Folder("~/Google Drive/Legalese Root"); // global so the event handler can see it
  if (! myTeardown()) mySetup();
}

function myTeardown() {
  var length = app.idleTasks.length;


// find some way to cache status so we can toggle it


  var didstop = false;
  for (var i = 0; i < length; i++) {
    var myIdleTask = app.idleTasks.item(i);
	  logToFile("xml2pdf-sleep: stopping");
	  alert ("stopping idle task");
	  didstop = true;
	}
  }
  return didstop;
}

function mySetup() {
  var myIdleTask = app.idleTasks.add({name:"xml2pdf", sleep:5000});
  var onIdleEventListener = myIdleTask.addEventListener("onIdle", onIdleEventHandler, false);
  alert("Starting idle task " + myIdleTask.name + "; added event listener on " + onIdleEventListener.eventType);
  logToFile("onIdleEventHandler: starting");

  lastIdle = new Date();

  // InDesign tends to fall asleep no matter what
}

function onIdleEventHandler(myIdleEvent) {
  var deltaT = new Date() - lastIdle;
  lastIdle = new Date();
  logToFile("onIdleEventHandler: idle for " + Math.floor(deltaT/1000) + "s");
  xml2pdf_main();
}

function xml2pdf_main(){

  var interactive = false;

  var xmlFiles = identifyXmlFiles("recurse", rootFolder); // recurse | queryUser
  var indtFile = identifyIndtFile("hardcoded", // hardcoded | queryUser
								  "~/non-db-src/legalese/build/00 legalese template.indt");
  if (xmlFiles.length > 0) {
	app.scriptPreferences.enableRedraw=interactive; 
	xmls2pdf(xmlFiles, indtFile, interactive);
	app.scriptPreferences.enableRedraw=true;
  }
}

