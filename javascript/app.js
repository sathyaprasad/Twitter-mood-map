var map, initBasemap, popupDijit, twitterLayer, copyrightTimer, resizeTimer, heatLayer;

dojo.addOnLoad(init);

//First method to be called by Dojo after loading
function init(){
    console.log("init");    
    initMap();
}

/****** Map methods ******/
function initMap(){
    //define the geometry service
    esri.config.defaults.geometryService = new esri.tasks.GeometryService("//sampleserver3.arcgisonline.com/arcgis/rest/services/Geometry/GeometryServer");
    
    var initialExtent = new esri.geometry.Extent({
        "xmin": -8261213.093775354,
        "ymin": 4967920.451304093,
        "xmax": -8212752.017842619,
        "ymax": 4990087.189506764,
        "spatialReference": {
            "wkid": 102113
        }
    });
    initBasemap = new esri.layers.ArcGISTiledMapServiceLayer("//server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer");
    
    //define custom popup options
    
    var popupOptions = {
        'markerSymbol': new esri.symbol.SimpleMarkerSymbol('circle', 32, null, new dojo.Color([0, 0, 0, 0.35]))
    };
    
    var popupDijit = new esri.dijit.Popup(popupOptions, dojo.create("div"));
    //var popupDijit = new esri.dijit.Popup(null, dojo.create("div"));
    
    map = new esri.Map("map", {
        extent: initialExtent,
        slider: true,
        nav: false,
        logo: true,
        fitExtent: false,
        wrapAround180: true,
        infoWindow: popupDijit
    });
    
    dojo.connect(map, "onUpdateStart", function() {
		dojo.byId("loadingImage").style.display = "";
	});

	dojo.connect(map, "onUpdateEnd", function() {
		dojo.byId("loadingImage").style.display = "none";
	});
    
    //dojo.place(popupDijit.domNode, map.root);
    
    if (map.loaded) {
        onMapLoad();
    }
    else {
        dojo.connect(map, 'onLoad', function(){
            onMapLoad();
        });
    }
    dojo.connect(dijit.byId('map'), 'resize', resizeMap);
    map.addLayer(initBasemap);
    
}

function onMapLoad(){
    showScale();
    showCoords(map.extent.getCenter());
    showCopyright();
    showBasemapGallery();
    dojo.connect(map, "onMouseMove", showCoords);
    dojo.connect(map, "onExtentChange", showScale);
    //dojo.connect(map, "onUpdateStart", wipeIn);
    //dojo.connect(map, "onUpdateEnd", wipeOut);
    dojo.connect(map, "onLayerAdd", showCopyright);
    initTweets();
}

/* *********** Twitter methods **************** */
function initTweets(){
    try {
        twitterLayer = new social.twitter({
            map: map,            
            filterExtent: true
        });
    } 
    catch (e) {
        console.error(e);
    }
    
    dojo.connect(twitterLayer, "onUpdate", function(){
        dojo.byId("tweetstatus").innerHTML = "<img src='images/loading32.gif' width='16px'/> loading tweets ...";
        drawchart();
    });
    
    dojo.connect(twitterLayer, "onError", function(msg){
        console.log("**** Twitter Error ****");
		dojo.byId("tweetstatus").innerHTML = "Error!";
        console.log(msg);
    });
    
    dojo.connect(twitterLayer, "onUpdateEnd", function(){
        //console.info("Twitter layer updated");
        dojo.byId("tweetstatus").innerHTML = "Showing " + twitterLayer.getStats().geoPoints + " geo tweets.";
        
        if (twitterLayer.featureLayer.graphics.length === 0) {
            showNoTweetsSorry();
        }
        else {
            updateTweetCards();
            //map.setExtent(esri.graphicsExtent(twitterLayer.featureLayer.graphics));
        }
    });
    
    dojo.connect(map, "onExtentChange", updateTweetCards);
    
    dojo.connect(twitterLayer, "onClear", function(){
        drawchart();
    });
    
    //setup heatmap layer
    heatLayer = new modules.HeatLayer(null, {
        opacity: 0.9,
        dotRadius: 50,
        globalMax: true
    });    
    //heatLayer.setVisibility(false);
    map.addLayer(heatLayer,1);
    
    dojo.connect(map.infoWindow, "onSelectionChange", function(){
        //console.log("onSelectionChange event fired");
        dojo.query(".selectedTweet").removeClass("selectedTweet");
        var graphic = map.infoWindow.getSelectedFeature();
        if (graphic) {
            //console.log("Selected tweet: " + graphic.attributes.OBJECTID);
            var td = dojo.query("#tweetstablerow td#" + graphic.attributes.OBJECTID);
            //console.log(td);
            if (td[0]) {
                dojo.addClass(td[0], 'selectedTweet');
                dojo.window.scrollIntoView(td[0]);
            }
        }
    });
    
    dojo.connect(map.infoWindow, "onHide", function(){
        dojo.query(".selectedTweet").removeClass("selectedTweet");
    });
    
    var zoomtotweetsicon = dojo.byId('zoomtotweetsicon');
    dojo.connect(zoomtotweetsicon, "onclick", function(){
        if (twitterLayer.featureLayer.graphics && twitterLayer.featureLayer.graphics.length > 0) {
            map.setExtent(esri.graphicsExtent(twitterLayer.featureLayer.graphics), true);
        }
    });
}

