# Hardware setup: the kit ESP32 as hat W01

Build Guide **Step 5** (kit parts only; Step 6 sensors/battery come later). The AWS side is already live, see [`PROGRESS.md`](PROGRESS.md).
Goal: the MaESP ESP32 OLED senses, estimates WBGT, alerts locally (even with no Wi-Fi), publishes to AWS as **W01**, receives `cmd`, and acks with the button. Accuracy is not the goal yet; the pipeline is.

Do the milestones in order. Each ends with a **Check**; commit each one under `firmware/hat/`.

**Facts you'll need**

| | |
|---|---|
| Worker / thing / MQTT client ID | `W01` (exactly; anything else is disconnected) |
| Broker | `au6sg8oty1j0l-ats.iot.ap-southeast-2.amazonaws.com`, port **8883**, TLS with client cert |
| Certs | `cloud/certs/AmazonRootCA1.pem`, `W01.cert.pem`, `W01.private.key` |
| Buddy | `W02`, played by the simulator until a second board exists |
| Message formats | [`CONTRACT.md`](CONTRACT.md): QoS 1, not retained, < 256 bytes |
| Thresholds | rolling avg of 6 samples **≥ 32.0** → alert; rest **15 min** after ack, then **< 31.5** → off |

---

## 0. Tools (30 min)

