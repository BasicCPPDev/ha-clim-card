/**
 * HA Thermostat Card
 * A simple, elegant thermostat card for Home Assistant
 *
 * Features:
 * - Current and target temperature display
 * - Humidity with color-coded values
 * - Valve status indicator
 * - Heating mode display with popup control
 * - Optional "needs heating" badge
 * - Tap actions for more-info dialogs
 */

import { LitElement, html, css } from 'https://unpkg.com/lit@3/index.js?module';

console.info(
  '%c  HA-CLIM-CARD  %c  v2.1.3 Loaded  ',
  'color: cyan; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray'
);

// ============================================================================
// MAIN CARD COMPONENT
// ============================================================================

  class HaThermostatCard extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false },
    _dialogOpen: { state: true }
  };

  constructor() {
    super();
    this._dialogOpen = false;
    this._holdTimer = null;
    this._lastTap = 0;
    this._tapCount = 0;
    this._tapTimer = null;
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  setConfig(config) {
    if (!config) {
      throw new Error('Invalid configuration');
    }

    // Validate required entity
    if (!config.entity) {
      throw new Error('You need to define "entity" (template sensor with all attributes)');
    }

    // Set humidity thresholds with defaults
    const humidity_low = config.humidity_low !== undefined ? config.humidity_low : 40;
    const humidity_high = config.humidity_high !== undefined ? config.humidity_high : 70;

    // Validate humidity thresholds
    if (humidity_high <= humidity_low) {
      throw new Error('humidity_high must be greater than humidity_low');
    }

    this.config = {
      // Single entity mode (required)
      entity: config.entity,

      // Layout
      layout: config.layout || 'normal', // 'normal' or 'compact'

      // Display options
      room_icon: config.room_icon || 'mdi:sofa',
      room_name: config.room_name || '',
      show_valve: config.show_valve !== false,
      show_humidity: config.show_humidity !== false,
      show_target: config.show_target !== false,
      show_mode: config.show_mode !== false,
      show_heating_badge: config.show_heating_badge !== false,

      // Humidity color thresholds
      humidity_low: humidity_low,
      humidity_high: humidity_high,

      // Colors
      humidity_low_color: config.humidity_low_color || '#ff9800',
      humidity_normal_color: config.humidity_normal_color || '#4caf50',
      humidity_high_color: config.humidity_high_color || '#2196f3',
      icon_active_color: config.icon_active_color || '#48c9b0',
      icon_inactive_color: config.icon_inactive_color || '#0e6251',

      // Actions
      mode_tap_action: config.mode_tap_action || null,
      mode_hold_action: config.mode_hold_action || null,
      mode_double_tap_action: config.mode_double_tap_action || null,

      ...config
    };
  }

  static getConfigElement() {
    return document.createElement('ha-clim-card-editor');
  }

  static getStubConfig() {
    return {
      entity: 'sensor.living_room_thermostat',
      room_icon: 'mdi:sofa',
      room_name: 'Living Room'
    };
  }

  // --------------------------------------------------------------------------
  // Icon and Color Helpers
  // --------------------------------------------------------------------------

  _hasPresence() {
    const presence = this._getEntityAttribute('presence');
    return presence === 'on';
  }

  _getValveIcon() {
    const state = this._getEntityAttribute('valve');
    if (state === null || state === undefined) return 'mdi:valve-closed';

    // Handle numeric valve position
    const pos = parseFloat(state);
    if (!isNaN(pos)) {
      if (pos === 0) return 'mdi:valve-closed';
      if (pos >= 100) return 'mdi:valve-open';
      return 'mdi:valve'; // Partially open
    }

    // Handle binary states
    if (state === 'on' || state === 'open') return 'mdi:valve-open';
    return 'mdi:valve-closed';
  }

  _getValveColor() {
    const state = this._getEntityAttribute('valve');
    if (state === null || state === undefined) return 'var(--disabled-text-color, #666)';

    const pos = parseFloat(state);
    if (!isNaN(pos)) {
      if (pos === 0) return '#cd5c5c'; // IndianRed - closed
      if (pos >= 100) return '#4caf50'; // Green - fully open
      return '#ff9800'; // Orange - partially open
    }

    // Handle binary states
    if (state === 'on' || state === 'open') return '#4caf50';
    return '#cd5c5c';
  }

  _getModeDisplay() {
    const boost = this._getEntityAttribute('boost');
    if (boost === 'on' || boost === true || boost === 'true') return 'BOOST';

    const mode = this._getEntityAttribute('mode');
    if (mode) {
      switch (mode.toLowerCase()) {
        case 'off': return 'OFF';
        case 'auto': return 'AUTO';
        case 'manual': return 'MAN';
        default: return mode.toUpperCase();
      }
    }
    return '';
  }

  _getModeColor() {
    // Check boost first
    const boost = this._getEntityAttribute('boost');
    if (boost === 'on' || boost === true || boost === 'true') {
      return '#ff9800'; // Orange
    }

    // Check mode
    const mode = this._getEntityAttribute('mode');
    if (mode) {
      switch (mode.toLowerCase()) {
        case 'off': return '#808080'; // Grey
        case 'auto': return '#808000'; // Olive
        case 'manual': return '#ffff00'; // Yellow
        default: return 'var(--primary-text-color)';
      }
    }

    return 'var(--primary-text-color)';
  }

  // --------------------------------------------------------------------------
  // Entity State Helpers
  // --------------------------------------------------------------------------

  _getState(entityId) {
    if (!entityId || !this.hass) return null;
    const state = this.hass.states[entityId];
    return state ? state.state : null;
  }

  _getNumericState(entityId, decimals = 1) {
    const state = this._getState(entityId);
    if (state === null || state === 'unavailable' || state === 'unknown') {
      return '--';
    }
    const num = parseFloat(state);
    return isNaN(num) ? '--' : num.toFixed(decimals);
  }

  // --------------------------------------------------------------------------
  // Entity Mode Helpers (for single-entity mode)
  // --------------------------------------------------------------------------

  _getEntityAttribute(attr) {
    if (!this.config.entity || !this.hass) return null;
    const entity = this.hass.states[this.config.entity];
    return entity?.attributes?.[attr];
  }

  _getCurrentTemp() {
    const state = this._getState(this.config.entity);
    if (state && state !== 'unavailable' && state !== 'unknown') {
      const num = parseFloat(state);
      return isNaN(num) ? '--' : num.toFixed(1);
    }
    return '--';
  }

  _getTargetTemp() {
    const target = this._getEntityAttribute('target_temp');
    if (target !== null && target !== undefined) {
      const num = parseFloat(target);
      return isNaN(num) ? '--' : num.toFixed(1);
    }
    return '--';
  }

  _getHumidity() {
    const humidity = this._getEntityAttribute('humidity');
    if (humidity !== null && humidity !== undefined) {
      const num = parseFloat(humidity);
      return isNaN(num) ? '--' : num.toFixed(0);
    }
    return '--';
  }

  _getRoomIconFromEntity() {
    if (this.config.entity && this.hass) {
      const entity = this.hass.states[this.config.entity];
      return entity?.attributes?.icon || this.config.room_icon;
    }
    return this.config.room_icon;
  }

  _getRoomNameFromEntity() {
    if (this.config.entity) {
      const name = this._getEntityAttribute('room_name');
      if (name) return name;
    }
    return this.config.room_name || '';
  }

  _isHeatingNeeded() {
    if (!this.config.show_heating_badge) return false;

    const heatingNeeded = this._getEntityAttribute('heating_needed');
    if (heatingNeeded !== null && heatingNeeded !== undefined) {
      return heatingNeeded === true || heatingNeeded === 'true' || heatingNeeded === 'on' || heatingNeeded === '1';
    }
    return false;
  }


  // --------------------------------------------------------------------------
  // Humidity Color Calculation
  // --------------------------------------------------------------------------

  _getHumidityColor(humidity) {
    if (humidity === '--' || humidity === null) {
      return this.config.humidity_normal_color;
    }

    const h = parseFloat(humidity);
    if (h < this.config.humidity_low) {
      return this.config.humidity_low_color;
    } else if (h > this.config.humidity_high) {
      return this.config.humidity_high_color;
    }
    return this.config.humidity_normal_color;
  }

  // --------------------------------------------------------------------------
  // Event Handlers
  // --------------------------------------------------------------------------

  _handleTemperatureTap(e) {
    e.stopPropagation();
    this._showMoreInfo(this.config.entity);
  }

  _handleTargetTap(e) {
    e.stopPropagation();
    this._showMoreInfo(this.config.entity);
  }

  _handleHumidityTap(e) {
    e.stopPropagation();
    this._showMoreInfo(this.config.entity);
  }

  _handleModePointerDown(e) {
    e.stopPropagation();

    // Start hold timer
    this._holdTimer = setTimeout(() => {
      this._holdTimer = null;
      if (this.config.mode_hold_action) {
        this._performAction(this.config.mode_hold_action);
      }
    }, 500);
  }

  _handleModePointerUp(e) {
    e.stopPropagation();

    // If hold timer is still active, it wasn't a hold
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;

      // Handle tap/double-tap
      this._tapCount++;

      if (this._tapTimer) {
        clearTimeout(this._tapTimer);
      }

      this._tapTimer = setTimeout(() => {
        if (this._tapCount >= 2 && this.config.mode_double_tap_action) {
          // Double tap
          this._performAction(this.config.mode_double_tap_action);
        } else {
          // Single tap
          this._handleModeTap(e);
        }
        this._tapCount = 0;
        this._tapTimer = null;
      }, 250);
    }
  }

  _handleModePointerCancel() {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  _handleModeTap() {
    // Check for custom tap action first
    if (this.config.mode_tap_action) {
      this._performAction(this.config.mode_tap_action);
      return;
    }

    // Fall back to more-info for main entity
    this._showMoreInfo(this.config.entity);
  }

  _performAction(action) {
    if (!action) return;

    switch (action.action) {
      case 'navigate':
        if (action.navigation_path) {
          history.pushState(null, '', action.navigation_path);
          const event = new Event('location-changed', {
            bubbles: true,
            composed: true,
          });
          window.dispatchEvent(event);
        }
        break;

      case 'more-info':
        if (action.entity) {
          this._showMoreInfo(action.entity);
        }
        break;

      case 'call-service':
        if (action.service) {
          const [domain, service] = action.service.split('.');
          this.hass.callService(domain, service, action.service_data || {});
        }
        break;

      case 'toggle':
        if (action.entity) {
          this.hass.callService('homeassistant', 'toggle', {
            entity_id: action.entity
          });
        }
        break;

      case 'url':
        if (action.url_path) {
          window.open(action.url_path, '_blank');
        }
        break;

      case 'none':
        break;

      case 'fire-dom-event':
        const domEvent = new Event('ll-custom', {
          bubbles: true,
          composed: true,
        });
        domEvent.detail = action;
        this.dispatchEvent(domEvent);
        break;

      default:
        // Default to more-info if entity is specified
        if (action.entity) {
          this._showMoreInfo(action.entity);
        }
    }
  }

  _showMoreInfo(entityId) {
    if (!entityId) return;

    const event = new Event('hass-more-info', {
      bubbles: true,
      composed: true,
    });
    event.detail = { entityId };
    this.dispatchEvent(event);
  }

  // --------------------------------------------------------------------------
  // Styles
  // --------------------------------------------------------------------------

  static styles = css`
    :host {
      display: block;
    }

    ha-card {
      padding: 4px 8px;
      background: var(--card-background-color, #1c1c1c);
      border-radius: var(--ha-card-border-radius, 12px);
      position: relative;
      overflow: hidden;
      border: 2px solid transparent;
      transition: border-color 0.3s ease;
    }

    ha-card.heating-needed {
      border-color: #ff9800;
    }

    .clim-content {
      display: flex;
      flex-direction: column;
    }

    /* Header row */
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--divider-color, #333);
    }

    .room-info {
      display: flex;
      align-items: center;
      gap: 6px;
      position: relative;
    }

    .room-icon {
      --mdc-icon-size: 28px;
      color: #64b5f6; /* Fixed bright blue */
    }

    .presence-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      --mdc-icon-size: 16px;
      color: #ff5252; /* Bright red */
      background: var(--card-background-color, #1c1c1c);
      border-radius: 50%;
      padding: 2px;
    }

    .room-name {
      font-size: 1.2em;
      font-weight: 500;
      color: var(--primary-text-color, #fff);
    }

    .header-center {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .target-section {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      transition: opacity 0.2s;
      color: var(--secondary-text-color, #aaa);
    }

    .target-section:hover {
      opacity: 0.8;
    }

    .valve-icon {
      --mdc-icon-size: 24px;
    }

    .target-temp {
      font-size: 1.3em;
      color: #ffc107;
    }

    .humidity {
      display: flex;
      align-items: center;
      gap: 2px;
      cursor: pointer;
      transition: opacity 0.2s;
      font-size: 1.3em;
    }

    .humidity:hover {
      opacity: 0.8;
    }

    .humidity-icon {
      --mdc-icon-size: 24px;
    }

    .humidity-value {
      font-weight: 500;
    }

    /* Body row */
    .body-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 8px;
    }

    .current-temp {
      font-size: 45px;
      font-weight: 500;
      color: var(--primary-text-color, #fff);
      cursor: pointer;
      transition: opacity 0.2s;
      line-height: 1;
    }

    .current-temp:hover {
      opacity: 0.8;
    }

    /* Mode button */
    .mode-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      border-radius: 8px;
      background: #132F09; /* Very dark green for dark mode */
      color: #fff;
      font-size: 1.05em;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
      border: none;
    }

    .mode-button ha-icon {
      --mdc-icon-size: 18px;
    }

    .mode-button:hover {
      opacity: 0.9;
      transform: scale(1.02);
    }

    .mode-button.boost {
      background: #ff9800;
    }

    .mode-button.manual {
      background: #ffc107;
      color: #000;
    }

    .mode-button.off {
      background: #666;
    }

    .mode-button.heat {
      background: #f44336;
    }

    .mode-button.cool {
      background: #2196f3;
    }

    .mode-button ha-icon {
      --mdc-icon-size: 16px;
    }

    /* Unavailable state */
    .unavailable {
      color: var(--disabled-text-color, #666);
    }

    /* ====================================================================== */
    /* COMPACT LAYOUT - Fits in half width, no room name, smaller text */
    /* ====================================================================== */

    ha-card.compact {
      padding: 3px 6px;
    }

    ha-card.compact .room-name {
      display: none; /* Hide room name in compact mode */
    }

    ha-card.compact .room-icon {
      --mdc-icon-size: 22px;
    }

    ha-card.compact .presence-badge {
      --mdc-icon-size: 14px;
      top: -3px;
      right: -3px;
    }

    ha-card.compact .room-info {
      gap: 0; /* No gap since no name */
    }

    ha-card.compact .header-row {
      padding-bottom: 4px;
    }

    ha-card.compact .header-center {
      gap: 8px;
    }

    ha-card.compact .valve-icon {
      --mdc-icon-size: 17px; /* 5% smaller */
    }

    ha-card.compact .target-temp {
      font-size: 0.95em; /* 5% smaller */
    }

    ha-card.compact .humidity {
      font-size: 0.95em; /* 5% smaller */
    }

    ha-card.compact .humidity-icon {
      --mdc-icon-size: 17px; /* 5% smaller */
    }

    ha-card.compact .body-row {
      padding-top: 6px;
    }

    ha-card.compact .current-temp {
      font-size: 29px; /* 10% smaller (32px - 10%) */
    }

    ha-card.compact .mode-button {
      padding: 6px 10px; /* 20% smaller */
      font-size: 0.76em; /* 20% smaller (0.95em * 0.8) */
      gap: 3px;
      background: #132F09; /* Even darker green */
    }

    ha-card.compact .mode-button ha-icon {
      --mdc-icon-size: 13px; /* 20% smaller */
    }
  `;

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  _getModeButtonClass() {
    // Check boost first
    const boost = this._getEntityAttribute('boost');
    if (boost === 'on' || boost === true || boost === 'true') {
      return 'boost';
    }

    // Check mode
    const mode = this._getEntityAttribute('mode');
    if (mode) {
      switch (mode.toLowerCase()) {
        case 'off': return 'off';
        case 'auto': return 'auto';
        case 'manual': return 'manual';
      }
    }

    return 'auto';
  }

  _getModeIcon() {
    const mode = this._getModeDisplay();
    switch (mode) {
      case 'BOOST': return 'mdi:fire';
      case 'AUTO': return 'mdi:autorenew';
      case 'MAN': return 'mdi:hand-back-right';
      case 'OFF': return 'mdi:power';
      case 'HEAT':
      case 'HEATING': return 'mdi:fire';
      case 'COOL':
      case 'COOLING': return 'mdi:snowflake';
      default: return 'mdi:thermostat';
    }
  }

  render() {
    if (!this.hass || !this.config) {
      return html`<ha-card>Loading...</ha-card>`;
    }

    const currentTemp = this._getCurrentTemp();
    const targetTemp = this._getTargetTemp();
    const humidity = this._getHumidity();
    const mode = this._getModeDisplay();
    const heatingNeeded = this._isHeatingNeeded();
    const humidityColor = this._getHumidityColor(humidity);
    const roomIcon = this._getRoomIconFromEntity();
    const roomName = this._getRoomNameFromEntity();
    const valveIcon = this._getValveIcon();
    const valveColor = this._getValveColor();
    const modeButtonClass = this._getModeButtonClass();
    const modeIcon = this._getModeIcon();
    const hasPresence = this._hasPresence();

    // Build CSS classes for ha-card
    const cardClasses = [
      heatingNeeded ? 'heating-needed' : '',
      this.config.layout === 'compact' ? 'compact' : ''
    ].filter(c => c).join(' ');

    return html`
      <ha-card class="${cardClasses}">
        <div class="clim-content">
          <!-- Header row: Room info, Target temp with valve, Humidity -->
          <div class="header-row">
            <div class="room-info">
              <ha-icon
                class="room-icon"
                icon="${roomIcon}"
              ></ha-icon>
              ${hasPresence ? html`
                <ha-icon
                  class="presence-badge"
                  icon="mdi:motion-sensor"
                ></ha-icon>
              ` : ''}
              <span class="room-name">${roomName}</span>
            </div>

            <div class="header-center">
              ${this.config.show_target ? html`
                <div
                  class="target-section"
                  @click=${this._handleTargetTap}
                >
                  <ha-icon
                    class="valve-icon"
                    icon="${valveIcon}"
                    style="color: ${valveColor}"
                  ></ha-icon>
                  <span class="target-temp">
                    ${targetTemp}°
                  </span>
                </div>
              ` : ''}

              ${this.config.show_humidity ? html`
                <div
                  class="humidity"
                  @click=${this._handleHumidityTap}
                  style="color: ${humidityColor}"
                >
                  <ha-icon class="humidity-icon" icon="mdi:water-percent"></ha-icon>
                  <span class="humidity-value">${humidity}%</span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Body row: Current temp, Mode button -->
          <div class="body-row">
            <span
              class="current-temp ${currentTemp === '--' ? 'unavailable' : ''}"
              @click=${this._handleTemperatureTap}
            >
              ${currentTemp}°
            </span>

            ${this.config.show_mode && mode ? html`
              <button
                class="mode-button ${modeButtonClass}"
                @pointerdown=${this._handleModePointerDown}
                @pointerup=${this._handleModePointerUp}
                @pointercancel=${this._handleModePointerCancel}
                @pointerleave=${this._handleModePointerCancel}
              >
                <ha-icon icon="${modeIcon}"></ha-icon>
                ${mode}
              </button>
            ` : ''}
          </div>
        </div>
      </ha-card>
    `;
  }

  getCardSize() {
    return 2;
  }
}

// ============================================================================
// CONFIGURATION EDITOR
// ============================================================================

class HaThermostatCardEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    config: { attribute: false }
  };

  setConfig(config) {
    this.config = config;
  }

  _valueChanged(e) {
    if (!this.config || !this.hass) return;

    const target = e.target;
    const configValue = target.configValue;
    let value = target.value;

    // Handle checkboxes
    if (target.type === 'checkbox') {
      value = target.checked;
    }

    // Handle empty strings
    if (value === '') {
      value = undefined;
    }

    const newConfig = {
      ...this.config,
      [configValue]: value
    };

    // Remove undefined values
    Object.keys(newConfig).forEach(key => {
      if (newConfig[key] === undefined) {
        delete newConfig[key];
      }
    });

    const event = new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  _getEntities(domain) {
    if (!this.hass) return [];
    return Object.keys(this.hass.states)
      .filter(entityId => entityId.startsWith(domain + '.'))
      .sort();
  }

  static styles = css`
    :host {
      display: block;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: var(--primary-text-color);
    }

    .form-group small {
      display: block;
      margin-top: 4px;
      color: var(--secondary-text-color);
      font-size: 0.85em;
    }

    select, input[type="text"], input[type="number"] {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font-size: 1em;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .checkbox-group label {
      margin-bottom: 0;
    }

    h3 {
      margin: 24px 0 12px 0;
      color: var(--primary-text-color);
      border-bottom: 1px solid var(--divider-color);
      padding-bottom: 8px;
    }

    h3:first-child {
      margin-top: 0;
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
  `;

  render() {
    if (!this.hass) {
      return html`<div>Loading...</div>`;
    }

    const sensorEntities = this._getEntities('sensor');

    return html`
      <div class="editor">
        <h3>Template Sensor Entity</h3>

        <div class="form-group">
          <label>Entity *</label>
          <select
            .configValue=${'entity'}
            .value=${this.config.entity || ''}
            @change=${this._valueChanged}
          >
            <option value="">Select template sensor...</option>
            ${sensorEntities.map(entity => html`
              <option value="${entity}" ?selected=${this.config.entity === entity}>
                ${entity}
              </option>
            `)}
          </select>
          <small>Template sensor with attributes: target_temp, humidity, valve, mode, boost, heating_needed, presence</small>
        </div>

        <h3>Display Options</h3>

        <div class="form-group">
          <label>Layout</label>
          <select
            .configValue=${'layout'}
            .value=${this.config.layout || 'normal'}
            @change=${this._valueChanged}
          >
            <option value="normal" ?selected=${this.config.layout === 'normal' || !this.config.layout}>Normal</option>
            <option value="compact" ?selected=${this.config.layout === 'compact'}>Compact (half width, no room name)</option>
          </select>
          <small>Compact mode: fits in half width, icon only, smaller text</small>
        </div>

        <div class="row">
          <div class="form-group">
            <label>Room Icon</label>
            <input
              type="text"
              .configValue=${'room_icon'}
              .value=${this.config.room_icon || 'mdi:sofa'}
              @input=${this._valueChanged}
              placeholder="mdi:sofa"
            />
            <small>Override icon from entity attributes</small>
          </div>

          <div class="form-group">
            <label>Room Name</label>
            <input
              type="text"
              .configValue=${'room_name'}
              .value=${this.config.room_name || ''}
              @input=${this._valueChanged}
              placeholder="Living Room"
            />
            <small>Not shown in compact mode</small>
          </div>
        </div>

        <div class="form-group checkbox-group">
          <input
            type="checkbox"
            id="show_humidity"
            .configValue=${'show_humidity'}
            .checked=${this.config.show_humidity !== false}
            @change=${this._valueChanged}
          />
          <label for="show_humidity">Show Humidity</label>
        </div>

        <div class="form-group checkbox-group">
          <input
            type="checkbox"
            id="show_target"
            .configValue=${'show_target'}
            .checked=${this.config.show_target !== false}
            @change=${this._valueChanged}
          />
          <label for="show_target">Show Target Temperature</label>
        </div>

        <div class="form-group checkbox-group">
          <input
            type="checkbox"
            id="show_valve"
            .configValue=${'show_valve'}
            .checked=${this.config.show_valve !== false}
            @change=${this._valueChanged}
          />
          <label for="show_valve">Show Valve Status</label>
        </div>

        <div class="form-group checkbox-group">
          <input
            type="checkbox"
            id="show_mode"
            .configValue=${'show_mode'}
            .checked=${this.config.show_mode !== false}
            @change=${this._valueChanged}
          />
          <label for="show_mode">Show HVAC Mode</label>
        </div>

        <div class="form-group checkbox-group">
          <input
            type="checkbox"
            id="show_heating_badge"
            .configValue=${'show_heating_badge'}
            .checked=${this.config.show_heating_badge !== false}
            @change=${this._valueChanged}
          />
          <label for="show_heating_badge">Show Heating Badge</label>
        </div>

        <h3>Humidity Color Thresholds</h3>

        <div class="row">
          <div class="form-group">
            <label>Low Humidity (%)</label>
            <input
              type="number"
              .configValue=${'humidity_low'}
              .value=${this.config.humidity_low || 40}
              @input=${this._valueChanged}
              min="0"
              max="100"
            />
            <small>Orange below this value (default: 40)</small>
          </div>

          <div class="form-group">
            <label>High Humidity (%)</label>
            <input
              type="number"
              .configValue=${'humidity_high'}
              .value=${this.config.humidity_high || 70}
              @input=${this._valueChanged}
              min="0"
              max="100"
            />
            <small>Blue above this value (default: 70)</small>
          </div>
        </div>
      </div>
    `;
  }
}

// ============================================================================
// REGISTER CUSTOM ELEMENTS
// ============================================================================

customElements.define('ha-clim-card', HaThermostatCard);
customElements.define('ha-clim-card-editor', HaThermostatCardEditor);

// Register with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-clim-card',
  name: 'Climate Card',
  description: 'A simple thermostat card showing temperature, humidity, and heating status',
  preview: true,
  documentationURL: 'https://github.com/yourusername/ha-clim-card'
});