function showNoTweetsSorry(){
	dojo.byId("tweetstatus").innerHTML = "No tweets to show!";
    var pane = dojo.byId("tweetsContentPane");
    pane.innerHTML = "";
    var content = "<h2>No Tweets to show. Try something different.</h2>";
    dojo.create("div", {
        "style": "height:100%;width:80%;margin:auto;font-size:15pt;text-align:center;min-height:300px;overflow-y:auto;",
        "innerHTML": content
    }, pane);
}

function updateTweetCards(){
    //console.log("inside updatetweetcards");
    if (twitterLayer && twitterLayer.featureLayer.graphics.length > 0) {
        dojo.byId("showTweetsImage").src = "images/twitter-bird-blue-49x30.png";
        dojo.byId("showHeatMapImage").src = "images/heatmap.png";
        
        
        
        if (dojo.query("#tweetstablerow td").length === twitterLayer.featureLayer.graphics.length) {
            //console.log("updatetweetcards: nothing to update");
            return;
        }
        //console.log("updatetweetcards: updating");
        var query = new esri.tasks.Query();
        var extent = twitterLayer.getExtent();
        //console.log(dojo.toJson(query.toJson()));
        if (!extent || isNaN(extent.xmax) || isNaN(extent.xmin)) {
            //this should not happen, check if you are parsing tweets correctly and/or check before adding point
            //console.log(dojo.toJson(extent.toJson()));
            query.geometry = map.extent;
        }
        else {
            query.geometry = extent;
        }
        
        twitterLayer.featureLayer.queryFeatures(query, function(featureSet){
        	
        	var points = dojo.map(featureSet.features,function(feature){				
				//return {x:feature.geometry.points[0][0],y:feature.geometry.points[0][1]};				
				return {x:feature.geometry.x,y:feature.geometry.y};
			});	
			
			heatLayer.setData(points);
			heatLayer.setVisibility(false);	
        	
            var pane = dojo.byId("tweetsContentPane");
            pane.innerHTML = "";
            var table = dojo.create("table", {
                id: "tweetstable",
                style: "width:100%;height:auto;"
            });
            var tr = dojo.create("tr", {
                id: "tweetstablerow"
            }, table);
            dojo.forEach(featureSet.features, function(feature){
                var attr = feature.attributes;
                //console.log(attr.id);
                //console.log(attr.place.length>0?attr.place:"");
                var td = dojo.create("td", {
                    innerHTML: "<div style='position:relative;width:100%;height:100%;'><img class='round' style='position:absolute;right:0px;top:0px;width:32px;z-index:5;' src='" + attr.profile_image_url + "' /><h2 style='margin:0 0 10px 0;display:block;'>" + attr.from_user + ":</h2>" + attr.text + "<br/><br/>" + (attr.place.length > 0 ? attr.place + "<br/>" : "") + attr.created_at + "</div>",
                    "id": attr.OBJECTID,
                    "class": 'round tweetbox',
                    "onclick": dojo.hitch(this, function(evt){
                        dojo.query(".selectedTweet").removeClass("selectedTweet");
                        dojo.addClass(evt.currentTarget, "selectedTweet");
                        var query = new esri.tasks.Query();
                        query.objectIds = [evt.currentTarget.id];
                        twitterLayer.featureLayer.selectFeatures(query, esri.layers.FeatureLayer.SELECTION_NEW, function(feature){
                            //display info window for feature  
                            if (feature) {
                                map.infoWindow.setFeatures(feature);
                                map.infoWindow.show(feature[0].geometry);
                                map.centerAt(feature[0].geometry);
                            }
                        });
                    })
                
                }, tr);
                //dojo.addClass(td, 'round tweetbox');
            });
            dojo.place(table, pane);
        });
    }
}

