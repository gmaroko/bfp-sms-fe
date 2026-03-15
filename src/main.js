import './css/app.css';
import './css/login.css';
import './css/switch.css';
import { initMap } from './js/app.js';
import { fetchDevices } from './js/api.js';

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  const map = await initMap();

  // Fetch devices from API and add to map
  try {
    const devices = await fetchDevices();
    map.addDevices(devices);
  } catch (error) {
    console.error('Failed to load devices:', error);
  }
});