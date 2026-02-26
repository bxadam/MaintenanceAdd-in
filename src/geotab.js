/**
 * geotab.js
 * Geotab MyGeotab API integration layer.
 *
 * This file handles:
 *  - Connecting to the Geotab API via the addin `initialize` callback
 *  - Polling live odometer (StatusData) for all tracked vehicles
 *  - Detecting triggered reminders and surfacing notifications
 *  - Providing a mock/demo mode when running outside of MyGeotab
 *
 * HOW TO USE:
 *  1. Host this add-in via GitHub Pages (see README.md).
 *  2. Register addin.json in your MyGeotab database under
 *     Administration → System → System Settings → Add-ins.
 *  3. The `initialize(freshApi, state, callback)` function is called
 *     automatically by MyGeotab when the page loads.
 */

const GeotabIntegration = (() => {

  // Geotab diagnostic ID for odometer (standard across most vehicles)
  const ODOMETER_DIAGNOSTIC_ID = 'DiagnosticOdometerAdjustmentId';

  // Poll interval in milliseconds (30 seconds)
  const POLL_INTERVAL_MS = 30_000;

  let _api = null;          // Geotab API object injected by MyGeotab
  let _pollTimer = null;
  let _vehicles = [];       // Cache of device objects from Geotab
  let _demoMode = false;

  // ── Public API ──────────────────────────────────────────────────────────────

  const init = async (api) => {
    _api = api;

    if (!_api) {
      console.warn('GeotabIntegration: No API object provided — running in demo mode.');
      _demoMode = true;
      _startDemoMode();
      return;
    }

    try {
      await _loadVehicles();
      await _pollOdometers();
      _pollTimer = setInterval(_pollOdometers, POLL_INTERVAL_MS);
      _setSyncStatus(true);
    } catch (err) {
      console.error('GeotabIntegration: Failed to initialise.', err);
      _setSyncStatus(false);
    }
  };

  const destroy = () => {
    if (_pollTimer) clearInterval(_pollTimer);
  };

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Fetch all Devices (vehicles) from Geotab and cache them.
   * We map Geotab device names to the vehicle IDs used in our reminders.
   */
  const _loadVehicles = async () => {
    const devices = await _api.call('Get', {
      typeName: 'Device',
      resultsLimit: 500,
    });

    _vehicles = devices.map(d => ({
      id: d.id,
      name: d.name,        // e.g. "TRK-041"
      licensePlate: d.licensePlate,
    }));

    // Populate vehicle filter dropdown with real names
    const select = document.getElementById('vehicleFilter');
    if (select) {
      _vehicles.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = v.name;
        select.appendChild(opt);
      });
    }
  };

  /**
   * Poll odometer StatusData for all vehicles and update the DataStore.
   * After updating, check if any reminders have been triggered.
   */
  const _pollOdometers = async () => {
    if (!_api || !_vehicles.length) return;

    try {
      // Batch request: get latest odometer for all tracked vehicle IDs
      const trackedVehicleNames = DataStore.getUniqueVehicles();
      const trackedDevices = _vehicles.filter(v =>
        trackedVehicleNames.includes(v.name)
      );

      const promises = trackedDevices.map(device =>
        _api.call('Get', {
          typeName: 'StatusData',
          search: {
            deviceSearch: { id: device.id },
            diagnosticSearch: { id: ODOMETER_DIAGNOSTIC_ID },
            fromDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // last 1hr
          },
          resultsLimit: 1,
        }).then(results => ({
          vehicleName: device.name,
          odometer: results.length ? Math.round(results[0].data * 0.000621371) : null, // metres → miles
        }))
      );

      const readings = await Promise.all(promises);

      readings.forEach(({ vehicleName, odometer }) => {
        if (odometer !== null) {
          const changed = DataStore.updateOdometer(vehicleName, odometer);
          if (changed) {
            // Re-render if the app is already initialised
            if (window.app) window.app.refreshAll();
          }
        }
      });

      // Check for newly triggered reminders and show notifications
      _checkForTriggeredReminders();
      _updateSyncLabel();

    } catch (err) {
      console.error('GeotabIntegration: Odometer poll failed.', err);
      _setSyncStatus(false);
    }
  };

  /**
   * Find any reminders that are overdue and haven't been notified yet,
   * then surface them via the app notification system.
   */
  const _checkForTriggeredReminders = () => {
    const reminders = DataStore.getReminders();
    const triggered = reminders.filter(r => r.status === 'overdue' && !r.notified);

    if (triggered.length > 0 && window.app) {
      // Show the most urgent one first
      triggered.sort((a, b) => {
        const priorityOrder = { High: 0, Medium: 1, Low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      const r = triggered[0];
      const over = r.current - r.target;
      window.app.showNotification(r, over);

      // Mark as notified so we don't re-show immediately
      DataStore.updateReminder(r.id, { notified: true });
    }
  };

  const _setSyncStatus = (connected) => {
    const el = document.getElementById('syncLabel');
    const dot = document.querySelector('.sync-dot');
    const wrap = document.querySelector('.sync-status');
    if (!el) return;

    if (connected) {
      el.textContent = 'LIVE · Synced with Geotab';
      wrap && wrap.classList.remove('disconnected');
    } else {
      el.textContent = 'Disconnected';
      wrap && wrap.classList.add('disconnected');
    }
  };

  const _updateSyncLabel = () => {
    const el = document.getElementById('syncLabel');
    if (el) el.textContent = `LIVE · Synced ${_timeAgo(new Date())}`;
  };

  const _timeAgo = (date) => {
    const diff = Math.round((Date.now() - date.getTime()) / 1000);
    if (diff < 5)  return 'just now';
    if (diff < 60) return `${diff}s ago`;
    return `${Math.round(diff / 60)}m ago`;
  };

  // ── Demo Mode ────────────────────────────────────────────────────────────────

  /**
   * Demo mode simulates Geotab odometer data without a real API connection.
   * The 🔔 bell button in the header triggers a simulated notification.
   */
  const _startDemoMode = () => {
    _setSyncStatus(true);
    const el = document.getElementById('syncLabel');
    if (el) el.textContent = 'DEMO · Click 🔔 to simulate trigger';

    // Wire up the bell to simulate a triggered reminder
    const bell = document.getElementById('notifBell');
    if (bell) {
      bell.title = 'Click to simulate a triggered odometer reminder';
      bell.addEventListener('click', () => {
        const overdue = DataStore.getReminders().find(r => r.status === 'overdue');
        if (overdue && window.app) {
          const over = overdue.current - overdue.target;
          window.app.showNotification(overdue, over);
        }
      });
    }

    // Show the badge as a hint
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = 'block';
  };

  return { init, destroy };

})();

// ── Geotab Add-in Entry Point ─────────────────────────────────────────────────
//
// MyGeotab calls initialize() when the add-in page loads inside the iframe.
// If we're running standalone (GitHub Pages preview / dev), api will be null
// and we fall back to demo mode automatically.

var initialize = function (freshApi, state, callback) {
  // Initialize data store first
  DataStore.init();

  // Initialize UI
  if (window.app) window.app.init();

  // Connect to Geotab (or demo mode)
  GeotabIntegration.init(freshApi || null);

  if (typeof callback === 'function') callback();
};

// Auto-start when loaded outside of MyGeotab (standalone / GitHub Pages)
if (typeof geotab === 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    DataStore.init();
    if (window.app) window.app.init();
    GeotabIntegration.init(null); // null → demo mode
  });
}
