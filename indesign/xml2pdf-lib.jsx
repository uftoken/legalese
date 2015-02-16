// library used by
// xml2pdf      -- the interactive runtime
// xml2pdf-idle -- the idle task launched once which continuously monitors the Legalese Incoming folder
//
// mengwong@legalese.io mengwong@jfdi.asia 20150104

#include "/Applications/Adobe InDesign CC/Scripts/XML Rules/glue code.jsx"

// -------------------------------------------------- xmls2pdf
function xmls2pdf(xmlFiles, indtFile, showingWindow) {
  if (showingWindow == undefined) showingWindow = false;
  var errors = [];
  for (var i in xmlFiles) {
	var xmlFile = xmlFiles[i];
	try {
	  logToFile("xmls2pdf: starting " + xmlFile.fullName);
	  var doc = importXmlIntoTemplate(xmlFile, indtFile, showingWindow);
	  doc.recompose(); // force smart text reflow otherwise the signature fields won't add properly.
	  addCrossReferences(doc);
	  doc.recompose();
	  logToFile("xmls2pdf: about to constructFormFields");
	  constructFormFields(doc);
	  // findAndReplace(doc); change " to ''
	  // trim trailing newlines from the document. not quite sure how to do this.
	  doc.recompose();
	  logToFile("xmls2pdf: about to exportToPDF");
	  exportToPDF(doc, xmlFile);
	  logToFile("xmls2pdf: about to saveAsIndd");
	  saveAsIndd(doc, xmlFile);
	  if (! showingWindow) doc.close();
	  logToFile("xmls2pdf: finished " + xmlFile.fullName);
	}
	catch (error) {
	  saveFail(xmlFile, error);
	  errors.push(xmlFile.fullName + ": " + error);
	}
  }
  if (showingWindow && errors.length > 0) { alert (errors) }
}

// -------------------------------------------------- addCrossReferences
// i don't know how to do this. maybe we will need to
// convert the XML into IDML.
function addCrossReferences(doc) {
}


// -------------------------------------------------- isXmlOrFolder
function isXmlOrFolder(file) {
  return (file.constructor.name == "Folder"
		  || file.name.match(/\.xml$/));
}

// -------------------------------------------------- findXmls
function findXmls(folder) {
  var toreturn = [];
  var candidates = folder.getFiles(isXmlOrFolder);
  for (var i in candidates) {
	if (candidates[i].constructor.name == "File") {
	  toreturn.push(candidates[i]);
	}
	else {
	  var moreFiles = findXmls(candidates[i]);
	  for (var j in moreFiles) {
		toreturn.push(moreFiles[j]);
	  }
	}
  }
  return toreturn;
}

// -------------------------------------------------- identifyXmlFiles
function identifyXmlFiles(mode, rootFolder) {
  var xmlFiles = [];
  if (mode == "recurse") {
	// the idle task will monitor the incoming folder for XML files
	var todo = findXmls(rootFolder);
	for (var i in todo) {
	  var xmlFile = todo[i];
	  if (hasPDF(xmlFile) || hasFail(xmlFile)) { continue; }
	  else { xmlFiles.push(xmlFile); }
	}
  }
  else if (mode == "queryUser"
		  || mode == undefined) {
	xmlFiles = File.openDialog(
	  "Choose one or more source XML files to place into the Legalese template",
	  isXmlOrFolder,
	  true); // multiselect
  }
  return xmlFiles;
}

// -------------------------------------------------- identifyIndtFile
function identifyIndtFile(mode, path) {
  var indtFile;
  if (mode == "hardcoded") {
	indtFile = new File(path);
	if (indtFile.exists) return indtFile else mode = "queryUser";
  } 
  if (mode == "queryUser"
	  || mode == undefined
	 ) {
	indtFile = File.openDialog(
	  "Choose the Legalese template",
	  function(file) {
		return (file.constructor.name == "Folder"
				|| file.name.match(/\.indt$/));
	  },
	  false); // multiselect
  }
  return indtFile;
}

// -------------------------------------------------- importXmlIntoTemplate
function importXmlIntoTemplate(xmlFile, indtFile, showingWindow) {
  // here goes Chapter 12 of the Indesign Scripting Guide for JavaScript

  // iterate through each element. if its tag corresponds to a paragraph style (as opposed to a character style) then append a trailing newline unless the element already has one.

  var doc = app.open(indtFile, showingWindow);
  var importMaps = {};
  for (var i = 0; i < doc.xmlImportMaps.length; i++) {
	importMaps[doc.xmlImportMaps.item(i).markupTag.name] = doc.xmlImportMaps.item(i).mappedStyle;
  }

  doc.xmlElements.item(0).importXML(xmlFile);

  __processRuleSet(doc.xmlElements.item(0), [new AddReturns(doc,importMaps),
											 new InsertTextVariables(doc,importMaps)
											]);
//  alert("processRuleSet AddReturns completed successfully");

  doc.mapXMLTagsToStyles();


  // findReplaceFixes
  findReplaceFixes(doc, doc.stories);

  doc.stories.everyItem().recompose();

  __processRuleSet(doc.xmlElements.item(0), [new RestartParagraphNumbering(doc,importMaps)
											]);

  return doc;
}



