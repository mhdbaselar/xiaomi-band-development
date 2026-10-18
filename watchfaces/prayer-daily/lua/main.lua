local lvgl = require("lvgl")
local dataman = require("dataman")
local calendar = require("prayer_calendar")
local prayers = require("prayer_logic")

local screen = lvgl.Object(nil, {
    w = lvgl.HOR_RES(), h = lvgl.VER_RES(),
    bg_color = 0x000000, bg_opa = lvgl.OPA(100),
    border_width = 0, pad_all = 0
})
screen:clear_flag(lvgl.FLAG.SCROLLABLE)
screen:add_flag(lvgl.FLAG.EVENT_BUBBLE)
-- Keep the content layer at fixed pixel coordinates. Auto-sized labels with
-- TOP_MID alignment can be repositioned when their text changes on firmware.
local root = lvgl.Object(screen, {
    x = 0, y = 0, w = 212, h = 520,
    bg_opa = 0, border_width = 0, pad_all = 0
})
root:clear_flag(lvgl.FLAG.SCROLLABLE)
root:add_flag(lvgl.FLAG.EVENT_BUBBLE)

local fonts = {}
local function label(y, size, color, value, x, width)
    if not fonts[size] then fonts[size] = lvgl.Font("MiSans-Regular", size) end
    local obj = lvgl.Label(root, {
        x = x or 0, y = y, w = width or 212, h = size + 8, pad_all = 0,
        text_align = lvgl.ALIGN.TOP_MID,
        text_font = fonts[size], text_color = color, text = value
    })
    obj:add_flag(lvgl.FLAG.EVENT_BUBBLE)
    return obj
end

local clock = label(64, 52, 0xF1F4F2, "--:--")
local date = label(127, 15, 0x98A5A1, "-- --.--.----")
local caption = label(185, 14, 0x85A496, "...")
local countdownColor = 0x9EE4C1
local countdown = label(210, 40, countdownColor, "--:--:--")

label(295, 12, 0x879892, "WETTER", 14, 90)
local temperature = label(315, 25, 0x90C6F4, "--°C", 14, 90)
local condition = label(349, 12, 0x98A5A1, "--", 14, 90)
label(295, 12, 0x879892, "AKKU", 114, 84)
local battery = label(315, 25, 0xB6DCC8, "--%", 114, 84)

label(391, 12, 0x879892, "SCHRITTE", 14, 90)
local steps = label(411, 23, 0xE6BD82, "--", 14, 90)
label(391, 12, 0x879892, "PULS", 114, 84)
local heartRate = label(411, 25, 0xF1A7A5, "--", 114, 84)
label(445, 12, 0x879892, "bpm", 114, 84)

local active = true
local lastSecond = nil
local shown = {}
local function setText(obj, value)
    if shown[obj] ~= value then
        obj:set { text = value }
        shown[obj] = value
    end
end

local function setCountdown(value, phase)
    local color = phase == "iqama" and 0xFF4D4D or 0x9EE4C1
    if countdownColor ~= color then
        countdown:set { text_color = color }
        countdownColor = color
    end
    setText(countdown, value)
end

local weekdays = { "SO", "MO", "DI", "MI", "DO", "FR", "SA" }
local adhanNames = {
    fajr = "Fajir", dhuhr = "Dhuhr", asr = "Asr", maghrib = "Maghrib", isha = "Isha"
}
local weatherNames = {
    [0] = "Klar", [1] = "Wolkig", [2] = "Bedeckt", [3] = "Schauer",
    [4] = "Gewitter", [5] = "Hagel", [6] = "Schneeregen",
    [7] = "Regen", [8] = "Regen", [9] = "Starkregen",
    [10] = "Starkregen", [11] = "Starkregen", [12] = "Starkregen",
    [13] = "Schneeschauer", [14] = "Schnee", [15] = "Schnee",
    [16] = "Schnee", [17] = "Schneesturm", [18] = "Nebel",
    [19] = "Eisregen", [20] = "Sandsturm", [21] = "Regen",
    [22] = "Regen", [23] = "Starkregen", [24] = "Starkregen",
    [25] = "Starkregen", [26] = "Schnee", [27] = "Schnee",
    [28] = "Schneesturm", [29] = "Staub", [30] = "Sand",
    [31] = "Sandsturm", [32] = "Nebel", [33] = "Schnee",
    [49] = "Nebel", [53] = "Dunst", [54] = "Dunst", [55] = "Dunst",
    [56] = "Dunst", [57] = "Dunst", [58] = "Dunst", [301] = "Regen"
}
local metrics = {}
local function renderMetrics()
    setText(battery, metrics.battery and string.format("%d%%", metrics.battery) or "--%")
    setText(temperature, metrics.temperature and string.format("%d°C", metrics.temperature) or "--°C")
    setText(condition, weatherNames[metrics.weather] or "--")
    local count = metrics.steps
    local formatted = "--"
    if count then
        formatted = count < 1000 and tostring(count) or
            string.format("%d.%03d", math.floor(count / 1000), count % 1000)
    end
    setText(steps, formatted)
    setText(heartRate, metrics.heartRate and tostring(metrics.heartRate) or "--")
end

local function render(now)
    local state = prayers.state(calendar, now)
    setText(clock, os.date("%H:%M", now))
    setText(date, weekdays[tonumber(os.date("%w", now)) + 1] .. " " .. os.date("%d.%m.%Y", now))
    local title = "Kalender erneuern"
    if state.phase == "iqama" then
        title = state.status == "due" and "Iqama jetzt" or "Iqama in"
    elseif state.phase == "sunrise" then
        title = state.status == "due" and "Shuruk jetzt" or "Shuruk in"
    elseif state.phase == "adhan" then
        title = (adhanNames[state.next.id] or state.next.label) .. " in"
    end
    setText(caption, title)
    setCountdown(state.countdown, state.phase)
    renderMetrics()
end

local function refresh(force)
    if not active then return end
    local now = os.time()
    if not force and now == lastSecond then return end
    lastSecond = now
    local ok = pcall(render, now)
    if not ok then
        setText(caption, "Uhr synchronisieren")
        setCountdown("--:--:--")
    end
end

-- Use the firmware's clock updates; no animation loop or always-running timer.
dataman.subscribe("timeSecond", countdown, function(obj, value) refresh(false) end)

-- Firmware values are Q24.8 (one unit = 256). Unsupported optional channels
-- must not prevent the clock and prayer countdown from loading.
local function subscribeMetric(topic, key, obj, minimum, maximum)
    pcall(function()
        dataman.subscribe(topic, obj, function(_, raw)
            local value = nil
            if type(raw) == "number" and raw == raw and raw > -math.huge and raw < math.huge then
                local decoded = raw / 256
                if decoded >= minimum and decoded <= maximum then
                    value = math.floor(decoded + 0.5)
                end
            end
            metrics[key] = value
            if active then renderMetrics() end
        end)
    end)
end
subscribeMetric("systemStatusBattery", "battery", battery, 0, 100)
subscribeMetric("weatherCurrentTemperature", "temperature", temperature, -99, 99)
subscribeMetric("weatherCurrentWeather", "weather", condition, 0, 301)
subscribeMetric("healthStepCount", "steps", steps, 0, 99999)
subscribeMetric("healthHeartRate", "heartRate", heartRate, 20, 300)

function ScreenStateChangedCB(previous, current, reason)
    active = current == "ON"
    if active then refresh(true) end
end

function pageOnPause()
    active = false
end

function pageOnResume()
    active = true
    refresh(true)
end

refresh(true)
