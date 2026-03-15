import { requireAuth } from "./utils/auth-util.js";
import { showLoader, hideLoader } from "./utils/loader.js";
requireAuth();



/**
 * Fetch devices from API
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - Returns array of device objects
 */
export async function fetchDevices(filters = {}) {
  showLoader();
  try {
    const deviceUrl = `${import.meta.env.VITE_API_BASE_URL}/devices/`;
    const response = await fetch(deviceUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filters: {
          deviceId: filters.deviceId || null,
          imeiNumber: filters.imeiNumber || null,
          location: filters.location || null,
          serviceStatus: filters.serviceStatus || null,
          onlineStatus: filters.onlineStatus || null,
        },
      }),
    });

    const result = await response.json();

    if (result.statusCode !== "00") {
      throw new Error(result.statusMessage);
    }

    return result.data.data || [];
  } catch (err) {
    console.error("Error fetching devices:", err);
    throw err;
  } finally {
    hideLoader();
  }
}

/**
 * Upload onboard file
 * @param {File} file - Excel/CSV file
 * @returns {Promise<Object>} - API response JSON
 */
export async function uploadOnboardFile(file) {
  if (!file) throw new Error("No file selected");

  showLoader();
  try {
    const formData = new FormData();
    formData.append("file", file);

    const uploadUrl = `${import.meta.env.VITE_API_BASE_URL}/devices/onboard-file`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed: ${text}`);
    }

    return await response.json();
  } catch (err) {
    console.error("Error uploading file:", err);
    throw err;
  } finally {
    hideLoader();
  }
}

/**
 * Update device service status
 * @param {string} deviceId - The ID of the device
 * @param {string} status - The new service status
 * @param {string} remarks - Any remarks for the status update
 * @returns {Promise<Object>} - API response JSON
 */
export async function updateDeviceStatus(deviceId, status, remarks) {
  if (!deviceId) throw new Error("Device ID is required");

  const url = `${import.meta.env.VITE_API_BASE_URL}/devices/${deviceId}/status`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${sessionStorage.getItem("token")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ serviceStatus: status, remarks }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update device status: ${text}`);
  }

  return response.json();
}