// -------------------------------------------------- AddReturns
function AddReturns(doc, importMaps){
  this.name = "AddReturns";
  this.xpath = "//*";
  this.apply = function(myElement, myRuleProcessor){

	if ((myElement.xmlAttributes.item("addnewline").isValid &&
		 myElement.xmlAttributes.item("addnewline").value == "true")
		|| (importMaps[myElement.markupTag.name] != undefined
			&& importMaps[myElement.markupTag.name].constructor.name == "ParagraphStyle"
			&& importMaps[myElement.markupTag.name].name != "[Basic Paragraph]"
			&& myElement.markupTag.name != "Table"
			&& myElement.markupTag.name != "Cell"
			&& ! myElement.markupTag.name.match(/^cell/i)
			&& (! myElement.xmlAttributes.item("addnewline").isValid ||
				myElement.xmlAttributes.item("addnewline").value != "false")
			&& ! myElement.contents.match(/\r$/)
		   )
	   ) {
	  logToFile("appending newline to element " + myElement.markupTag.name);
      myElement.insertTextAsContent("\r", XMLElementPosition.ELEMENT_END);
	}
    return false;
  }
}

// -------------------------------------------------- findReplaceFixes
function findReplaceFixes(doc, stories) { 
    //Clear the find/change text preferences.
    app.findTextPreferences = NothingEnum.nothing;
    app.changeTextPreferences = NothingEnum.nothing;

    //Set the find options.
    app.findChangeTextOptions.caseSensitive = false;
    app.findChangeTextOptions.includeFootnotes = false;
    app.findChangeTextOptions.includeHiddenLayers = false;
    app.findChangeTextOptions.includeLockedLayersForFind = false;
    app.findChangeTextOptions.includeLockedStoriesForFind = false;
    app.findChangeTextOptions.includeMasterPages = false;
    app.findChangeTextOptions.wholeWord = false;

    // equivalent to the preset that replaces dumb doublequotes with smart doublequotes
    app.findTextPreferences.findWhat = '^"';
    app.changeTextPreferences.changeTo = '"';
    stories.everyItem().changeText();

    // equivalent to the preset that replaces dumb singlequotes with smart singlequotes
    app.findTextPreferences.findWhat = '^\'';
    app.changeTextPreferences.changeTo = '\'';
    stories.everyItem().changeText();

    // replace triple dashes with single emdash
    app.findTextPreferences.findWhat = '---';
    app.changeTextPreferences.changeTo = '^_';
    stories.everyItem().changeText();

    // equivalent to the preset that replaces a double dash with a single endash
    app.findTextPreferences.findWhat = '--';
    app.changeTextPreferences.changeTo = '^=';
    stories.everyItem().changeText();

    //Clear the find/change text preferences after the search.
    app.findTextPreferences = NothingEnum.nothing;
    app.changeTextPreferences = NothingEnum.nothing;
}


// -------------------------------------------------- InsertTextVariables
function InsertTextVariables(doc, importMaps){
  this.name = "InsertTextVariables";
  this.xpath = "//textvar";	
  this.apply = function(myElement, myRuleProcessor){
	var myInsertionPoint = myElement.insertionPoints.item(0);
	var textVariableInstance = myInsertionPoint.textVariableInstances.add({associatedTextVariable: doc.textVariables.item( myElement.xmlAttributes.item("name").value ) });
    return false;
  }
}

// TODO: look for a restart=true attribute and tell the paragraph bullet & numbering to restart.
// -------------------------------------------------- AddReturns
function RestartParagraphNumbering(doc, importMaps){
  this.name = "RestartParagraphNumbering";
  this.xpath = "//*[@restart='true']";
  this.apply = function(myElement, myRuleProcessor){

	myElement.paragraphs.item(0).numberingContinue = false;

    return false;
  }
}




// -------------------------------------------------- constructFormFields
function constructFormFields(doc) {
//  alert("constructFormFields running");

  // for each signature table in the signaturs page,
  // create a new textframe adjacent to the signature table, anchored,
  // and set the name of the field to be something that echosign will respect --
  // in other words, <sometext>_es_signer<n>_signature

  doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.points;
  doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.points;

//  alert("processRuleSet AddFormFields starting");
  __processRuleSet(doc.xmlElements.item(0), [new AddFormFields(doc)
											]);
//  alert("processRuleSet AddFormFields completed successfully");
}