function updateTweets(option){
    //console.log(option);
	dojo.byId("tweetstatus").innerHTML = "";
    var searchterm = "";    
    switch (option) {
        case "happy":
            searchterm = ":) OR yay OR happy OR ;) OR :-)";
            break;
        case "sad":
            searchterm = ":( OR sad OR :-( OR ;(";
            break;
        case "retweet":
            searchterm = "RT";
            break;
        case "checkin":
            //searchterm = "4sq OR gowalla OR checkin OR foursquare filter:links";
            searchterm = "4sq OR gowalla OR checkin OR foursquare";            
            break;
        case "link":
            searchterm = "filter:links";
            break;
        case "question":
            searchterm = "?";
            break;
        case "pics":
            searchterm = "instagram OR flickr OR yfrog OR twitpic filter:links";
            break;
        case "facebook":
            searchterm = "facebook OR fb.me OR FB";
            break;
        case "text":
            searchterm = "";
            dojo.connect(dojo.byId("twittersearchbox"), "onkeydown", function(evt){
                //console.log(evt);
                if (evt) {
                    if (evt.keyCode != dojo.keys.ENTER) {
                        return;
                    }
                    twitterLayer.update(dojo.byId("twittersearchbox").value.trim());
                }
            });
            break;
    }
    
    if (searchterm && searchterm.length > 0) {
    	heatLayer.setData(null);    	
        twitterLayer.update(searchterm);
    }
}

function removeTweets(){

    dojo.byId("showTweetsImage").src = "images/twitter-bird-gray-49x30.png";
    dojo.byId("showHeatMapImage").src = "images/heatmap-gray.png";
    
    if (twitterLayer) {
        twitterLayer.clear();
    }
    var chkbxs = dojo.query("[name=selectmood]").filter(function(radio){
        return radio.checked;
    });
    dojo.forEach(chkbxs, function(radio){
        dijit.byId(radio.id).attr("checked", false);
    });
    
    dojo.byId("twittersearchbox").value = "";
    dojo.byId("tweetchartdiv").style.display = "none";
    
    showStartupContent();
}

function pieClick(){
    var chartdiv = dojo.byId("tweetchartdiv");
    if (chartdiv.style.display != "none") {
        chartdiv.innerHTML = "";
        chartdiv.style.display = "none";
    }
    else {
        chartdiv.style.display = "";
        drawchart();
    }
}

function drawchart(){
    var chartdiv = dojo.byId("tweetchartdiv");
    if (chartdiv.style.display != "none") {
        var stats = twitterLayer.getStats();
        if (stats.total > 0) {
            // Create our data table.
            var data = new google.visualization.DataTable();
            data.addColumn('string', 'Geoenabled');
            data.addColumn('number', 'Tweets');
            data.addRows([['GeoPoint', stats.geoPoints], ['Place', stats.geoNames], ['None', stats.noGeo]]);
            
            // Instantiate and draw our chart, passing in some options.
            var chart = new google.visualization.PieChart(document.getElementById('tweetchartdiv'));
            chart.draw(data, {
                width: dojo.style("tweetchartdiv", "width"),
                height: dojo.style("tweetchartdiv", "height"),
                legend: 'bottom',
                is3D: true,
                title: 'Twitter Feed Location Info'
            });
        }
        else {
            chartdiv.innerHTML = "Chart will appear here once tweets are available.";
        }
    }
}

