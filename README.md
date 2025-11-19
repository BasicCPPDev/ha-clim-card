# HA Thermostat Card

A simple, elegant thermostat card for Home Assistant that displays temperature, humidity, valve status, and heating mode in a compact format.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)

## Screenshot

![HA Thermostat Card](images/screenshot.png)

## Features

- **Current Temperature** - Large, prominent display with room icon
- **Target Temperature** - Shows setpoint from climate entity or dedicated sensor
- **Humidity** - Color-coded display based on configurable thresholds
- **Valve Status** - Visual indicator for valve open/closed state
- **HVAC Mode** - Shows current heating/cooling mode with tap to control
- **Heating Badge** - Optional pulsing badge when room needs heating
- **Tap Actions** - Tap any element to open more-info dialog with history

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Go to "Frontend" section
3. Click the three dots menu and select "Custom repositories"
4. Add this repository URL with category "Lovelace"
5. Install "Thermostat Card"
6. Add the resource to your Lovelace configuration

### Manual Installation

1. Download `ha-clim-card.js`
2. Copy to `/config/www/ha-clim-card/ha-clim-card.js`
3. Add the resource:

```yaml
resources:
  - url: /local/ha-clim-card/ha-clim-card.js
    type: module
```

## Configuration

### Minimal Configuration

```yaml
type: custom:ha-clim-card
current_temperature_entity: sensor.living_room_temperature
```

### Full Configuration

```yaml
type: custom:ha-clim-card

# Required
current_temperature_entity: sensor.living_room_temperature

# Optional entities
target_temperature_entity: sensor.living_room_target  # Or use climate entity
humidity_entity: sensor.living_room_humidity
climate_entity: climate.living_room
valve_entity: binary_sensor.living_room_valve
heating_needed_entity: binary_sensor.living_room_heating_needed

# Display options
room_icon: mdi:sofa
room_name: Living Room
show_humidity: true
show_target: true
show_valve: true
show_mode: true
show_heating_badge: true

# Humidity color thresholds
humidity_low: 30
humidity_high: 60
humidity_low_color: '#ff9800'
humidity_normal_color: '#4caf50'
humidity_high_color: '#2196f3'

# Units
temperature_unit: '°C'
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `current_temperature_entity` | string | **Required** | Entity for current temperature |
| `target_temperature_entity` | string | - | Entity for target temperature |
| `humidity_entity` | string | - | Entity for humidity |
| `climate_entity` | string | - | Climate entity for mode and target |
| `valve_entity` | string | - | Entity for valve status (supports position 0-100) |
| `heating_needed_entity` | string | - | Entity to show heating badge |
| `presence_entity` | string | - | Binary sensor for room presence (changes icon color) |
| `mode_entity` | string | - | input_select for custom modes (off/auto/manual) |
| `boost_entity` | string | - | input_boolean for boost mode |
| `room_icon` | string | `mdi:sofa` | Icon to display for the room |
| `room_name` | string | - | Room name (not currently displayed) |
| `show_humidity` | boolean | `true` | Show humidity display |
| `show_target` | boolean | `true` | Show target temperature |
| `show_valve` | boolean | `true` | Show valve status |
| `show_mode` | boolean | `true` | Show HVAC mode |
| `show_heating_badge` | boolean | `true` | Show heating needed badge |
| `humidity_low` | number | `30` | Below this = low humidity color |
| `humidity_high` | number | `60` | Above this = high humidity color |
| `humidity_low_color` | string | `#ff9800` | Color for low humidity (orange) |
| `humidity_normal_color` | string | `#4caf50` | Color for normal humidity (green) |
| `humidity_high_color` | string | `#2196f3` | Color for high humidity (blue) |
| `icon_active_color` | string | `#48c9b0` | Room icon color when presence detected |
| `icon_inactive_color` | string | `#0e6251` | Room icon color when no presence |
| `temperature_unit` | string | `°C` | Temperature unit to display |
| `mode_tap_action` | object | - | Custom action when tapping mode button |
| `mode_hold_action` | object | - | Custom action when holding mode button (500ms) |
| `mode_double_tap_action` | object | - | Custom action when double-tapping mode button |

## Interactions

- **Tap current temperature** - Opens more-info dialog for temperature sensor
- **Tap target temperature** - Opens more-info for target sensor or climate entity
- **Tap humidity** - Opens more-info dialog for humidity sensor
- **Tap mode button** - Executes `mode_tap_action` or opens more-info
- **Hold mode button** - Executes `mode_hold_action` (500ms hold)
- **Double-tap mode button** - Executes `mode_double_tap_action`

## Action Types

Supported action types for mode button:

| Action | Description |
|--------|-------------|
| `fire-dom-event` | Fire DOM event (for browser_mod popups) |
| `more-info` | Show entity more-info dialog |
| `call-service` | Call a Home Assistant service |
| `navigate` | Navigate to a path |
| `toggle` | Toggle an entity |
| `url` | Open external URL |
| `none` | Do nothing |

### Example with browser_mod popup

```yaml
mode_tap_action:
  action: fire-dom-event
  browser_mod:
    service: browser_mod.popup
    data:
      title: "Thermostat Control"
      content:
        type: entities
        entities:
          - input_select.heater_mode
          - input_boolean.heater_boost
```

## Humidity Colors

The humidity value changes color based on thresholds:

- **Below `humidity_low`** - Orange (too dry)
- **Between thresholds** - Green (comfortable)
- **Above `humidity_high`** - Blue (too humid)

## Heating Badge

When the room needs heating, a pulsing "HEATING" badge appears in the top-right corner. This is triggered when:

1. `heating_needed_entity` is `on` / `true` / `1`
2. Or climate entity's `hvac_action` is `heating`

## Examples

### Living Room (Full Featured)

This example replaces a complex stack of button-cards with a single thermostat card:

```yaml
type: custom:ha-clim-card
current_temperature_entity: sensor.th_sal_temperature
target_temperature_entity: sensor.nr_target_temp_salon
humidity_entity: sensor.th_sal_humidity
valve_entity: sensor.valve_sal_position
mode_entity: input_select.heater_mode_sal
boost_entity: input_boolean.heater_boost_sal
heating_needed_entity: sensor.heat_computed_states
presence_entity: binary_sensor.radardetector1_presence
room_icon: mdi:sofa
humidity_high: 70
mode_tap_action:
  action: navigate
  navigation_path: "#popup-tempsal"
```

### Basic Thermostat

```yaml
type: custom:ha-clim-card
current_temperature_entity: sensor.bedroom_temperature
climate_entity: climate.bedroom
room_icon: mdi:bed
```

### With Climate Entity

```yaml
type: custom:ha-clim-card
current_temperature_entity: sensor.bathroom_temperature
humidity_entity: sensor.bathroom_humidity
climate_entity: climate.bathroom
room_icon: mdi:shower
humidity_high: 70  # Higher threshold for bathroom
```

### Temperature Only

```yaml
type: custom:ha-clim-card
current_temperature_entity: sensor.garage_temperature
room_icon: mdi:garage
show_humidity: false
show_target: false
show_mode: false
show_heating_badge: false
```

## License

MIT License
