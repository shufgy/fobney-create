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
const datalayer = new VectorLayer({
  style: {
    'fill-color': 'rgba(255, 255, 255, 0.2)',
    'stroke-color': '#6600ff',
    'stroke-width': 2,
    'circle-radius': 7,
    'circle-fill-color': '#6600ff',
    },
});


const map = new Map({
  layers: [osm, raster, datalayer, vector, vecmobpos],
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
    var features = selectSingleClick.getFeatures();
    if (features.getLength() !== 0) {
        if (confirm('Delete selected features: Are you sure?')) {
            features.forEach(function (feature) {
                source.removeFeature(feature);
            });
        }
   } else {
     alert('Select some features with Select first in order to delete them');
   }
});

function deleteAllFeatures() {
    var features = source.getFeatures();
    features.forEach(function (feature) {
        source.removeFeature(feature);
    });
}

document.getElementById('delete-all').addEventListener('click', function () {
    var features = source.getFeatures();
    if (features.length !== 0) {
        if (confirm('Delete all created features: Are you sure?')) {
            deleteAllFeatures();
        }
   } else {
     alert('Create some features first in order to delete them');
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

objName.addEventListener('pointerdown', function () {
  if (objName.disabled == true) {
    alert('Please select an item to name by clicking Select and the item(s)!');
  }
});

objName.onchange = function () {
  name = objName.value;
  if (name !== null) {
      selectSingleClick.getFeatures().forEach(function (feature) {
          feature.set('name', name);
      });
  }
  updateNames();
};

var curdatalayer = '';

function showdatalayer(layername, filename) {
    const datasource = new VectorSource({
            url: 'https://the.earth.li/~huggie/fobney/data/'+filename,
            format: new GeoJSON(),
    });
    datalayer.setSource(datasource);
    curdatalayer = layername;
    var subbtn = document.getElementById('submit-data');
    subbtn.innerHTML = 'Submit '+layername+' data';
    subbtn.disabled = false;
};

async function refreshDataLayers() {
    const index = await fetch('https://the.earth.li/~huggie/fobney/data/index.json', {cache: "no-cache"});

    var addhtml = '';
    var js = await index.json();
    Object.keys(js).forEach(function(item) {
        const fileregextmp = `^${item}(-([0-9]+)-([a-zA-Z0-9-]+))?\.json`;
        const fileregex = new RegExp(fileregextmp);
        addhtml = addhtml + '<p><button type="button" id="show-layer-';
        addhtml = addhtml + item + '">Show base ' + item + ' data</button> &middot; ';
        addhtml = addhtml + 'Submitted data: <select id="sel-' + item + '">';
        var files = js[item];
        files.forEach((file) => {
            var match = fileregex.exec(file);
            var prettytext = '';
            if (match[2]) {
                var epoch = match[2];
                var comment = match[3];
                var filetime = new Date(Number(epoch+"000"));
                var t = filetime.toDateString() + ' ' + filetime.toTimeString();
                prettytext = comment + ' @ ' + t;
            } else {
                prettytext = item + ' base';
            }
            addhtml = addhtml + '<option value="'+file+'">'+prettytext+'</option>';
        });
        addhtml = addhtml + '</select> &middot;';
        addhtml = addhtml + '<button type="button" id="add-layer-';
        addhtml = addhtml + item + '">Show this data</button>';
        addhtml = addhtml + '</p>';

    });
    var datalayers = document.getElementById('datalayers');
    datalayers.innerHTML = addhtml;

    // Add the event listeners
    Object.keys(js).forEach(function(item) {
        document.getElementById('show-layer-'+item).addEventListener('click',
function () {
            showdatalayer(item, item+'.json');
        });
        document.getElementById('add-layer-'+item).addEventListener('click',
function () {
            var file = document.getElementById('sel-'+item);
            showdatalayer(item, file.value);
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    refreshDataLayers();
});


document.getElementById('hide-data').addEventListener('click', function () {
    datalayer.setSource(null);
    curdatalayer = '';
    document.getElementById('submit-data').disabled = true;
});


document.getElementById('submit-comment').addEventListener('click', async function () {
    var features = source.getFeatures();
    var comment = document.getElementById('comment').value;
    if (features.length == 0) {
        alert('Create some features first before submitting them!');
    } else if (!/^[a-zA-Z0-9-]+$/.test(comment)) {
        alert('Comment must only contain a-z A-Z 0-9 and -');
    } else {
        var text = new GeoJSON().writeFeatures(
          features,
          {
            featureProjection: 'EPSG:3857',
            dataProjection: 'EPSG:4326'
          }
        );
        const stream = new Blob([text], { type:
            'applicatio/json',}).stream();
        const gzipstream = stream.pipeThrough(new CompressionStream("gzip"));
        const gzresp = new Response(gzipstream);
        const gzblob = await gzresp.blob();
        const arraybuf = await gzblob.arrayBuffer();
        const b64data = btoa(String.fromCharCode(...new Uint8Array(arraybuf)));

        // https://the.earth.li/~huggie/cgi-bin/receive-data.pl?site=fobney&type=himalayan-balsam

        const baseuri = 'https://the.earth.li/~huggie/cgi-bin/receive-data.py'

        const response = await fetch(baseuri, {
          method: "POST",
          body: new URLSearchParams({
            site: "fobney",
            type: curdatalayer,
            "comment": comment,
            data: b64data
          }),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          }
        });

        const json = await response.json();
        if (json.error) {
            alert("Error: "+json.error);
        } else {
            refreshDataLayers();
            deleteAllFeatures();
            var div = document.getElementById('comment-pop-up');
            div.style.display = 'none';
            var c = document.getElementById('comment');
            c.value = '';

            alert("Saved "+json.filename);
        }
    }
});

document.getElementById('submit-data').addEventListener('click', async function () {
    var features = source.getFeatures();
    if (features.length == 0) {
     alert('Create some features first before submitting them!');
    } else {
        var div = document.getElementById('comment-pop-up');
        div.style.display = 'block';
    }
});
