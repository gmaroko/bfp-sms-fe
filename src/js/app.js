import * as L from "leaflet";
import "leaflet.markercluster";
import List from "list.js";
import { fetchDevices, fetchDeviceHistory, logDeviceActivity} from "./api.js";
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

      // Handle Manage Device button inside popup
      layer.on("popupopen", () => {
        $("#manageDeviceBtn")
          .off("click")
          .on("click", () => {
            openManageDeviceModal(feature);
          });
      });
    },
  });

  function openManageDeviceModal(feature) {
    const currentStatus = feature.properties.serviceStatus;
    const possibleStatuses = ["CONNECT", "DISCONNECT", "SUSPEND"].filter(
      (s) => s !== currentStatus.slice(0, -2), // remove "ED" from status for comparison
    );

    const modalContent = `
    <h4>Manage Device - ${feature.properties.customerReference}</h4>
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

        alert(
          `Processing. Status will be updated to ${newStatus} with remarks: ${remarks}`,
        );
        try {
          // Disable Save button to prevent multiple clicks
          $("#saveStatusBtn").prop("disabled", true).text("Saving...");

          // Call API to update device status
          await logDeviceActivity(
            feature.properties.serial,
            newStatus,
            remarks,
            newStatus
          );

          // Success
          // $("#deviceDetailModal").modal("hide");

          // update status on the map popup
          feature.properties.serviceStatus = newStatus;
          layer.bindPopup(generatePopupContent(feature));
        } catch (err) {
          console.error("Failed to update device status:", err);
          alert("Failed to update device status. Please try again.");
        } finally {
          // Re-enable Save button
          $("#saveStatusBtn").prop("disabled", false).text("Save");
        }
      });
  }

  async function loadDeviceHistory(feature) {
    const $historySection = $("#deviceHistorySection");
    $historySection.html("<p>Loading history...</p>");

    try {
      // Mock API response — replace with real API call
      const history = await fetchDeviceHistory(feature.properties.serial);
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
          }),
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