/* *********** Twitter methods **************** */



function fadediv(id){
    dojo.fx.chain([dojo.fadeIn({
        node: id,
        duration: 3000
    }), dojo.fadeOut({
        node: id,
        duration: 5000
    })]).play();
}

function wipeIn(id){
    dojo.fx.wipeIn({
        node: id || "info"
    }).play();
}

function wipeOut(id){
    dojo.fx.wipeOut({
        node: id || "info"
    }).play();
}

function wipediv(id){
    dojo.fx.chain([dojo.fx.wipeIn({
        node: id
    }), dojo.fx.wipeOut({
        node: id
    })]).play();
}

/******* APP SPECIFIC **************/
function showAbout(){
    var pane = dojo.byId("tweetsContentPane");
    pane.innerHTML = "";
    var content = '<p><h2>App : </h2>';
    content += 'This app uses publicly available twitter data, pulled in real time using the Twitter API.';
    content += ' This whole app was created in less than a week from start to finish to showcase social layers, albeit minimal time has gone into the UI design and graphics.</p>';
    content += '<p><h2>How : </h2>Mapping: ArcGIS JavaScript API * Data: Twitter API * UI: Dojo Framework + HTML + CSS + JavaScript * Chart: Google Charts * IDE: Aptana</p>';
    content += '<p><h2>Who : </h2>Sathya Prasad (Developer, Applications Prototype Lab, Esri) - <a href="http://www.twitter.com/sathyaprasad"><img style="vertical-align:middle;" src="http://twitter-badges.s3.amazonaws.com/follow_me-b.png" alt="Follow sathyaprasad on Twitter"/></a></p>';
    content += '<p><h2>Disclaimer : </h2>This web application is not storing any tweets and is not affiliated with Twitter, Inc.</p>';
    
    dojo.create("div", {
        "style": "height:100%;width:80%;margin:auto;font-size:15pt;text-align:center;min-height:300px;overflow-y:auto;",
        "innerHTML": content
    }, pane);
    
    dojo.byId("tweetstatus").innerHTML = "";
}

function showStartupContent(){
    var pane = dojo.byId("tweetsContentPane");
    pane.innerHTML = "";
    
    var content = "<h2><img style='vertical-align:middle;' src='images/twitter-bird-blue-49x30.png' width='49px' height='30px'/>Getting started with twitter mood map</h2>";
    content += "<p>Discover and explore twitter moods :), links, retweets, checkins, tags or words in your city or across the globe.</p>";
    content += "<p>Click on the options above to find something interesting near you.</p>";
    content += "<p>&nbsp;</p>";
    content += '<img id="aboutImage" src="images/vcard.png" style="position:absolute;top:45px;right:5px;cursor:pointer;width:46px;vertical-align:middle;" onclick="showAbout();" alt="About" title="About"/>';
    
    dojo.create("div", {
        "class": "clickhere",
        "innerHTML": content
    }, pane);
    
    dojo.byId("tweetstatus").innerHTML = "Ready!";
}

dojo.ready(function(){
    //console.log("inside dojo.ready");
    
    showStartupContent();
    
    //UI code hookups						
    var locateaddrBox = dojo.byId("locateaddrBox");
    var searchicon = dojo.byId("searchicon");
    var locatemeicon = dojo.byId("locatemeicon");
    var zoomreseticon = dojo.byId("zoomreseticon");
    
    dojo.connect(locateaddrBox, "onkeydown", function(evt){
        //console.log(evt);
        if (evt) {
            if (evt.keyCode != dojo.keys.ENTER) {
                return;
            }
            locateAddress(locateaddrBox.value);
            removeTweets();
        }
    });
    
    dojo.connect(searchicon, "onclick", function(){
        if (dojo.trim(locateaddrBox.value).length > 0) {
            locateAddress(locateaddrBox.value);
            removeTweets();
        }
    });
    
    dojo.connect(locatemeicon, "onclick", function(){
        locateMe();
    });
    
    dojo.connect(zoomreseticon, "onclick", function(){
        zoomToFullExtent();
    });
    
    console.log("done with dojo.ready");
});

