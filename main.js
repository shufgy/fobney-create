import './style.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/WebGLTile.js';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import GeoTIFFSource from 'ol/source/GeoTIFF.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import KML from 'ol/format/KML.js';
import Draw from 'ol/interaction/Draw.js';
import Modify from 'ol/interaction/Modify.js';
import Snap from 'ol/interaction/Snap.js';
import VectorLayer from 'ol/layer/Vector.js';
import {get} from 'ol/proj.js';
import VectorSource from 'ol/source/Vector.js';
import Select from 'ol/interaction/Select.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Circle from 'ol/style/Circle.js';
import Style from 'ol/style/Style.js';
import {circular} from 'ol/geom/Polygon';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import {fromLonLat} from 'ol/proj';
import {createEmpty} from 'ol/extent';
import {extend} from 'ol/extent';
import {containsExtent} from 'ol/extent';
import OSM from 'ol/source/OSM';

const fobney = new GeoTIFF({
    sources: [
        {
            url:
'https://the.earth.li/~huggie/fobney/fobney-map-background-transparent.tiff',
        },
    ]
});

const osm = new TileLayer({
      source: new OSM(),
      style: { gamma: 2 }
});

const raster = new TileLayer({
    source: fobney,
});

const source = new VectorSource();
const vector = new VectorLayer({
  source: source,
  style: {
    'fill-color': 'rgba(255, 255, 255, 0.2)',
    'stroke-color': '#ffcc33',
    'stroke-width': 2,
    'circle-radius': 7,
    'circle-fill-color': '#ffcc33',
  },
});
const mobpos = new VectorSource();
const vecmobpos = new VectorLayer({
  source: mobpos,
  style: {
    'fill-color': 'rgba(136, 51, 170, 0.2)',
    'stroke-color': '#8833aa',
    'stroke-width': 2,
    'circle-radius': 7,
    'circle-fill-color': '#8833aa',
  },
});

const map = new Map({
  layers: [osm, raster, vector, vecmobpos],
  target: 'map',
  view: new View({
    center: fromLonLat([-0.9845, 51.4381]),
    zoom: 13,
  }),
});
 
let draw, snap, modify; // global so we can remove them later
const typeSelect = document.getElementById('type');

let create = null;

function addInteractions() {
  draw = new Draw({
    source: source,
    type: typeSelect.value,
  });
  map.addInteraction(draw);
  draw.on('drawend', function (event) {
    let item = event.feature;
    item.set('name', '');
  });
  snap = new Snap({source: source});
  map.addInteraction(snap);
  modify = new Modify({source: source});
  map.addInteraction(modify);
  updateNames();
}

/**
 * Handle change event.
 */
typeSelect.onchange = function () {
  if (create !== null) {
      map.removeInteraction(draw);
      map.removeInteraction(snap);
      map.removeInteraction(modify);
      addInteractions();
  }
};

function download(data, filename) {
    var blob = new Blob([data], {type: 'text/plain'});
    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(blob, filename);
    } else {
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    }
  }

document.getElementById('download-geojson').addEventListener('click', function () {
    var text = new GeoJSON().writeFeatures(
      source.getFeatures(),
      {
        featureProjection: 'EPSG:3857',
        dataProjection: 'EPSG:4326'
      }
    );
    download(text, 'features.json');
  });

/*
document.getElementById('download-kml').addEventListener('click', function () {
    var text = new KML().writeFeatures(
      source.getFeatures(),
      {
        featureProjection: 'EPSG:3857',
        dataProjection: 'EPSG:4326'
      }
    );
    download(text, 'features.kml');
  });
*/

let select = null; // ref to currently selected interaction

const selected = new Style({
  fill: new Fill({
    color: '#FF0000',
  }),
  stroke: new Stroke({
    color: 'rgba(255, 0, 0, 0.7)',
    width: 2,
  }),
  image: new Circle({
    fill: new Fill({
      color: '#FF0000',
    }),
    stroke: new Stroke({
      color: 'rgba(255, 255, 255, 0.7)',
      width: 2,
    }),
    radius: 5,
  }),
});

function selectStyle(feature) {
  //const color = feature.get('COLOR') || '#FF0000';
  //selected.getFill().setColor(color);
  //selected.getImage().getFill().setColor(color);
  return selected;
}

const selectSingleClick = new Select({style: selectStyle});

document.getElementById('select').addEventListener('click', function () {
    create = null;
    map.removeInteraction(modify);
    map.removeInteraction(draw);
    map.removeInteraction(snap);

    select = selectSingleClick;
    map.addInteraction(select);
  });

document.getElementById('delete').addEventListener('click', function () {
    if (confirm('Are you sure?')) {
        selectSingleClick.getFeatures().forEach(function (feature) {
            source.removeFeature(feature);
        });
    }
});

let mobileid = null;
let moboptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
};

function mobloc(pos) {
    const coords = [pos.coords.longitude, pos.coords.latitude];
    const accuracy = circular(coords, pos.coords.accuracy);

    mobpos.clear(true);
    let point = new Feature(new Point(fromLonLat(coords)));
    mobpos.addFeatures([
      new Feature(
        accuracy.transform('EPSG:4326', map.getView().getProjection()),
      ),
        point
    ]);

    if (!mobpos.isEmpty()) {
        var mapExtent = map.getView().calculateExtent(map.getSize());
        var extentPoint = point.getGeometry().getExtent();
        /* If the point isn't in the viewport, zoom to the point */
        if (!containsExtent(mapExtent, extentPoint)) {
            /* Keep zoom level at level set */
            let zoom = map.getView().get('zoom');
            map.getView().fit(mobpos.getExtent(),{
                maxZoom: zoom,
                padding: [50,50,50,50],
            });
        }
    }
}

function moberror(error) { 
    alert(`ERROR: ${error.message}`);
    if (mobileid) {
        navigator.geolocation.clearWatch(mobileid);
    }
    mobileid = null;
    document.getElementById('mobileloc').innerHTML = 'Show location';
}


document.getElementById('mobileloc').addEventListener('click', function () {
    if (mobileid) {
        navigator.geolocation.clearWatch(mobileid);
        mobileid = null
        mobpos.clear(true);
        document.getElementById('mobileloc').innerHTML = 'Show location';
    } else {
        mobileid = navigator.geolocation.watchPosition(mobloc, moberror, moboptions);
        document.getElementById('mobileloc').innerHTML = 'Turn off location';
    }

});

document.getElementById('create').addEventListener('click', function () {
  create = 1
  //if (select)
  //  select.clear()
  map.removeInteraction(select);
  select = null;

  addInteractions();
});

var hideinst = 0;

function hideinstructions() {
  var div = document.getElementById('instructions');
  if (hideinst) {
    hideinst = 0;
    div.style.display = 'block';
  } else {
    hideinst = 1;
    div.style.display = 'none';
  }
}


document.getElementById('inst').addEventListener('click', hideinstructions);
document.getElementById('instructions').addEventListener('click', hideinstructions);

const objName = document.getElementById('objname');

function updateNames() {
  let text = '';
  let count = 0;
  selectSingleClick.getFeatures().forEach(function (feature) {
      name = feature.get('name');
      if (name) {
        if (text !== '') {
            text = text + ','
        }
        text = text + name
      }
      count++;
  });
  objName.value = text;
  if (count == 0) {
    objName.disabled = true;
  } else {
    objName.disabled = false;
  }
}

selectSingleClick.on('select', updateNames);

objName.onchange = function () {
  name = objName.value;
  if (name !== null) {
      selectSingleClick.getFeatures().forEach(function (feature) {
          feature.set('name', name);
      });
  }
  updateNames();
};

