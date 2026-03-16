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
 * Fetch device history (mock function for now, TODO: update once API is available)
 * @param {string} deviceId - The ID of the device
 * @returns {Promise<Object>} - API response JSON
 */
export async function fetchDeviceHistory(deviceId) {
  if (!deviceId) throw new Error("Device ID is required");
  const url = `${import.meta.env.VITE_API_BASE_URL}/devices/activity/history/${deviceId}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to fetch device history: ${response.status} - ${text}`,
      );
    }

    const result = await response.json();
    return result?.data?.history || [];
  } catch (error) {
    console.error("Fetch history error:", error);
    return [];
  }
}

/**
 *
 * @param {string} deviceId
 * @param {string} command
 * @param {string} remarks
 * @returns
 */
export async function sendDeviceCommand(deviceId, command, remarks) {
  try {
    const url = `${import.meta.env.VITE_API_BASE_URL}/devices/activity`;

    const payload = {
      deviceId: deviceId,
      activityType: command, // "CONNECT", "DISCONNECT", etc.
      remarks: remarks,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Failed to register device activity");
    }

    return await response.json();
  } catch (err) {
    console.error("Error updating device status:", err);
    throw err;
  }
}
