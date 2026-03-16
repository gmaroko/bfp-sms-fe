import * as L from "leaflet";
import "leaflet.markercluster";
import List from "list.js";
import { fetchDevices, fetchDeviceHistory, sendDeviceCommand } from "./api.js";
import { DEVICE_ACTIVITY_TYPE } from "./utils/common.js";

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
      // Popup content with Manage Device button
      const popupContent = `
    <table class='table table-striped table-bordered table-condensed'>
      <tr><th>Customer</th><td>${feature.properties.customerReference}</td></tr>
      <tr><th>Serial</th><td>${feature.properties.serial}</td></tr>
      <tr><th>Online Status</th><td>${feature.properties.onlineStatus}</td></tr>
      <tr><th>Last Ping</th><td>${feature.properties.lastPing}</td></tr>
      <tr><th>Service Status</th><td>${feature.properties.serviceStatus}</td></tr>
    </table>
    <button class="btn btn-primary btn-xs" id="manageDeviceBtn">Manage Device</button>
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

      // Handle Manage Device button inside popup
      layer.on("popupopen", () => {
        $("#manageDeviceBtn")
          .off("click")
          .on("click", () => {
            openManageDeviceModal(feature, layer);
          });
      });
    },
  });

  function openManageDeviceModal(feature, layer) {
    const currentStatus = feature.properties.serviceStatus;
    const possibleStatuses = ["CONNECT", "DISCONNECT", "SUSPEND"].filter(
      (s) => s !== currentStatus.slice(0, -2), // remove "ED" from status for comparison
    );

    const modalContent = `
    <h4>Device Reference : ${feature.properties.customerReference} | ${feature.properties.serial} <br> State: ${feature.properties.serviceStatus}</h4>
    <div class="btn-group" role="group" style="margin-bottom: 15px;">
      <button type="button" class="btn btn-primary" id="updateStatusBtn">Update Status</button>   
      <button type="button" class="btn btn-info" id="deviceHistoryBtn">Device History</button>
    </div>

    <div id="updateStatusForm" style="display:none; margin-top: 15px;">
      <form>
        <div class="form-group">
          <label>Current Status</label>
          <input type="text" class="form-control" value="${currentStatus}" readonly>
        </div>
        <div class="form-group">
          <label>New Status</label>
          <select class="form-control" id="newStatusSelect">
            ${possibleStatuses.map((s) => `<option value="${s}">${s}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Remarks</label>
          <textarea class="form-control" id="statusRemarks" rows="2"></textarea>
          <br>
          <label for="consent">
          <input type="checkbox" id="consent" name="consent" value="accepted" required>  I understand the implications of this change!
    </label>
        </div>
        <button type="button" class="btn btn-success" id="saveStatusBtn">Save</button>
      </form>
    </div>

    <div id="deviceHistorySection" style="display:none; margin-top: 15px;">
      <p>Loading history...</p>
    </div>
  `;

    $("#deviceDetailModal .modal-body").html(modalContent);
    $("#deviceDetailModal").modal("show");

    // Toggle between Update Status and Device History
    $("#updateStatusBtn")
      .off("click")
      .on("click", () => {
        $("#updateStatusForm").show();
        $("#deviceHistorySection").hide();
      });

    $("#deviceHistoryBtn")
      .off("click")
      .on("click", async () => {
        $("#updateStatusForm").hide();
        $("#deviceHistorySection").show();
        loadDeviceHistory(feature);
      });

    // Save status button click
    $("#saveStatusBtn")
      .off("click")
      .on("click", async () => {
        const newStatus = $("#newStatusSelect").val();
        const remarks = $("#statusRemarks").val().trim();
        const consentGiven = $("#consent").is(":checked");

        // Validation
        if (!consentGiven) {
          alert("You must acknowledge the implications by checking the box.");
          return;
        }

        if (!remarks) {
          alert("Please provide remarks for this change.");
          return;
        }

        alert(`Processing. Status will be updated to ${newStatus}.`);
        // Disable Save button while processing
        $("#saveStatusBtn").prop("disabled", true).text("Saving...");

        try {
          // Call backend activity API
          const result = await sendDeviceCommand(
            feature.id,
            newStatus,
            remarks,
          );

          // Success
          $("#deviceDetailModal").modal("hide");

          // Immediately update UI with PENDING status
          feature.properties.serviceStatus = "PENDING"; // temporary status
          layer.bindPopup(generatePopupContent(feature));

          alert(
            `Activity queued successfully. Request ID: ${result?.data?.requestId || "N/A"}`,
          );
          $("#deviceDetailModal").modal("hide");
        } catch (err) {
          console.log(`Failed to queue activity: ${err.message}`);
        } finally {
          $("#saveStatusBtn").prop("disabled", false).text("Save");
        }
      });
  }

  function generatePopupContent(feature) {
    return `
    <strong>Customer:</strong> ${feature.properties.customerReference}<br>
    <strong>Device ID:</strong> ${feature.properties.serial}<br>
    <strong>Status:</strong> ${feature.properties.serviceStatus}<br>
    <button class="btn btn-sm btn-primary" onclick="openManageDeviceModal(${JSON.stringify(feature).replace(/"/g, "&quot;")})"> Manage Device</button>
  `;
  }

  async function loadDeviceHistory(feature) {
    const $historySection = $("#deviceHistorySection");
    $historySection.html("<p>Loading history...</p>");

    try {
      // Mock API response — replace with real API call
      const history = await fetchDeviceHistory(feature.id);
      if (!history || history.length === 0) {
        $historySection.html("<p>No history available for this device.</p>");
        return;
      }

      const tableHtml = `
      <table class="table table-bordered table-condensed">
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Status</th>
            <th>Remarks</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          ${history
            .map(
              (h) => `
            <tr>
              <td>${h.timestamp}</td>
              <td>${h.action}</td>
              <td>${h.status}</td>
              <td>${h.remarks || "-"}</td>
              <td>${h.by}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;

      $historySection.html(tableHtml);
    } catch (err) {
      console.error("Failed to load device history:", err);
      $historySection.html("<p>Failed to load history. Please try again.</p>");
    }
  }

  // Add devices to cluster group

  // Sidebar sync with optional status filter
  function syncSidebar(statusFilter = "ALL") {
    $("#feature-list tbody").empty();
    markerClusters.clearLayers();

    devicesLayer.eachLayer((layer) => {
      const deviceStatus = layer.feature.properties.serviceStatus;

      if (statusFilter === "ALL" || deviceStatus === statusFilter) {
        layer.setIcon(
          L.icon({
            iconUrl: getDeviceIcon(deviceStatus),
            iconSize: [24, 28],
            iconAnchor: [12, 28],
            popupAnchor: [0, -25],
          }),
        );

        markerClusters.addLayer(layer);

        $("#feature-list tbody").append(`
        <tr class="feature-row" id="${L.stamp(layer)}" lat="${layer.getLatLng().lat}" lng="${layer.getLatLng().lng}">
          <td style="vertical-align: middle;">
            <img width="16" height="18" src="${getDeviceIcon(deviceStatus)}">
          </td>
          <td class="feature-name">${layer.feature.properties.customerReference}</td>
          <td style="vertical-align: middle;">
            <i class="fa fa-chevron-right pull-right"></i>
          </td>
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

  map.addDevices = function (deviceData) {
    devicesLayer.clearLayers(); // prevent duplicates on refresh
    devicesLayer.addData(deviceData);

    syncSidebar();
  };

  // Fetch devices from API immediately
  try {
    const devices = await fetchDevices();
    if (devicesLayer.getLayers().length > 0) {
      devicesLayer.clearLayers();
    }

    map.addDevices(devices);
  } catch (err) {
    console.error("Failed to load devices:", err);
  }
  return map;
}
