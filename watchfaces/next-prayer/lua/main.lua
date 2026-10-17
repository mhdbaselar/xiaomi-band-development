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
local function label(y, size, color, value)
    if not fonts[size] then fonts[size] = lvgl.Font("MiSans-Regular", size) end
    local obj = lvgl.Label(root, {
        x = 0, y = y, w = 212, h = size + 8, pad_all = 0,
        text_align = lvgl.ALIGN.TOP_MID,
        text_font = fonts[size], text_color = color, text = value
    })
    obj:add_flag(lvgl.FLAG.EVENT_BUBBLE)
    return obj
end

label(54, 16, 0x9AAEA5, "HALLE / SAALE")
local clock = label(88, 44, 0xEEEAE2, "--:--")
local date = label(143, 16, 0x9AAEA5, "--.--.----")
local heading = label(199, 16, 0x9AAEA5, "NAECHSTES GEBET")
local name = label(227, 32, 0x85C9AD, "...")
local target = label(273, 24, 0xEEEAE2, "--:--")
local countdown = label(329, 32, 0xEEEAE2, "--:--:--")
local status = label(377, 16, 0x9AAEA5, "BIS ZUM ADHAN")
local footer = label(426, 14, 0x9AAEA5, "Kalender bis " .. calendar.validThrough)

local active = true
local lastSecond = nil
local shown = {}
local function setText(obj, value)
    if shown[obj] ~= value then
        obj:set { text = value }
        shown[obj] = value
    end
end

local function render(now)
    local state = prayers.state(calendar, now)
    setText(clock, os.date("%H:%M", now))
    setText(date, os.date("%d.%m.%Y", now))
    if not state.phase then
        setText(heading, "GEBETSZEITEN")
        setText(name, "Keine Daten")
        setText(target, "Kalender erneuern")
        setText(countdown, "--:--:--")
        setText(status, "HALLE / SAALE")
        setText(footer, "Kalender bis " .. calendar.validThrough)
        return
    end
    if state.phase == "sunrise" then
        setText(heading, "SONNENAUFGANG")
        setText(name, "Shuruq")
        setText(status, state.status == "due" and "JETZT" or "BIS ZUM AUFGANG")
    elseif state.phase == "iqama" then
        setText(heading, state.status == "due" and "IQAMA JETZT" or "NAECHSTE IQAMA")
        setText(name, state.next.label)
        setText(status, state.status == "due" and "GEBET BEGINNT" or
            state.adhanNow and "ADHAN JETZT · BIS IQAMA" or "BIS ZUR IQAMA")
    else
        setText(heading, "NAECHSTER ADHAN")
        setText(name, state.next.label)
        setText(status, "BIS ZUM ADHAN")
    end
    setText(target, (state.tomorrow and "Morgen " or "") .. state.time)
    setText(countdown, state.countdown)
    if state.phase == "iqama" then
        setText(footer, state.source == "mawaqit" and "Iqama: MAWAQIT" or
            "Iqama: +" .. calendar.iqamaFallbackMinutes .. " Min. (Standard)")
    else
        setText(footer, "Kalender bis " .. calendar.validThrough)
    end
end

local function refresh(force)
    if not active then return end
    local now = os.time()
    if not force and now == lastSecond then return end
    lastSecond = now
    local ok = pcall(render, now)
    if not ok then
        setText(name, "Zeitfehler")
        setText(target, "Uhr synchronisieren")
        setText(countdown, "--:--:--")
    end
end

-- Use the firmware's clock updates; no animation loop or always-running timer.
dataman.subscribe("timeSecond", countdown, function(obj, value) refresh(false) end)

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
