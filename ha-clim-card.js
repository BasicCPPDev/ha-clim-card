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
  '%c  HA-CLIM-CARD  %c  v1.0.0 Loaded  ',
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

    // Validate required entities - either single entity or individual entities
    if (!config.entity && !config.current_temperature_entity) {
      throw new Error('You need to define either "entity" or "current_temperature_entity"');
    }

    this.config = {
      // Single entity mode (optional)
      entity: config.entity || null,

      // Entity configurations
      current_temperature_entity: config.current_temperature_entity,
      target_temperature_entity: config.target_temperature_entity || null,
      humidity_entity: config.humidity_entity || null,
      valve_entity: config.valve_entity || null,
      climate_entity: config.climate_entity || null,
      heating_needed_entity: config.heating_needed_entity || null,
      heating_needed: config.heating_needed || null,
      presence_entity: config.presence_entity || null,
      mode_entity: config.mode_entity || null,
      boost_entity: config.boost_entity || null,

      // Display options
      room_icon: config.room_icon || 'mdi:sofa',
      room_name: config.room_name || '',
      show_valve: config.show_valve !== false,
      show_humidity: config.show_humidity !== false,
      show_target: config.show_target !== false,
      show_mode: config.show_mode !== false,
      show_heating_badge: config.show_heating_badge !== false,

      // Humidity color thresholds
      humidity_low: config.humidity_low || 30,
      humidity_high: config.humidity_high || 60,

      // Colors
      humidity_low_color: config.humidity_low_color || '#ff9800',
      humidity_normal_color: config.humidity_normal_color || '#4caf50',
      humidity_high_color: config.humidity_high_color || '#2196f3',
      icon_active_color: config.icon_active_color || '#48c9b0',
      icon_inactive_color: config.icon_inactive_color || '#0e6251',

      // Units
      temperature_unit: config.temperature_unit || '°C',

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
      current_temperature_entity: 'sensor.temperature',
      target_temperature_entity: 'sensor.target_temperature',
      humidity_entity: 'sensor.humidity',
      climate_entity: 'climate.thermostat',
      room_icon: 'mdi:sofa',
      room_name: 'Living Room'
    };
  }

  // --------------------------------------------------------------------------
  // Icon and Color Helpers
  // --------------------------------------------------------------------------

  _getRoomIconColor() {
    if (!this.config.presence_entity) {
      return this.config.icon_active_color;
    }
    const state = this._getState(this.config.presence_entity);
    return state === 'on' ? this.config.icon_active_color : this.config.icon_inactive_color;
  }

  _getValveIcon() {
    let state;

    // Entity mode: read from attributes
    if (this.config.entity) {
      state = this._getEntityAttribute('valve');
      if (state === null || state === undefined) return 'mdi:valve-closed';
    } else {
      if (!this.config.valve_entity) return 'mdi:valve-closed';
      state = this._getState(this.config.valve_entity);
    }

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
    let state;

    // Entity mode: read from attributes
    if (this.config.entity) {
      state = this._getEntityAttribute('valve');
      if (state === null || state === undefined) return 'var(--disabled-text-color, #666)';
    } else {
      if (!this.config.valve_entity) return 'var(--disabled-text-color, #666)';
      state = this._getState(this.config.valve_entity);
    }

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
    // Entity mode: read from attributes
    if (this.config.entity) {
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

    // Legacy mode: check individual entities
    // Check boost first
    if (this.config.boost_entity) {
      const boostState = this._getState(this.config.boost_entity);
      if (boostState === 'on') return 'BOOST';
    }

    // Check mode entity (input_select)
    if (this.config.mode_entity) {
      const mode = this._getState(this.config.mode_entity);
      if (mode) {
        switch (mode.toLowerCase()) {
          case 'off': return 'OFF';
          case 'auto': return 'AUTO';
          case 'manual': return 'MAN';
          default: return mode.toUpperCase();
        }
      }
    }

    // Fall back to climate entity
    return this._getClimateMode() || '';
  }

  _getModeColor() {
    // Check boost first
    if (this.config.boost_entity) {
      const boostState = this._getState(this.config.boost_entity);
      if (boostState === 'on') return '#ff9800'; // Orange
    }

    // Check mode entity
    if (this.config.mode_entity) {
      const mode = this._getState(this.config.mode_entity);
      if (mode) {
        switch (mode.toLowerCase()) {
          case 'off': return '#808080'; // Grey
          case 'auto': return '#808000'; // Olive
          case 'manual': return '#ffff00'; // Yellow
          default: return 'var(--primary-text-color)';
        }
      }
    }

    // Fall back to climate mode colors
    const climateMode = this._getClimateMode();
    if (climateMode) {
      switch (climateMode.toLowerCase()) {
        case 'heat':
        case 'heating': return 'var(--error-color, #f44336)';
        case 'cool':
        case 'cooling': return 'var(--info-color, #2196f3)';
        case 'off': return 'var(--disabled-text-color, #666)';
        case 'auto': return 'var(--success-color, #4caf50)';
        case 'idle': return 'var(--warning-color, #ff9800)';
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
    if (this.config.entity) {
      // Entity mode: current temp is the state
      const state = this._getState(this.config.entity);
      if (state && state !== 'unavailable' && state !== 'unknown') {
        const num = parseFloat(state);
        return isNaN(num) ? '--' : num.toFixed(1);
      }
      return '--';
    }
    // Legacy mode: use current_temperature_entity
    return this._getNumericState(this.config.current_temperature_entity);
  }

  _getTargetTemp() {
    if (this.config.entity) {
      const target = this._getEntityAttribute('target_temp');
      if (target !== null && target !== undefined) {
        const num = parseFloat(target);
        return isNaN(num) ? '--' : num.toFixed(1);
      }
      return '--';
    }
    return this._getNumericState(this.config.target_temperature_entity);
  }

  _getHumidity() {
    if (this.config.entity) {
      const humidity = this._getEntityAttribute('humidity');
      if (humidity !== null && humidity !== undefined) {
        const num = parseFloat(humidity);
        return isNaN(num) ? '--' : num.toFixed(0);
      }
      return '--';
    }
    return this._getNumericState(this.config.humidity_entity, 0);
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

  _getClimateMode() {
    if (!this.config.climate_entity || !this.hass) return null;
    const climate = this.hass.states[this.config.climate_entity];
    if (!climate) return null;

    // Check hvac_action first (actual current action)
    const action = climate.attributes.hvac_action;
    if (action) {
      return action.toUpperCase();
    }

    // Fall back to hvac_mode (set mode)
    return climate.state ? climate.state.toUpperCase() : null;
  }

  _isHeatingNeeded() {
    if (!this.config.show_heating_badge) return false;

    // Entity mode: read from attributes
    if (this.config.entity) {
      const heatingNeeded = this._getEntityAttribute('heating_needed');
      if (heatingNeeded !== null && heatingNeeded !== undefined) {
        return heatingNeeded === true || heatingNeeded === 'true' || heatingNeeded === 'on' || heatingNeeded === '1';
      }
      return false;
    }

    // Check if custom JavaScript expression is specified
    if (this.config.heating_needed && this.hass) {
      try {
        // Evaluate the expression with access to states object
        const states = this.hass.states;
        const condition = new Function('states', `return ${this.config.heating_needed}`);
        return condition(states);
      } catch (e) {
        console.error('ha-clim-card: Error evaluating heating_needed expression:', e);
        return false;
      }
    }

    // Check dedicated heating_needed entity (simple on/off check)
    if (this.config.heating_needed_entity) {
      const state = this._getState(this.config.heating_needed_entity);
      return state === 'on' || state === 'true' || state === '1';
    }

    // Fall back to checking climate hvac_action
    if (this.config.climate_entity && this.hass) {
      const climate = this.hass.states[this.config.climate_entity];
      if (climate && climate.attributes.hvac_action === 'heating') {
        return true;
      }
    }

    return false;
  }

  _isValveOpen() {
    if (!this.config.valve_entity) return null;
    const state = this._getState(this.config.valve_entity);

    // Handle boolean entities
    if (state === 'on' || state === 'open' || state === 'true') return true;
    if (state === 'off' || state === 'closed' || state === 'false') return false;

    // Handle numeric entities (valve position > 0 means open)
    const num = parseFloat(state);
    if (!isNaN(num)) return num > 0;

    return null;
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
    this._showMoreInfo(this.config.current_temperature_entity);
  }

  _handleTargetTap(e) {
    e.stopPropagation();
    const entity = this.config.target_temperature_entity || this.config.climate_entity;
    if (entity) {
      this._showMoreInfo(entity);
    }
  }

  _handleHumidityTap(e) {
    e.stopPropagation();
    if (this.config.humidity_entity) {
      this._showMoreInfo(this.config.humidity_entity);
    }
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

    // Fall back to more-info for mode entity or climate entity
    const entity = this.config.mode_entity || this.config.climate_entity;
    if (entity) {
      this._showMoreInfo(entity);
    }
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

  _handleValveTap(e) {
    e.stopPropagation();
    if (this.config.valve_entity) {
      this._showMoreInfo(this.config.valve_entity);
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
    }

    .room-icon {
      --mdc-icon-size: 28px;
      color: var(--primary-color, #ff9800);
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
      background: #4caf50;
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
  `;

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  _getModeButtonClass() {
    // Check boost first
    if (this.config.boost_entity) {
      const boostState = this._getState(this.config.boost_entity);
      if (boostState === 'on') return 'boost';
    }

    // Check mode entity
    if (this.config.mode_entity) {
      const mode = this._getState(this.config.mode_entity);
      if (mode) {
        switch (mode.toLowerCase()) {
          case 'off': return 'off';
          case 'auto': return 'auto';
          case 'manual': return 'manual';
        }
      }
    }

    // Fall back to climate mode
    const climateMode = this._getClimateMode();
    if (climateMode) {
      switch (climateMode.toLowerCase()) {
        case 'heat':
        case 'heating': return 'heat';
        case 'cool':
        case 'cooling': return 'cool';
        case 'off': return 'off';
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
    const roomIconColor = this._getRoomIconColor();
    const roomIcon = this._getRoomIconFromEntity();
    const roomName = this._getRoomNameFromEntity();
    const valveIcon = this._getValveIcon();
    const valveColor = this._getValveColor();
    const modeButtonClass = this._getModeButtonClass();
    const modeIcon = this._getModeIcon();

    return html`
      <ha-card class="${heatingNeeded ? 'heating-needed' : ''}">
        <div class="clim-content">
          <!-- Header row: Room info, Target temp with valve, Humidity -->
          <div class="header-row">
            <div class="room-info">
              <ha-icon
                class="room-icon"
                icon="${roomIcon}"
                style="color: ${roomIconColor}"
              ></ha-icon>
              <span class="room-name">${roomName}</span>
            </div>

            <div class="header-center">
              ${this.config.show_target && (this.config.entity || this.config.target_temperature_entity || this.config.climate_entity) ? html`
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
                    ${targetTemp !== '--' ? targetTemp : this._getClimateTargetTemp()}${this.config.temperature_unit}
                  </span>
                </div>
              ` : ''}

              ${this.config.show_humidity && (this.config.entity || this.config.humidity_entity) ? html`
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
              ${currentTemp}${this.config.temperature_unit}
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

  _getClimateTargetTemp() {
    if (!this.config.climate_entity || !this.hass) return '--';
    const climate = this.hass.states[this.config.climate_entity];
    if (!climate) return '--';

    const temp = climate.attributes.temperature;
    return temp !== undefined ? parseFloat(temp).toFixed(1) : '--';
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
    const climateEntities = this._getEntities('climate');
    const binaryEntities = this._getEntities('binary_sensor');
    const inputBooleanEntities = this._getEntities('input_boolean');

    return html`
      <div class="editor">
        <h3>Required Entities</h3>

        <div class="form-group">
          <label>Current Temperature Entity *</label>
          <select
            .configValue=${'current_temperature_entity'}
            .value=${this.config.current_temperature_entity || ''}
            @change=${this._valueChanged}
          >
            <option value="">Select entity...</option>
            ${sensorEntities.map(entity => html`
              <option value="${entity}" ?selected=${this.config.current_temperature_entity === entity}>
                ${entity}
              </option>
            `)}
          </select>
        </div>

        <h3>Optional Entities</h3>

        <div class="form-group">
          <label>Target Temperature Entity</label>
          <select
            .configValue=${'target_temperature_entity'}
            .value=${this.config.target_temperature_entity || ''}
            @change=${this._valueChanged}
          >
            <option value="">None</option>
            ${sensorEntities.map(entity => html`
              <option value="${entity}" ?selected=${this.config.target_temperature_entity === entity}>
                ${entity}
              </option>
            `)}
          </select>
          <small>Or use climate entity below for target temperature</small>
        </div>

        <div class="form-group">
          <label>Humidity Entity</label>
          <select
            .configValue=${'humidity_entity'}
            .value=${this.config.humidity_entity || ''}
            @change=${this._valueChanged}
          >
            <option value="">None</option>
            ${sensorEntities.map(entity => html`
              <option value="${entity}" ?selected=${this.config.humidity_entity === entity}>
                ${entity}
              </option>
            `)}
          </select>
        </div>

        <div class="form-group">
          <label>Climate Entity</label>
          <select
            .configValue=${'climate_entity'}
            .value=${this.config.climate_entity || ''}
            @change=${this._valueChanged}
          >
            <option value="">None</option>
            ${climateEntities.map(entity => html`
              <option value="${entity}" ?selected=${this.config.climate_entity === entity}>
                ${entity}
              </option>
            `)}
          </select>
          <small>Used for mode display and target temperature</small>
        </div>

        <div class="form-group">
          <label>Valve Entity</label>
          <select
            .configValue=${'valve_entity'}
            .value=${this.config.valve_entity || ''}
            @change=${this._valueChanged}
          >
            <option value="">None</option>
            ${[...binaryEntities, ...sensorEntities].sort().map(entity => html`
              <option value="${entity}" ?selected=${this.config.valve_entity === entity}>
                ${entity}
              </option>
            `)}
          </select>
        </div>

        <div class="form-group">
          <label>Heating Needed Entity</label>
          <select
            .configValue=${'heating_needed_entity'}
            .value=${this.config.heating_needed_entity || ''}
            @change=${this._valueChanged}
          >
            <option value="">None (auto-detect from climate)</option>
            ${[...binaryEntities, ...inputBooleanEntities].sort().map(entity => html`
              <option value="${entity}" ?selected=${this.config.heating_needed_entity === entity}>
                ${entity}
              </option>
            `)}
          </select>
          <small>Shows a fire badge when room needs heating</small>
        </div>

        <div class="form-group">
          <label>Presence Entity</label>
          <select
            .configValue=${'presence_entity'}
            .value=${this.config.presence_entity || ''}
            @change=${this._valueChanged}
          >
            <option value="">None</option>
            ${binaryEntities.map(entity => html`
              <option value="${entity}" ?selected=${this.config.presence_entity === entity}>
                ${entity}
              </option>
            `)}
          </select>
          <small>Room icon color changes based on presence</small>
        </div>

        <div class="form-group">
          <label>Mode Entity (input_select)</label>
          <select
            .configValue=${'mode_entity'}
            .value=${this.config.mode_entity || ''}
            @change=${this._valueChanged}
          >
            <option value="">None (use climate entity)</option>
            ${this._getEntities('input_select').map(entity => html`
              <option value="${entity}" ?selected=${this.config.mode_entity === entity}>
                ${entity}
              </option>
            `)}
          </select>
          <small>For custom modes: off, auto, manual</small>
        </div>

        <div class="form-group">
          <label>Boost Entity</label>
          <select
            .configValue=${'boost_entity'}
            .value=${this.config.boost_entity || ''}
            @change=${this._valueChanged}
          >
            <option value="">None</option>
            ${inputBooleanEntities.map(entity => html`
              <option value="${entity}" ?selected=${this.config.boost_entity === entity}>
                ${entity}
              </option>
            `)}
          </select>
          <small>Shows BOOST when on</small>
        </div>

        <h3>Display Options</h3>

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
              .value=${this.config.humidity_low || 30}
              @input=${this._valueChanged}
              min="0"
              max="100"
            />
          </div>

          <div class="form-group">
            <label>High Humidity (%)</label>
            <input
              type="number"
              .configValue=${'humidity_high'}
              .value=${this.config.humidity_high || 60}
              @input=${this._valueChanged}
              min="0"
              max="100"
            />
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
