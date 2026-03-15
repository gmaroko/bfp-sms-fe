import * as L from 'leaflet';
import 'leaflet.markercluster';
import List from 'list.js';
import Bloodhound from 'bloodhound-js';
import { fetchDevices } from './api.js';

export function initMap() {
  let map, devicesLayer, markerClusters, deviceSearch = [], featureList;

  // Base map
  const cartoLight = L.tileLayer(
    'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', 
    { maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CartoDB' }
  );

  map = L.map('map', {
    zoom: 10,
    center: [0.187449, 37.478048],
    layers: [cartoLight],
    zoomControl: false,
    attributionControl: false
  });

  // Marker cluster
  markerClusters = new L.MarkerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 16
  }).addTo(map);

  // Devices layer
  devicesLayer = L.geoJson(null, {
    pointToLayer: (feature, latlng) => {
      return L.marker(latlng, {
        icon: L.icon({
          iconUrl: '/assets/img/sensor-color.png',
          iconSize: [24, 28],
          iconAnchor: [12, 28],
          popupAnchor: [0, -25]
        }),
        title: feature.properties.customerReference,
        riseOnHover: true
      });
    },
    onEachFeature: (feature, layer) => {
      const popupContent = `
        <table class='table table-striped table-bordered table-condensed'>
          <tr><th>Customer</th><td>${feature.properties.customerReference}</td></tr>
          <tr><th>Serial</th><td>${feature.properties.serial}</td></tr>
          <tr><th>Online Status</th><td>${feature.properties.onlineStatus}</td></tr>
          <tr><th>Last Ping</th><td>${feature.properties.lastPing}</td></tr>
          <tr><th>Service Status</th><td>${feature.properties.serviceStatus}</td></tr>
        </table>
      `;
      layer.bindPopup(popupContent);

      // Add to sidebar
      $('#feature-list tbody').append(`
        <tr class="feature-row" id="${L.stamp(layer)}" lat="${layer.getLatLng().lat}" lng="${layer.getLatLng().lng}">
          <td style="vertical-align: middle;"><img width="16" height="18" src="/assets/img/sensor-color.png"></td>
          <td class="feature-name">${layer.feature.properties.customerReference}</td>
          <td style="vertical-align: middle;"><i class="fa fa-chevron-right pull-right"></i></td>
        </tr>
      `);

      // Add to search
      deviceSearch.push({
        name: layer.feature.properties.customerReference,
        onlineStatus: layer.feature.properties.onlineStatus,
        source: 'Devices',
        id: L.stamp(layer),
        lat: layer.feature.geometry.coordinates[1],
        lng: layer.feature.geometry.coordinates[0]
      });
    }
  });

  map.addLayer(devicesLayer);
  markerClusters.addLayer(devicesLayer);

  // Sidebar sync
  function syncSidebar() {
    $("#feature-list tbody").empty();
    devicesLayer.eachLayer(layer => {
      $("#feature-list tbody").append(`
        <tr class="feature-row" id="${L.stamp(layer)}" lat="${layer.getLatLng().lat}" lng="${layer.getLatLng().lng}">
          <td style="vertical-align: middle;"><img width="16" height="18" src="/assets/img/sensor-color.png"></td>
          <td class="feature-name">${layer.feature.properties.customerReference}</td>
          <td style="vertical-align: middle;"><i class="fa fa-chevron-right pull-right"></i></td>
        </tr>
      `);
    });

    featureList = new List('features', { valueNames: ['feature-name'] });
    featureList.sort('feature-name', { order: 'asc' });
  }

  map.on('moveend', syncSidebar);

  // Expose addDevices method
  map.addDevices = function (deviceData) {
    devicesLayer.addData(deviceData);
    syncSidebar();
  };

  return map;
}