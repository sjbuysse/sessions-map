/*jshint esversion: 6 */
var module = (function(){
    //global variables for the google map, google infowindow, and viewmodel instance
    var map;
    var infoWindow;
    var vm;

    //Object that holds the methods that we need to access from outside this module
    var methods = {};

    //Model for places
    var Place = function(name, info, id, latlng, forecastJSON, forecastHTML, draggable){
        this.name = ko.observable(name);
        this.latlng = ko.observable(latlng);
        this.info = ko.observable(info);
        this.forecastJSON = ko.observable(forecastJSON);
        this.forecastHTML = ko.observable(forecastHTML);
        this.id = id;
        this.editing = ko.observable(false);
        this.draggable = ko.observable(draggable);
        this.visible = ko.observable(true);
        this.selected = ko.observable(false);
        //only create markers if the google API is working.
        if(typeof google){
            this.marker = this.createMarker();
        }
    };

    //I don't add the markers as a property of the place instance because it's easier to export the places to JSON this way (you can't export a marker instance), and I can still use the application without googlemaps
    //
    //Create a marker for the place
    Place.prototype.createMarker = function() {
        var self = this;
        var marker = new google.maps.Marker({
            position: self.latlng(),
            title: self.name(),
            id: self.id,
            map: map,
            draggable: true, 
            animation: google.maps.Animation.DROP
        });
        ko.computed(function(){
            marker.setVisible(self.visible());
        });
        ko.computed(function(){
            marker.setDraggable(self.draggable());
        });
        ko.computed(function(){
            marker.setPosition(self.latlng());
        });
        ko.computed(function(){
            if(self.draggable()){
                marker.setIcon( 'http://maps.google.com/mapfiles/ms/icons/green-dot.png');
            } else if(self.selected()) {
                marker.setIcon( 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png');
            } else {
                marker.setIcon( 'http://maps.google.com/mapfiles/ms/icons/red-dot.png');
            }
        });
        marker.addListener('click', (function(self){
            return function(){
                if(vm.setSelectedPlace(self)) {
                    vm.populateInfowindow(marker);
                }
            }
        })(self));
        return marker;
    };

    //Method to set the place in edit mode
    Place.prototype.setEditing = function(){
        this.editing(true);
        this.previousName = this.name();
        this.previousInfo = this.info();
    };

    Place.prototype.setDraggable = function() {
        this.draggable(true);
        this.previousLatLng = this.latlng();
    };

    Place.prototype.undoEditing = function(){
        this.editing(false);
        this.name(this.previousName);
        this.info(this.previousInfo);
    };

    Place.prototype.removeForecast = function() {
        this.forecastJSON(false);
        this.forecastHTML(false);
    };

    Place.prototype.saveEditing = function(){
        this.editing(false);
    };

    Place.prototype.updateLocation = function(){
        this.draggable(false);
        var newLocation = {
            lat: this.marker.getPosition().lat(),
            lng: this.marker.getPosition().lng()
        };
        this.latlng(newLocation);
    };


    Place.prototype.toPreviousLocation = function() {
        this.draggable(false);
        this.latlng(this.previousLatLng);
    };

    //Method to request forecast data from Worldweatheronline.com
    Place.prototype.requestForecast = function(){
        var self = this;
        var  _PremiumApiKey = "582f4a8e36294b81b54221346172602";
        var  _PremiumApiBaseURL = "http://api.worldweatheronline.com/premium/v1/";
        var input = {
            query : this.latlng().lat + "," + this.latlng().lng,
            format : "json",
            interval: 6
        };

        JSONP_MarineWeather(input);
        function JSONP_MarineWeather(input) {
            var url = _PremiumApiBaseURL + "marine.ashx?q=" + input.query + "&tp=" +input.interval + "&format=" + input.format +  "&key=" + _PremiumApiKey;
            jsonP(url, input.callback);
        }

        // Helper Method
        function jsonP(url) {
            //Fallback error message that shows itself if the ajax request hasn't been successful after 5seconds.
            var wikiRequestTimeout = setTimeout(function(){
                alert("Failed to get forecast data, make sure you're connected to the internet or that your firewall doesn't prevent you from accessing the worldweatheronline servers");
            }, 5000);
            $.ajax({
                type: 'GET',
                url: url,
                async: false,
                contentType: "application/json",
                dataType: 'jsonp',
                success: function (json) {
                    //Add today's forecast to the place instance 
                    self.forecastJSON(json.data.weather[0]);
                    self.forecastHTML(self.createForecastElement(json.data.weather[0]));
                    clearTimeout(wikiRequestTimeout);
                }
            });
        }
    };

    //Create HTML table for the forecast 
    Place.prototype.createForecastElement = function(data) {
        function createRow(headerName, property){
            var row = "<tr><th scope='row'>" + headerName + "</th>";
            data.hourly.forEach(function(forecast){
                row += "<td>" + forecast[property] + "</td>";
            });
            row += "</tr>";
            return row;
        }
        var date = data.date;
        var element = "<thead><tr>" + 
            "<th scope='row'>" + date + "</th>" + 
            "<th scope='col'>6AM</th>" + 
            "<th scope='col'>12AM</th>" + 
            "<th scope='col'>6PM</th>" + 
            "<th scope='col'>12PM</th>" + 
            "</tr></thead>";
        //Add row with swell info
        element += createRow("Swell (m):", "swellHeight_m");
        //Add row with Significant wave height
        element += createRow("Wave Heigth (m):", "sigHeight_m");
        //Add row with Swell direction
        element += createRow("Swell direction:", "swellDir16Point");
        //Add row with Swell period
        element += createRow("Period (s):", "swellPeriod_secs");
        //Add row with Wind direction
        element += createRow("Wind direction:", "swellDir16Point");
        //Add row with Wind speed
        element += createRow("Wind speed (kmph):", "windspeedKmph");
        //add footer row with attribution
        element += "<tfoot><tr><td colspan='5'>Source: www.worldweatheronline.com</td></tr></tfoot>";
            return element;
    };

    //This is the information we'd like to export, so that we exclude the marker property
    Place.prototype.export = function(){
        return {
            name: this.name,
            info: this.info,
            id: this.id,
            latlng: this.latlng
        }
    }

    //ViewModel
    var ViewModel = function(){
        var self = this;

        //Observables to keep track of the state of the UI
        this.showDrawer = ko.observable(false);
        this.showLargeInfoWindow = ko.observable(false);
        this.creatingPlace = ko.observable(false);

        //Methods to toggle state of UI
        this.toggleShowDrawer = function(){
            if(!self.selectedPlace().draggable()) {
                self.showDrawer(!self.showDrawer());
                if(self.showDrawer){
                    self.creatingPlace(false);
                }
            } else {
                alert("Please drag and save the green pin before doing something else.");
            }
        };
        this.toggleCreatingPlace = function(){
            if(self.googleDefined && !self.selectedPlace().draggable()){
                self.creatingPlace(!self.creatingPlace());
                if(self.creatingPlace){
                    self.showDrawer(false);
                    self.showLargeInfoWindow(false);
                }
            } else if(!self.googleDefined) {
                alert("You can't create a new place at the moment, because the google API has trouble loading.");
            } else if(self.selectedPlace().draggable()) {
                alert("Please drag and save the green pin before doing something else.");
            }
        };
        this.toggleShowLargeInfoWindow = function(){
            self.showLargeInfoWindow(!self.showLargeInfoWindow());
        };

        //Current value in the searchBox
        this.filterValue = ko.observable('');

        this.createPlace = function(name, info, id, latlng = {lat: map.getCenter().lat(),lng: map.getCenter().lng()}, forecastJSON = false, forecastHTML = false, draggable = false) {
            return new Place(name, info, id, latlng, forecastJSON, forecastHTML, draggable);
        };

        //When we click on a list item, we want to open up the infowindow and set the selectedPlace
        this.chooseListItem = function(place){
            self.toggleShowDrawer();
            //Check if marker exists (wouldn't be the case when google API failed to load)
            if(place.marker){
                google.maps.event.trigger(place.marker, 'click');
            } else{
                self.setSelectedPlace(place);
                self.showLargeInfoWindow(true);
            }
        };

        //Add location from our form to the places collection
        this.addLocation = function(){
            var name = self.newPlace.name();
            var latlng = {lat: map.getCenter().lat(),lng: map.getCenter().lng()};
            var info = self.newPlace.info();
            var id = self.newPlace.id;
            var draggable = true;
            var addedPlace = self.createPlace(name, info, id, latlng);
            addedPlace.setDraggable();
            self.toggleCreatingPlace();
            self.places.push(addedPlace);
            google.maps.event.trigger(addedPlace.marker, 'click');
            //Set up a new place for the next location creation.
            self.newPlace.name(""); 
            self.newPlace.info("");
            self.newPlace.id = self.places().length;
        };

        //Set the selectedPlace to the passed in place
        this.setSelectedPlace = function(place){
            if(this.selectedPlace() === place){
                return true;
            }
            //You can only change the selected place if you're not editing or dragging a place. 
            else if(this.selectedPlace().editing() || this.selectedPlace().draggable()){
                alert("Please save or cancel the changes you've made to the currently selected place before selecting another.");
                return false;
            } 
            //Set selected property of last selectedPlace to false;
            this.selectedPlace().selected(false);
            this.selectedPlace(place);
            //Set selected property of selectedPlace to true;
            this.selectedPlace().selected(true);
            return true;
        };

        //Remove place and associated marker from collection
        this.removeLocation = function(place){
            place.marker.setVisible(false);
            infoWindow.close();
            infoWindow.marker = null;
            self.places.remove(place);
            self.setSelectedPlace(self.places()[0]);
        };

        //Populate the infowindow with the correct marker information
        this.populateInfowindow = function(marker){
            if(infoWindow.marker != marker){
                infoWindow.marker = marker;
                infoWindow.open(map, marker);
                var contentHTML = "<div class='info-window' id='infoWindow'" + 
                    " data-bind='with: $root.selectedPlace()'>" + 
                    "<label class='info-window__name' data-bind='text: name'></label>" +
                    "<p data-bind='visible: draggable()'>" + 
                    "Drag and drop me in the correct location, then press 'Save Location'</p>" + 
                    "<button data-bind='click: $parent.toggleShowLargeInfoWindow," +
                    " visible: !draggable()'>Show all info</button>" +
                    "<button data-bind='click: setDraggable," + 
                    "visible: (!draggable())'>Move to new location</button>" +
                    "<button data-bind='visible: draggable(), click: updateLocation' >" + 
                    "Save location</button>" + 
                    "<button data-bind='visible: draggable(), click: toPreviousLocation' >" + 
                    "Reset location</button>" + 
                    "<button data-bind='click: $parent.removeLocation," + 
                    " visible: (!draggable())'>Remove spot</button>" +
                    "</div>";
                infoWindow.setContent(contentHTML);
                var query = marker.getPosition().lat() + "," + marker.getPosition().lng();

                //We need to apply the bindings for this new infowindow (because it didn't exist at the time of applying bindings to the ViewModel)
                ko.applyBindings(self, document.getElementById('infoWindow'));
                infoWindow.addListener('closeclick', function(){
                    infoWindow.marker = null;
                });
            }
        };

        this.closeInfoWindow = function(){
            if(self.googleDefined){
                infoWindow.close();
            }
            return true;
        };
    };

    //Return true if browser supports the File API
    ViewModel.prototype.supportFileAPI = function(){
        if (window.File && window.FileReader && window.FileList && window.Blob) {
            return true;
        } else {
            return false;
        }
    };

    //Handle imported location JSON file
    ViewModel.prototype.handleFileSelect = function(data, evt) {
        var self = this;
        var file = evt.target.files[0]; // FileList object

        // Loop through the FileList and render image files as thumbnails.

        var reader = new FileReader();

        // callback for when reader finished loading the file
        reader.onload = function(event) {
            localStorage.removeItem('session-places');
            var data = event.target.result;
            localStorage.setItem('session-places', data);
            location.reload();
        };

        // Read in the image file as a data URL.
        reader.readAsText(file);
    };

    ViewModel.prototype.exportLocations = function() {
        var self = this;
        console.save(ko.toJSON(self.exportPlaces()), 'sessions');
    };

    //Initialize all places and markers 
    ViewModel.prototype.init = function(places) {
        var self = this;
        // Collection of places, create a new Place object with observable properties for each of these places. 
        this.places = ko.observableArray(places.map(function(place){
            var newPlace = self.createPlace(place.name, place.info, place.id, place.latlng, place.forecastJSON, place.forecastHTML);
            return newPlace;
        }));

        //Source: I created this computed observable after getting some ideas from Tamas Crasser
        this.filterPlaces = ko.computed(function() {
            var filter = self.filterValue().toLowerCase();

            self.places().forEach(function(place) {
                if (place.name().toLowerCase().indexOf(filter) > -1) {
                    place.visible(true);
                } else {
                    place.visible(false);
                }
            });
        });

        this.selectedPlace = ko.observable(this.places()[0]);

        this.googleDefined = false;

        if(typeof google !== 'undefined'){
            this.googleDefined = true;
        }

        //Variable to hold the temporary new place during the creation process
        if(this.googleDefined){
            this.newPlace = self.createPlace("", "", self.places().length);
            this.newPlace.visible(false);
        }

        //exportPlaces is a computed array that we'll store the data in that we'd like to save to the localStorage (so we'll exclude the markers). This array has to be a computed (or observable) so that when it updates, it will let the computed variable that sets the localStorage item gets fired
        this.exportPlaces = ko.computed(function(){
            return self.places().map(function(place){
                return place.export();
            });
        });
        //
        // internal computed observable that fires whenever anything changes in our places
        // Source: todo-mvc (www.todo-mvc.com)
        ko.computed(function () {
            // store a clean copy to local storage, which also creates a dependency on
            // the observableArray and all observables in each item
            localStorage.setItem('session-places', ko.toJSON(this.exportPlaces));
        }.bind(this)).extend({
            rateLimit: { timeout: 500, method: 'notifyWhenChangesStop' }
        }); // save at most twice per second
    };

    function initViewModel(){
        // check local storage for places 
        var places = ko.utils.parseJson(localStorage.getItem('session-places'));
        var placesFromServer = ko.utils.parseJson(placeList);
        vm = new ViewModel();
        vm.init(places || placeList);
        ko.applyBindings(vm);
    }

    //Init viewmodel without google maps (if the API Fails to load)
    methods.initWithoutMap = function(){
        initViewModel();
        document.getElementById('map').innerHTML = "<p>It seems like we couldn\'t load the google maps API, you can still browse around the spots and read and the place information, but you won't be able to add any new places</p>";
    };

    //Init viewmodel with google maps
    methods.initMap = function(){
        //show world with center on New Zealand
        var mapOptions = {
            zoom: 5, 
            center: {
                lat: -40.900557,
                lng : 174.885971
            },
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                position: google.maps.ControlPosition.TOP_CENTER
            },
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER
            },
            scaleControl: true,
            streetViewControl: true,
            streetViewControlOptions: {
                position: google.maps.ControlPosition.RIGHT_CENTER
            },
        };
        map = new google.maps.Map(document.getElementById('map'), mapOptions);
        infoWindow = new google.maps.InfoWindow();

        initViewModel();
    };
    
    return methods;
})();