// -------------------------------------------------- addFormFields
function AddFormFields(doc) {
  this.name = "AddFormFields";
  this.xpath = "//table_enclosing_para[@class='signatureblock' and @unmailed='true']";
  this.apply = function(el, myRuleProcessor){

// this won't work when running in background idle mode
//	app.layoutWindows.item(0).activePage = el.paragraphs.item(0).parentTextFrames[0].parentPage;
//	app.layoutWindows.item(0).zoom(ZoomOptions.FIT_PAGE);

	var myInsertionPoint = el.paragraphs.item(0).insertionPoints.item(2);

	// this is really weird. every other time i run this, it dies trying to add a signaturefield.
	if (! myInsertionPoint.isValid) {
	  logToFile("insertion point is invalid.");
	  alert("insertion point is invalid.");
	} else {
	  logToFile("insertion point is valid.");
	  if (myInsertionPoint.signatureFields != undefined) {
		logToFile("insertion point signaturefields is " + myInsertionPoint.signatureFields);
	  }		
		
//	  alert("insertion point is valid: " + myInsertionPoint);
	}

	logToFile("about to attempt .add(), which is a " + myInsertionPoint.signatureFields.add );
	
	var signatureField = myInsertionPoint.signatureFields.add();
	logToFile("created signatureField. setting anchored object settings. " +signatureField );

	with(signatureField.anchoredObjectSettings){
	  anchoredPosition = AnchorPosition.anchored;
	  anchorPoint = AnchorPoint.topLeftAnchor;
	  horizontalReferencePoint = AnchoredRelativeTo.anchorLocation;
	  horizontalAlignment = HorizontalAlignment.leftAlign;
	  anchorXoffset = -160; // this needs to match the template's columnWidth
	  verticalReferencePoint = VerticallyRelativeTo.lineBaseline;
	  anchorYoffset = 0;
	  anchorSpaceAbove = 0;
	  pinPosition = false;
	}

	logToFile("settings set. resizing. " +signatureField );
	signatureField.geometricBounds = [0,0,55,216];

	logToFile("resize complete. recomposing. " +signatureField );
	doc.recompose(); // recompose because adding that newline may have caused text to overset.

	logToFile("recompose complete. signatureField is " + signatureField);
	logToFile("recompose complete. signatureField.isValid is " + signatureField.isValid);
	logToFile("signatureField properties = "+ signatureField.properties.toString());
	logToFile("signatureField geometricbounds = "+ signatureField["geometricBounds"]);
	// https://secure.echosign.com/doc/TextFormsTutorial.pdf
	// http://bgsfin.com/Add-Ons/SmartFormsTutorial.pdf

	if (el.xmlAttributes.item("unmailed").isValid) {
	  logToFile("el.xmlAttributes.item(unmailed) = " + el.xmlAttributes.item("unmailed").value);
	  
	  if (el.xmlAttributes.item("unmailed").value == "true") {
		var signatureCount = el.xmlAttributes.item("esnum").value;
		signatureField.name = "legalese_es_signer" + signatureCount + "_signature";
	  }
	}
	
	doc.recompose();

	return false;
  }
}

// -------------------------------------------------- exportToPDF
function exportToPDF(doc, xmlFile) {
  var pdfPath = xmlFile.fsName.replace(/\.xml$/, ".pdf");
  with(app.interactivePDFExportPreferences){
	viewPDF = false;
  }
  doc.exportFile(ExportFormat.interactivePDF,
				 new File(pdfPath),
				 false);
}

// -------------------------------------------------- saveAsINDD
function saveAsIndd(doc, xmlFile) {
  var inddPath = xmlFile.fsName.replace(/\.xml$/, ".indd");
  doc.save(new File(inddPath));
}

// -------------------------------------------------- saveFail
function saveFail(xmlFile, contents) {
  var failPath = xmlFile.fsName.replace(/\.xml$/, ".fail");
  var file = new File(failPath);
  file.open("a");
  file.writeln(contents);
  file.close();
}

// -------------------------------------------------- hasPDF
function hasPDF(xmlFile) {
  var pdfPath = xmlFile.fsName.replace(/\.xml$/, ".pdf");
  return (new File(pdfPath)).exists;
}

// -------------------------------------------------- hasFail
function hasFail(xmlFile) {
  var failPath = xmlFile.fsName.replace(/\.xml$/, ".fail");
  return (new File(failPath)).exists;
}

// -------------------------------------------------- logToFile
function logToFile(message) {
  var logfile = new File("~/non-db-src/legalese/build/indesignlog.txt");
  logfile.open("a");
  logfile.writeln((new Date()) + "\t" + message);
  logfile.close();
}

