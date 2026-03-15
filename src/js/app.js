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
    { maxZoom: 19, attribution: "&copy; OpenStreetMap &copy; CartoDB" }
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

  // Helper: Icon by status
  function getDeviceIcon(status) {
    switch (status) {
      case "CONNECTED":
        return "/assets/img/sensor-color.png";
      case "DISCONNECTED":
        return "/assets/img/sensor-red.png";
      case "SUSPENDED":
        return "/assets/img/sensor-bw.png";
      default:
        return "/assets/img/sensor-color.png";
    }
  }

  // Devices layer
  devicesLayer = L.geoJson(null, {
    pointToLayer: (feature, latlng) =>
      L.marker(latlng, {
        icon: L.icon({
          iconUrl: getDeviceIcon(feature.properties.serviceStatus),
          iconSize: [24, 28],
          iconAnchor: [12, 28],
          popupAnchor: [0, -25],
        }),
        title: feature.properties.customerReference,
        riseOnHover: true,
      }),
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

  // Sidebar sync with optional status filter
  function syncSidebar(statusFilter = "ALL") {
    $("#feature-list tbody").empty();
    markerClusters.clearLayers(); // remove all markers from map

    devicesLayer.eachLayer((layer) => {
      const deviceStatus = layer.feature.properties.serviceStatus;

      if (statusFilter === "ALL" || deviceStatus === statusFilter) {
        // Update icon
        layer.setIcon(
          L.icon({
            iconUrl: getDeviceIcon(deviceStatus),
            iconSize: [24, 28],
            iconAnchor: [12, 28],
            popupAnchor: [0, -25],
          })
        );

        // Add to cluster
        markerClusters.addLayer(layer);

        // Add to sidebar
        $("#feature-list tbody").append(`
          <tr class="feature-row" id="${L.stamp(layer)}" lat="${layer.getLatLng().lat}" lng="${layer.getLatLng().lng}">
            <td style="vertical-align: middle;"><img width="16" height="18" src="${getDeviceIcon(deviceStatus)}"></td>
            <td class="feature-name">${layer.feature.properties.customerReference}</td>
            <td style="vertical-align: middle;"><i class="fa fa-chevron-right pull-right"></i></td>
          </tr>
        `);
      }
    });

    featureList = new List("features", { valueNames: ["feature-name"] });
    featureList.sort("feature-name", { order: "asc" });
  }

  // Click on sidebar row centers map
  $(document).on("click", ".feature-row", function () {
    const lat = $(this).attr("lat");
    const lng = $(this).attr("lng");
    map.setView([lat, lng], 16); // zoom in on user
  });

  // Dropdown filter for status
  $("#status-filter").on("change", function () {
    const selectedStatus = $(this).val();
    syncSidebar(selectedStatus);
  });

  // Expose addDevices method
  map.addDevices = function (deviceData) {
    const tempLayer = L.geoJson(deviceData, {
      pointToLayer: devicesLayer.options.pointToLayer,
      onEachFeature: devicesLayer.options.onEachFeature,
    });
    tempLayer.eachLayer((layer) => markerClusters.addLayer(layer));
    devicesLayer.addData(deviceData);
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