1. **Arduino IDE 2.x** → *Boards Manager* → install **esp32 by Espressif Systems**.
2. Board: check the seller's page for the MaESP ESP32 OLED. If there is no specific entry, **ESP32 Dev Module** works. Port: the USB serial port (install the **CP210x** or **CH340** driver if no port shows up).
3. *Library Manager*, install:
   - **PubSubClient** (Nick O'Leary): MQTT
   - **ArduinoJson** (Benoit Blanchon, v7)
   - **DHT sensor library** (Adafruit) + **Adafruit Unified Sensor**
   - **Adafruit NeoPixel**: WS2812
   - **Adafruit SSD1306** + **Adafruit GFX** for the OLED (or **U8g2** if the seller's example uses it)
4. Upload the IDE's *File → Examples → 01.Basics → Blink* (or the seller's OLED demo) to prove the board, cable and driver work.

> WSL note: the Arduino IDE runs on **Windows**. Open the repo from `\\wsl.localhost\Ubuntu\home\hon\Dev\cloud\HeatTrace`, or keep the sketch on Windows and copy `secrets.h` across.

## 1. Wiring (breadboard)

| Part | ESP32 pin | Note |
|---|---|---|
| DHT11/DHT22 | **GPIO 4** | 10 kΩ pull-up DATA→3V3 if the module has none; power from **3V3** |
| Photoresistor + 330 Ω divider | **GPIO 34** | input-only ADC1 pin (ADC2 pins don't work while Wi-Fi is on) |
| WS2812 | **GPIO 5** | DIN; 5V/VIN for power if bright, 3V3 OK for one LED |
| Button | **GPIO 14** | other leg to GND; `INPUT_PULLUP`, pressed = LOW. (GPIO 0 also works but is the BOOT pin) |
| Buzzer | **GPIO 13** | stand-in for the vibration motor |
| OLED | built-in I2C | |

⚠️ **Check the OLED's I2C pins first.** Many "ESP32 + OLED" boards wire the OLED to **SDA=GPIO 5, SCL=GPIO 4**, which clashes with the DHT and WS2812 above. Look at the silkscreen or the seller's example (`Wire.begin(SDA, SCL)`), or run an I2C scanner sketch. If it uses 4/5, move **DHT → GPIO 27** and **WS2812 → GPIO 25** and use those numbers below.

**Check:** nothing gets warm; the board still boots with everything plugged in (if it doesn't, the button or a part is pulling a boot pin; move it).

## 2. Milestone 5.1: Sense

Every 10 s: read DHT (`ta`, `rh`) and `analogRead(34)` (0–4095); print to Serial and the OLED.

- `dht.readTemperature()` returns `NAN` on a failed read. Skip that sample, don't send it.
- DHT11 reads at most once per second and only 20–90 % RH, 0–50 °C. DHT22 is better if the kit has it.

**Check:** breathing on the sensor raises RH; covering the photoresistor drops the ADC value.

## 3. Milestone 5.2: Local WBGT

Port `cloud/shared/wbgt.py` to C. It must give the same numbers as the cloud.

```cpp
// Constants: same defaults as ht_config "wbgt" (k_nwb=0, k_sun=0.02, k_wind=0.5)
float K_NWB = 0.0, K_SUN = 0.02, K_WIND = 0.5;
float windMps = 1.0;                       // replaced by heattrace/all/wind in 5.5

float stullWetBulb(float ta, float rh) {
  return ta * atanf(0.151977f * sqrtf(rh + 8.313659f)) + atanf(ta + rh)
       - atanf(rh - 1.676331f) + 0.00391838f * powf(rh, 1.5f) * atanf(0.023101f * rh)
       - 4.686035f;
}
float wbgtEstimate(float ta, float rh, float lux) {
  float tnwb = stullWetBulb(ta, rh) + K_NWB;
  float tg   = ta + 0.0079f * lux * K_SUN / (1.0f + K_WIND * fmaxf(windMps, 0));
  return roundf((0.7f * tnwb + 0.2f * tg + 0.1f * ta) * 10) / 10;
}
```

- **Pseudo-lux** for now: `lux = adc * 90000.0 / 4095` (flip to `4095 - adc` if covering the sensor makes it go *up*).
- Keep a **6-sample rolling average** of `wbgtEstimate()` (a ring of 6 floats). Use the average, not single readings, for alerts.

**Check:** these must match within 0.1 (same table the cloud uses):

| ta | rh | lux | WBGT |
|---|---|---|---|
| 30 | 70 | 0 | 26.9 |
| 38 | 60 | 0 | 33.2 |
| 45 | 20 | 60000 | 33.0 |

## 4. Milestone 5.3: Local alert (no Wi-Fi needed)

A small state machine on the hat:

| State | LED | Enter when | Leave when |
|---|---|---|---|
| `ok` | off | | rolling avg ≥ 32.0 → `alert` |
| `alert` | **red** + buzzer pulse (300 ms every 2 s) | avg ≥ 32.0, or cloud `{"alert":1}` | button → `resting` |
| `resting` | **amber** | button press | 15 min passed **and** avg < 31.5 → `ok` |

**Check (Guide "Done when", part 1):** unplug Wi-Fi (or don't connect yet). A hair dryer on the DHT turns the LED red within one or two readings.
Tip: a hair dryer gives hot **and dry** air (≈ 45 °C, 20 % RH → WBGT ≈ 31.8, just under). Also shine a phone torch on the photoresistor (adds about 1 °C), or breathe on the sensor first.

## 5. Milestone 5.4: Connect to AWS

**5.4a Generate `secrets.h`** (in WSL, from the repo root). Use a **2.4 GHz** network: a phone hotspot is easiest; campus WPA2-Enterprise Wi-Fi won't work with this code.

```bash
cd ~/Dev/cloud/HeatTrace
python3 cloud/scripts/make_secrets_h.py W01 --ssid "YourHotspot" --password "hotspot-password"
# → firmware/hat/secrets.h  (endpoint, W01 cert + key, Root CA; gitignored)
```

**5.4b Connect.** The parts that matter:

```cpp
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "secrets.h"

WiFiClientSecure net;
PubSubClient mqtt(net);
uint32_t seq = 0;

void connectAws() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(250);

  configTime(0, 0, "pool.ntp.org", "time.google.com");   // UTC; ts must be Unix seconds

  net.setCACert(AWS_ROOT_CA);
  net.setCertificate(DEVICE_CERT);
  net.setPrivateKey(DEVICE_KEY);
  mqtt.setServer(AWS_IOT_ENDPOINT, AWS_IOT_PORT);
  mqtt.setBufferSize(512);       // default 256 is too small for topic + payload
  mqtt.setKeepAlive(60);
  mqtt.setCallback(onMessage);   // 5.5
  while (!mqtt.connect(WORKER_ID)) {   // client ID MUST be "W01"
    Serial.printf("MQTT connect failed, state=%d\n", mqtt.state());
    delay(2000);
  }
  mqtt.subscribe("heattrace/" WORKER_ID "/cmd", 1);
  mqtt.subscribe("heattrace/all/wind", 1);
}

uint32_t unixTs() { time_t t = time(nullptr); return t > 1700000000 ? (uint32_t)t : 0; } // 0 = not synced

void publishData(float ta, float rh, float lux, float wbgt, int alert) {
  JsonDocument d;
  d["w"] = WORKER_ID; d["z"] = "Z3";
  d["ta"] = roundf(ta * 10) / 10; d["rh"] = (int)roundf(rh); d["lux"] = (int)lux;
  d["tg"] = nullptr;                       // no globe sensor yet
  d["wbgt"] = wbgt; d["alert"] = alert;
  d["ts"] = unixTs(); d["seq"] = ++seq;
  char buf[256]; size_t n = serializeJson(d, buf);
  mqtt.publish("heattrace/" WORKER_ID "/data", (const uint8_t*)buf, n, false);
}
```

- Call `mqtt.loop()` every pass of `loop()`, and reconnect if `!mqtt.connected()`. **Never block the local alert on the network**: sensing and the LED must keep running while Wi-Fi is down.
- Publish `data` every 10 s and `status` every 60 s: `{"w":"W01","batt":0,"rssi":WiFi.RSSI(),"buffered":0}` (no battery yet, so send 0).
- PubSubClient publishes at QoS 0 (it can only *subscribe* at QoS 1). That's fine for now; the offline ring buffer in Step 7 is what covers lost messages.

**Check:** the serial monitor shows the connection succeeding. Then, in WSL:

```bash
aws login --region ap-southeast-2          # if your session expired
aws logs tail /aws/lambda/process_reading --region ap-southeast-2 --follow --format short | grep W01
```
You should see `reading W01 z=Z3 ts=… wbgt_cloud=… status=ok` every 10 s. Or, in the console: **IoT → MQTT test client → subscribe `heattrace/W01/#`**.

| `mqtt.state()` / symptom | Usual cause |
|---|---|
| `-2` (connect failed) | Wrong endpoint, no internet, or a 5 GHz-only network |
| TLS / handshake errors in Serial | Cert or key pasted wrong: regenerate `secrets.h`; check that NTP set the clock (TLS needs the date) |
| Connects, then drops right away | Client ID isn't exactly `W01`, or it published to a topic outside its policy (e.g. another worker's, or its own `cmd`) |
| Connects, no `reading W01` in logs | Payload > 256 B or not JSON; missing `w`/`ta` (check `process_reading` logs for `rejected payload`) |

## 6. Milestone 5.5: Receive

```cpp
void onMessage(char* topic, byte* payload, unsigned int len) {
  JsonDocument d;
  if (deserializeJson(d, payload, len)) return;              // ignore non-JSON
  if (strcmp(topic, "heattrace/all/wind") == 0) {            // {"ws":1.8,"ts":...}
    windMps = d["ws"] | windMps;
  } else {                                                   // heattrace/W01/cmd
    int a = d["alert"] | -1;
    if (a == 1) enterAlert(d["reason"] | "self");            // "buddy": light red even if local avg is low
    else if (a == 0) cloudClear();                           // see note below
  }
}
```

`{"alert":0}` arrives in two cases: the cloud cleared the alert (rest window over, avg < 31.5), or your **buddy** acked. If you're in a *buddy* alert, go back to `ok`. If you're `resting`, finish the rest window as usual.

**Check:**
1. In the MQTT test client, publish `{"alert":1,"reason":"self"}` to `heattrace/W01/cmd`. The LED goes red.
2. Wind arrives every 5 min (scheduled `fetch_wind`); print `windMps` on the OLED and it changes from 1.0.

## 7. Milestone 5.6: Ack

On a button press (debounce 50 ms) while in `alert`:
- publish `{"w":"W01","ts":<unixTs()>}` to `heattrace/W01/ack`
- go to `resting` (amber), start the 15-min timer

**Check:** with Wi-Fi on, heat the sensor until the **cloud** raises the alert (`raised A-W01-…` in `process_reading` logs, and a `cmd` arrives). A manual `cmd` from the test client doesn't create an `ht_alerts` row, so acking it does nothing in the cloud. Then press the button:
```bash
aws logs tail /aws/lambda/ack_handler --region ap-southeast-2 --since 5m --format short
```
shows `acked A-W01-… (W01)` and `publish heattrace/W02/cmd {"alert":0}`. In DynamoDB, `ht_workers` → W01 shows `status = resting`.

## 8. Milestone 5.7: Buddy demo (one board + simulator)

The simulator plays every worker except W01, and spikes **W02**, W01's buddy:

```bash
cd ~/Dev/cloud/HeatTrace
simulator/.venv/bin/python simulator/fake_hat.py --broker aws --workers 8 --exclude W01 --spike W02
```

About 70–110 s in, the cloud raises W02's alert. **The real hat lights red with reason `buddy`**, and the simulator prints `RECV {"alert": 1, "reason": "self"}` for W02. When the simulator auto-acks W02, the hat gets `{"alert":0}` and turns off.

**Done when (Guide Step 5):** hair-dryer heat turns the LED red with Wi-Fi off, and with Wi-Fi on the alert shows up in `ht_alerts` / the dashboard, and the simulator-W02 buddy cmd lights the real hat.

---

### Rules of thumb
- **Never** run the simulator without `--exclude W01` while the board is on: both would publish as W01 and the data mixes.
- Keep `secrets.h` out of git (already ignored) and don't paste it into chats.
- When a second board arrives: `make_secrets_h.py W02 …`, flash the same firmware, and add `--exclude W02` to the simulator.
- Step 6 (SHT31, BH1750, MLX90614, battery) only swaps sensor drivers and pins. The MQTT and alert code above carries over.
