// Data array of JSon objects representing places
var placeList = [{
        name: 'Piha',
        country: 'New Zealand',
        region: 'Auckland', 
    },{
        name: 'Robin hood Bay',
        country: 'New Zealand',
        region: 'Marlborough'
    },{
        name: 'Shingles Beach',
        country: 'New Zealand',
        region: 'West Coast'
    },{
        name: 'New Brighton',
        country: 'New Zealand',
        region: 'Canterburry'
    },{
        name: 'St Clair',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Karitane bar',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Tomahawk',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Brighton',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Blackhead',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Campbells Bay',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'All Day Bay',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Shag Beach',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Katiki Point',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Aramoana Spit',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Warrington',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Aramoana Spit',
        country: 'New Zealand',
        region: 'Otago'
    },{
        name: 'Moeraki',
        country: 'New Zealand',
        region: 'Otago'
    }
];

var map; 
var infoWindow;

//Model for places
var Place = function(name, latlng, info, id){
    this.name = ko.observable(name);
    this.latlng = ko.observable(latlng);
    this.info = ko.observable(info);
    this.id = id;
};

var ViewModel = function(places){
    var self = this;

    // Collection of places , check todo-mvc for how they arrange localStorage this way
    this.places = ko.observableArray(places.map(function(place){
        return new Place(place.name, place.latlng, place.info. place.id);
    }));

    this.currentPlace = ko.observable(this.places()[0]);

    this.markers = ko.observableArray([]);

    this.createLocation = function(){
        var location = {
            lat: map.getCenter().lat(),
            lng: map.getCenter().lng()
        }
        var place = new Place("kaas", location, "some information about this spot", this.places().length);
        this.places.push(place);
        this.currentPlace(this.places()[this.places().length-1]);
        this.createMarker(place);
    };

    this.createMarker = function(place) {
        var marker = new google.maps.Marker({
            position: place.latlng(),
            map: map,
            draggable: true, 
            animation: google.maps.Animation.DROP,
            title: place.name()
        });
        marker.addListener('click', function(){self.populateInfowindow(marker, place)});
        marker.addListener('dragend', function(){self.updateLocation(marker, place)});
        this.markers().push(marker);
    };

    this.populateInfowindow = function(marker, place){
        if(infoWindow.marker != marker){
          infoWindow.marker = marker;
          infoWindow.setContent("<h2 data-bind='text: $root.currentPlace().name'></h2>"+
                  "lat: " + "<span data-bind='text: $root.currentPlace().latlng().lat'>"</span>"+
                  "<p>lng: "+ place.latlng().lng +"</p>");
          infoWindow.open(map, marker);
          infoWindow.addListener('closeclick', function(){
                  infoWindow.marker = null;
              });
        }
    };

    this.updateLocation = function(marker, place){
        var newLocation = {
            lat: marker.getPosition().lat(),
            lng: marker.getPosition().lng()
        }
        place.latlng(newLocation);
    };
};



function initMap(){
    var geocoder = new google.maps.Geocoder();
    //show world with center on Belgium
    var mapOptions = {
        zoom: 2, 
        center: {lat: 51.5051449, lng: 6.408124099999999}
    };
    map = new google.maps.Map(document.getElementById('map'), mapOptions);
    var bounds = new google.maps.LatLngBounds();
    infoWindow = new google.maps.InfoWindow();
};

// check local storage for places 
var places = ko.utils.parseJson(localStorage.getItem('session-places'));
ko.applyBindings(new ViewModel(places || []));

// Make an observable array of markers , and add a filter function to the viewmodel that sets the map `null` for any marker that doesn't fit the filter. 
// Geocode the data first time and save in localstorage, then from then on use localstorage