function showHideTweets() {	
	//check if tweets exisit
	if (twitterLayer.featureLayer.graphics.length < 1) {
		return;
	}	
	twitterLayer.featureLayer.visible ? twitterLayer.hide() : twitterLayer.show();	
}

function showHideHeatMap() {	
	//check if tweets exisit
	if (twitterLayer.featureLayer.graphics.length < 1) {
		return;
	}	
	heatLayer.visible? heatLayer.hide() : heatLayer.show();	
}


/******* APP SPECIFIC **************/

/********* Map helpers ********/
function zoomToFullExtent(){
    var initialExtent = new esri.geometry.Extent({
        "xmin": -8261213.093775354,
        "ymin": 4967920.451304093,
        "xmax": -8212752.017842619,
        "ymax": 4990087.189506764,
        "spatialReference": {
            "wkid": 102113
        }
    });
    map.setExtent(initialExtent, true);
}


function whereInTheWorldRequest(point){
	 var geocoder = new esri.tasks.Locator("//tasks.arcgis.com/ArcGIS/rest/services/WorldLocator/GeocodeServer");
        geocoder.outSpatialReference = map.spatialReference;
        geocoder.locationToAddress(point,500,function(result){			
			var addr = result.address;
			if (addr) {
				var content = "<i>World ";
				if (addr.Country) {
					content += "> " + addr.Country + "&nbsp;";
				}
				if (addr.State) {
					content += "> " + addr.State + "&nbsp;";
				}
				if (addr.City) {
					content += "> " + addr.City + "&nbsp;";
				}
				dojo.byId("whereintheworld").innerHTML = content + "&nbsp;";
			}
		},function(err){
			
		});    
}

function debug(val){
    if (dojo.config.isDebug) {
        console.log(val);
    }
}

function locateMe(){
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(location){
            if (location && location.coords) {
                //console.log(location.coords);
                //console.log(location.accuracy);
                var pt = esri.geometry.geographicToWebMercator(new esri.geometry.Point(location.coords.longitude, location.coords.latitude));
                if (location.accuracy < 10000) {
                    map.centerAndZoom(pt, 16);
                }
                else {
                    map.centerAndZoom(pt, 14);
                }
                var graphic = new esri.Graphic(pt, new esri.symbol.PictureMarkerSymbol('images/i_target.png', 38, 38));
                animateGraphicSymbol(graphic);
            }
            
        }, function(error){
            console.log(error);
        });
    }
}

function locateAddress(val){
    var address = dojo.trim(val);
    
    if (address && address !== "") {
        var geocoder = new esri.tasks.Locator("//tasks.arcgis.com/ArcGIS/rest/services/WorldLocator/GeocodeServer");
        geocoder.outSpatialReference = map.spatialReference;
        geocoder.addressToLocations({
            "SingleLine": address
        }, ['*'], function(geocodeResults){
            if (geocodeResults.length > 0) {
                var attr = geocodeResults[0].attributes;
                map.centerAt(geocodeResults[0].location);
                setTimeout(function(){
                    var fillSymbol = new esri.symbol.SimpleFillSymbol(esri.symbol.SimpleFillSymbol.STYLE_SOLID, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([255, 0, 0]), 3), new dojo.Color(0, 0, 0, 0));
                    animateGraphicSymbol(new esri.Graphic(map.extent.expand(0.8), fillSymbol));
                }, 500);
            }
            else {
                alert("Address not found");
            }
        }, function(err){
            debug(dojo.toJson(err));
        });
    }
}

//Handle resize of browser
function resizeMap(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
        map.resize();
        map.reposition();
    }, 800);
}

