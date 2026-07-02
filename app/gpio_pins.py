DHTTYPE = "DHT11"
DHT_PIN = 4
PIR_PIN = 17
SMOKE_PIN = 34
BUZZER_PIN = 25
IR_PIN = 26
LED1_PIN = 32
LED2_PIN = 14

GPIO_PIN_DEFINITIONS = {
    "DHT_PIN": DHT_PIN,
    "PIR_PIN": PIR_PIN,
    "SMOKE_PIN": SMOKE_PIN,
    "BUZZER_PIN": BUZZER_PIN,
    "IR_PIN": IR_PIN,
    "LED1_PIN": LED1_PIN,
    "LED2_PIN": LED2_PIN,
}

DEVICE_GPIO_OPTIONS = {
    "dht11": {
        "device_key": "dht11",
        "label": "DHT11 Temperature & Humidity Sensor",
        "device_type": "sensor",
        "pin_name": "DHT_PIN",
        "gpio_pin": DHT_PIN,
        "dht_type": DHTTYPE,
        "controllable": False,
    },
    "pir": {
        "device_key": "pir",
        "label": "PIR Motion Sensor",
        "device_type": "sensor",
        "pin_name": "PIR_PIN",
        "gpio_pin": PIR_PIN,
        "controllable": False,
    },
    "smoke": {
        "device_key": "smoke",
        "label": "Smoke Sensor",
        "device_type": "sensor",
        "pin_name": "SMOKE_PIN",
        "gpio_pin": SMOKE_PIN,
        "controllable": False,
    },
    "buzzer": {
        "device_key": "buzzer",
        "label": "Buzzer",
        "device_type": "speaker",
        "pin_name": "BUZZER_PIN",
        "gpio_pin": BUZZER_PIN,
        "controllable": True,
    },
    "ir": {
        "device_key": "ir",
        "label": "IR Sensor",
        "device_type": "sensor",
        "pin_name": "IR_PIN",
        "gpio_pin": IR_PIN,
        "controllable": False,
    },
    "led1": {
        "device_key": "led1",
        "label": "LED 1",
        "device_type": "light",
        "pin_name": "LED1_PIN",
        "gpio_pin": LED1_PIN,
        "controllable": True,
    },
    "led2": {
        "device_key": "led2",
        "label": "LED 2",
        "device_type": "light",
        "pin_name": "LED2_PIN",
        "gpio_pin": LED2_PIN,
        "controllable": True,
    },
}

SMART_HOME_ROOMS = ("Bedroom", "Kitchen", "Bathroom")


def get_gpio_option(device_key: str) -> dict:
    option = DEVICE_GPIO_OPTIONS.get(device_key)
    if not option:
        raise KeyError(device_key)
    return option


def gpio_payload(device_key: str | None, gpio_pin: int | None = None) -> dict:
    option = DEVICE_GPIO_OPTIONS.get(device_key or "")
    if not option:
        return {
            "gpio_key": device_key,
            "gpio_pin": gpio_pin,
            "gpio_pin_name": None,
            "gpio_label": None,
            "gpio_controllable": False,
        }

    return {
        "gpio_key": option["device_key"],
        "gpio_pin": option["gpio_pin"],
        "gpio_pin_name": option["pin_name"],
        "gpio_label": option["label"],
        "gpio_controllable": option["controllable"],
    }
