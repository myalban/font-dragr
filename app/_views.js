FD.FontView = Backbone.View.extend({
	initialize: function () {
		var fonts = document.getElementById("fonts");
		
		_.bindAll(this, 'unactivateFont');
		this.model.bind('change', this.unactivateFont);
	},
	
	parent: document.getElementById("fonts"),
	
	events: {
		'click': 'handleFontChange'
	},
	
	tagName: 'li',
	
	className: '',
	
	template: FD.templates.fontView,
	
	handleFontChange: function (e,t) {
		var evt = e || event,
			elem = this.el,
			model = this.model;
		
		FD.fontListView.resetActiveState(model.get("name"));
		
		model.set({active: true});
		
		elem.className = "active";
		
		FD.fontEditorView.updateFont(model.get("name"));
	},
	
	unactivateFont: function () {
		this.el.className = "";
	},
	
	render: function () {
		this.className = (this.model.get("active")) ? "active" : "";
		this.el.innerHTML = this.template(this.model.toJSON());
		
		if(this.model.get("active")) {
			this.handleFontChange(this);
		}
		
		return this;
	}
});

FD.FontListView = Backbone.View.extend({
	id: document.getElementById("fonts"),
	
	tagName: "ul",
	
	initialize: function () {
		_.bindAll(this, 'addFont', 'render', 'handleDrop', 'preventActions');
		
		FD.fonts.bind("add", this.addFont);
		FD.fonts.add({
			name: "VomZom",
			size: "15kb",
			author: "D.Rock",
			authorurl: "http://defaulterror.com/typo.htm",
			license: "Free for personal and commercial use.",
			licenseurl: "http://defaulterror.com/typo.htm#Font%20License%20Information"
		});
		
		bean.add(document, {
		  drop: this.handleDrop,
		  dragenter: this.preventActions,
		  dragover: this.preventActions
		});
	},	
	
	addFont: function (font) {
		var fontView = new FD.FontView({model: font}),
			parent = document.getElementById("fonts");
		
		parent.appendChild(fontView.render().el);
	},
	
	addAllFonts: function() {
		_.each(FD.fonts.models, function(model, i, list) {
			this.addFont(model);
		});
	},
	
	render: function() {
		_.each(FD.fonts.models, function(model, i, list) {
			FD.fontListView.addFont(model);
		});
	},
	
	resetActiveState: function(name) {
		_.each(FD.fonts.models, function(model, i, list) {
			if(model.get("name") !== name) {
				model.set({active:false});
			}
		});
	},
	
	handleDrop: function (e) {
		var	dt = e.dataTransfer,
			// IE doesn't like anything other than "Text"
			data = ((/*@cc_on!@*/0) ? dt.getData("Text") : dt.getData("text/plain")),
			files = dt.files || false;
		
		if(files && !data) {
			this.parseDroppedFonts(files);
		} else {
			this.parseDataFonts(data);
		}
		
		e.preventDefault();
	},
	
	parseDroppedFonts: function (files) {
		var file, droppedFullFileName, droppedFileName, droppedFileSize, font,
			count = files.length,
			acceptedFileExtensions = /^.*\.(ttf|otf|woff)$/i,
			reader = new FileReader(),
			url = window.URL || window.webkitURL,
			objURL = url.createObjectURL || false;
		
		for (var i = 0; i < count; i++) {
			file = files[i];
			droppedFullFileName = file.name;
			
			if(droppedFullFileName.match(acceptedFileExtensions)) {
				droppedFileName = droppedFullFileName.replace(/\..+$/,""); // Removes file extension from name
				droppedFileName = droppedFileName.replace(/\W+/g, "-"); // Replace any non alpha numeric characters with -
				droppedFileSize = Math.round(file.size/1024) + "kb";
				
				// If the browser supports referencing a file without having to load it into memory let's use it
				if(objURL) {
					font = objURL(file);
					
					this.addFontFace({
						target: {
							result: font,
							name: droppedFileName,
							size: droppedFileSize
						},
						objectURL: true
					});
				} else {
					reader.name = droppedFileName;
					reader.size = droppedFileSize;
					
					/* 
					   Chrome 6 dev can't do DOM2 event based listeners on the FileReader object so fallback to DOM0
					   http://code.google.com/p/chromium/issues/detail?id=48367
					   reader.addEventListener("loadend", FD.App.addFontFace(event);, false);
					*/
					reader.onloadend = function (event) { FD.fontListView.addFontFace(event); };
					reader.readAsDataURL(file); 
				}
			} else {
				alert("Invalid file extension. Will only accept ttf, otf or woff font files");
			}
		}
	},
	
	parseDataFonts: function (data) {
		// Create crude JSON schema validator
		// Make sure data being parsed is valid JSON
		try {
			data = JSON.parse(data);
			if(!data.error) {
				var fontFileName = data.fontName.split("/").reverse()[0];
					fontFileName = fontFileName.replace(/\..+$/,"");
				
				data.fontSize = Math.round(data.fontSize/1024) + "kb";
				
				if(/*@cc_on!@*/0) {
					// IE can't do base64 fonts but it can load cross domain fonts. Pass url instead.
					data.fontDataURL = data.fontName;
				} else {
					data.fontDataURL = "data:application/octet-stream;base64," + data.fontDataURL;
				}
				
				this.addFontFace({
					target: {
						name: fontFileName,
						size: data.fontSize,
						license: data.fontLicense,
						licenseurl: data.fontLicenseUrl,
						author: data.fontAuthor,
						authorurl: data.fontAuthorUrl,
						result: data.fontDataURL
					}
				});
				
				delete data;
			} else {
				alert(data.error);
			}
		} catch(e) {
			alert("Data was not valid JSON.");
		}
	},
	
	addFontFace: function (data) {
		var target = data.target,
			name = target.name,
			size = target.size,
			license = target.license || "unknown",
			licenseurl = target.licenseurl || "",
			author = target.author || "unknown",
			authorurl = target.authorurl || "",
			font = target.result,
			isObjectURL = data.objectURL || false,
			dataURL, fontFaceStyle,
			styleSheet = document.styleSheets[0];
			
		if(!isObjectURL) {
			// Dodgy fork because Chrome 6 dev doesn't add media type to base64 string when a dropped file(s) type isn't known
			// http://code.google.com/p/chromium/issues/detail?id=48368
			dataURL = font.split("base64");
			
			if(!!~dataURL[0].indexOf("application/octet-stream")) {
				dataURL[0] = "data:application/octet-stream;base64";
				
				font = dataURL[0] + dataURL[1];
			}
		}
		
		// Get font file and prepend it to stylsheet using @font-face rule
		fontFaceStyle = ["@font-face{font-family: ",name,"; src:url(",font,");}"].join('');
		if(!!styleSheet.insertRule) {
			styleSheet.insertRule(fontFaceStyle, 0);
		} else {
			styleSheet.cssText = fontFaceStyle;
		}
		
		FD.fonts.add({
			name: name,
			size: size,
			license: license,
			licenseurl: licenseurl,
			author: author,
			authorurl: authorurl,
			active: true,
			objURL: (isObjectURL) ? font : false
		});
	},
	
	preventActions: function (evt) {
		evt = evt || window.event;
		if(evt.stopPropagation && evt.preventDefault) {
			evt.stopPropagation();
			evt.preventDefault();
		} else {
			evt.cancelBubble = true;
			evt.returnValue = false;
		}
	}
});