function showBasemapGallery(){
    var basemapGallery = new esri.dijit.BasemapGallery({
        showArcGISBasemaps: true,        
        map: map
    }, "basemapGallery");
    
    basemapGallery.startup();
    
    dojo.connect(basemapGallery, "onError", function(msg){
        //debug(msg);
    });
}

function showCopyright(){
    var copyrights = [];
    
    dojo.forEach(map.layerIds, function(id){
        if (map.getLayer(id).copyright && dojo.trim(map.getLayer(id).copyright).length > 0) {
            copyrights.push(dojo.trim(map.getLayer(id).copyright));
        }
        if (id === "layer_osm") {
            copyrights.push("Map data &copy; OpenStreetMap contributors, CC-BY-SA");
        }       
        else {
            debug("Attribution not available for " + id)
        }
    });
    
    
    if (copyrights.length > 0) {
    
        //dojo.byId("copyright").innerHTML = dojo.trim(map.getLayer(map.layerIds[0]).copyright);
        dojo.byId("copyright").innerHTML = copyrights[0];
    }
    
    if (copyrights.length > 1) {
        clearTimeout(copyrightTimer);
        var copyrightIndex = 0;
        copyrightTimer = setInterval(function(){
            dojo.byId("copyright").innerHTML = copyrights[copyrightIndex++ % copyrights.length];
        }, 10000);
    }
}

function showCoords(ext){
    var o = dojo.byId("coordsinfo");
    if (o === null || o === undefined) {
        console.error("coords div not defined");
        return;
    }
    
    try {
        var pnt = esri.geometry.webMercatorToGeographic(ext.mapPoint || ext);
        
        if (pnt === null || pnt === undefined) 
            return;
        
        //var latSuffix = (pnt.y < 0.0) ? "S" : "N";
        //var lonSuffix = (pnt.x < 0.0) ? "W" : "E";	
        o.innerHTML = "Lat: " + pnt.y.toFixed(2) + "&#176;" + ((pnt.y < 0.0) ? "S" : "N") + "&nbsp;&nbsp;Lon: " + pnt.x.toFixed(2) + "&#176;" + ((pnt.x < 0.0) ? "W" : "E");
        //o.innerHTML = "Lat: " + pnt.y.toFixed(2) + "&#176;&nbsp;&nbsp;Lon: " + pnt.x.toFixed(2) + "&#176;";
    } 
    catch (e) {
    
    }
}

function showScale(){
    try {
        var scale = Math.round(esri.geometry.getScale(map));
        if (scale > 999 && scale <= 999999) {
            scale = Math.round(scale / 1000) + " K";
        }
        else 
            if (scale > 999999) {
                scale = Math.round(scale / 1000000) + " M";
            }
            else 
                if (scale > 0 && scale <= 999) {
                    scale = Math.round(scale) + " Ft";
                }
        dojo.byId("scaleinfo").innerHTML = "Scale: 1 <b>:</b> " + scale;
        
        whereInTheWorldRequest(map.extent.getCenter());
    } 
    catch (e) {
    
    }
}

function animateGraphicSymbol(g){
    var opacity = 1.0;
    var color = g.symbol.color;
    var type = g.geometry.type;
    var symbol = g.symbol;
    //debug(type);
    if (type == "extent") {
        symbol.outline.color.a = opacity;
        symbol.color.a = 0.0;
    }
    else {
        symbol.color.a = opacity;
    }
    map.graphics.add(g);
    //debug(g.symbol.color);
    
    var interval = setInterval(function(){
        if (type != "extent") {
            symbol.setColor(new dojo.Color([color.r, color.g, color.b, opacity]));
        }
        if (symbol.outline) {
            var ocolor = symbol.outline.color;
            symbol.outline.setColor(new dojo.Color([ocolor.r, ocolor.g, ocolor.b, opacity]));
        }
        g.setSymbol(symbol);
        if (opacity < 0.01) {
            clearInterval(interval);
            map.graphics.remove(g);
        }
        opacity -= 0.01;
    }, 20);
}
