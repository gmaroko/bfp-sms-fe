import * as L from "leaflet";
import "leaflet.markercluster";
import List from "list.js";
import Bloodhound from "bloodhound-js";
import { fetchDevices } from "./api.js";

export async function initMap() {
  let map,
    devicesLayer,
    markerClusters,
    deviceSearch = [],
    featureList;

  // Base map
  const cartoLight = L.tileLayer(
    "https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "&copy; OpenStreetMap &copy; CartoDB" },
  );

  map = L.map("map", {
    zoom: 10,
    center: [0.187449, 37.478048],
    layers: [cartoLight],
    zoomControl: false,
    attributionControl: false,
  });

  // Marker cluster group
  markerClusters = new L.MarkerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 16,
  }).addTo(map);

  // Devices layer
  devicesLayer = L.geoJson(null, {
    pointToLayer: (feature, latlng) =>
      L.marker(latlng, {
        icon: L.icon({
          iconUrl: "/assets/img/sensor-color.png",
          iconSize: [24, 28],
          iconAnchor: [12, 28],
          popupAnchor: [0, -25],
        }),
        title: feature.properties.customerReference,
        riseOnHover: true,
      }),
    onEachFeature: (feature, layer) => {
      // Popup content
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
      $("#feature-list tbody").append(`
        <tr class="feature-row" id="${L.stamp(layer)}" lat="${layer.getLatLng().lat}" lng="${layer.getLatLng().lng}">
          <td style="vertical-align: middle;"><img width="16" height="18" src="/assets/img/sensor-color.png"></td>
          <td class="feature-name">${feature.properties.customerReference}</td>
          <td style="vertical-align: middle;"><i class="fa fa-chevron-right pull-right"></i></td>
        </tr>
      `);

      // Add to search
      deviceSearch.push({
        name: feature.properties.customerReference,
        onlineStatus: feature.properties.onlineStatus,
        source: "Devices",
        id: L.stamp(layer),
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
      });
    },
  });

  // Add devices to cluster group
  markerClusters.addLayer(devicesLayer);

  // Sidebar sync
  function syncSidebar() {
    // Clear the sidebar table
    $("#feature-list tbody").empty();

    // Add each device to the sidebar
    devicesLayer.eachLayer((layer) => {
      $("#feature-list tbody").append(`
      <tr class="feature-row" id="${L.stamp(layer)}" lat="${layer.getLatLng().lat}" lng="${layer.getLatLng().lng}">
        <td style="vertical-align: middle;"><img width="16" height="18" src="/assets/img/sensor-color.png"></td>
        <td class="feature-name">${layer.feature.properties.customerReference}</td>
        <td style="vertical-align: middle;"><i class="fa fa-chevron-right pull-right"></i></td>
      </tr>
    `);
    });

    // Initialize List.js for searching/sorting
    featureList = new List("features", { valueNames: ["feature-name"] });
    featureList.sort("feature-name", { order: "asc" });

    // Bind click event on sidebar rows to zoom/pan to marker
    $(".feature-row").on("click", function () {
      const lat = parseFloat($(this).attr("lat"));
      const lng = parseFloat($(this).attr("lng"));
      const markerId = $(this).attr("id");

      // Pan and zoom the map to the selected marker
      map.setView([lat, lng], 16);

      // Open the corresponding marker's popup
      devicesLayer.eachLayer((layer) => {
        if (L.stamp(layer) == markerId) {
          layer.openPopup();
        }
      });
    });
  }

  map.on("moveend", syncSidebar);

  map.addDevices = function (deviceData) {
    // Add GeoJSON data to devicesLayer (source for sidebar/search)
    devicesLayer.addData(deviceData);

    // Clear cluster group and add all markers from devicesLayer
    markerClusters.clearLayers();
    devicesLayer.eachLayer((layer) => {
      markerClusters.addLayer(layer);
    });

    // Update sidebar
    syncSidebar();
  };
  // Fetch devices from API immediately
  try {
    const devices = await fetchDevices();
    map.addDevices(devices);
  } catch (err) {
    console.error("Failed to load devices:", err);
  }

  return map;
}