FD.FontEditorView = Backbone.View.extend({
	
	initialize: function () {
		_.bindAll(this, 'updateFont');
	},
	
	el: document.getElementById("wfs"),
	
	updateFont: function (font) {
		var fontname = document.getElementById("fontname");
		
		// Requery the DOM as element may not exist yet or it may not be on the page
		this.el = document.getElementById("wfs") || this.el;
		
		if(!!fontname) {
			fontname.innerHTML = font;
			fontname.style.fontFamily = font;
		}
		this.el.style.fontFamily = font;
	}
	
});

FD.FontGalleryView = Backbone.View.extend({
	
	initialize: function (models) {
		models = models || this.options;
		
		_.bindAll(this, 'template', 'render', 'className', 'requestFont', 'callback');
		
		_.each(models,this.render);
	},
	
	el: document.getElementById("subcontainer"),
	
	template: FD.templates.galleryView,
	
	events: {
		'click .button': 'addFont'
	},
	
	addFont: function (evt) {
		var font, 
			elem = evt.target,
			name = elem.getAttribute("data-font"),
			fonturl = elem.href;
		
		_.each(this.options,function(k,i){
			if(k.name === name) {
				font = k;
			}
		});
		
		this.requestFont(fonturl, elem);
		
		evt.preventDefault();
	},
	
	requestFont: function (url, elem) {
		var head = document.getElementsByTagName("head")[0],
			script = document.createElement("script");
		
		//elem.parentNode.className = "loading";
		
		if(script = document.getElementById('jsonFontData')) {
			script.parentNode.removeChild(script);
			// http://neil.fraser.name/news/2009/07/27/
			// Browsers won't garbage collect this object.
			// So castrate it to avoid a major memory leak.
			for (var prop in script) {
				try { delete script[prop]; } catch(e) { }
			}
		}
		
		// Append script tag and attribute to head
		script = document.createElement("script");
		script.id = "jsonFontData";
		script.src = url;
		
		head.appendChild(script);
	},
	
	fontData: '',
	
	callback: function (data, elem) {
		var font = document.getElementById(elem);
		
		this.fontData = data;
		
		font.title = "Drag and drop me!";
		
		bean.add(font,"dragstart",function(evt) {
			(!/*@cc_on!@*/0) ?
				// Normal browsers
				evt.dataTransfer.setData("text/plain", FD.fontGalleryView.fontData) :
				// IE6-8 will only accept setData("text")
				// setting this for every browser breaks ability to drag from different browser e.g. safari 4 to firefox 3.5 except IE7-8
				evt.dataTransfer.setData("Text", FD.fontGalleryView.fontData);
		});
		
		FD.fontListView.parseDataFonts(data);
	},
	
	render: function (model) {
		this.el = document.getElementById("gallery") || this.el;
		this.el.innerHTML += this.template(model);
		
		return this;
	}
});