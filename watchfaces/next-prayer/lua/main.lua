local lvgl = require("lvgl")
local dataman = require("dataman")
local calendar = require("prayer_calendar")
local prayers = require("prayer_logic")

local root = lvgl.Object(nil, {
    w = lvgl.HOR_RES(), h = lvgl.VER_RES(),
    bg_color = 0x000000, bg_opa = lvgl.OPA(100),
    border_width = 0, pad_all = 0
})
root:clear_flag(lvgl.FLAG.SCROLLABLE)
root:add_flag(lvgl.FLAG.EVENT_BUBBLE)

local fonts = {}
local function label(y, size, color, value)
    if not fonts[size] then fonts[size] = lvgl.Font("MiSans-Regular", size) end
    local obj = lvgl.Label(root, {
        align = lvgl.ALIGN.TOP_MID, x = 0, y = y,
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
    if not state.next then
        setText(heading, "GEBETSZEITEN")
        setText(name, "Keine Daten")
        setText(target, "Kalender erneuern")
        setText(countdown, "--:--:--")
        setText(status, "HALLE / SAALE")
        return
    end
    setText(heading, state.status == "due" and "JETZT IST GEBETSZEIT" or "NAECHSTES GEBET")
    setText(name, state.next.label)
    setText(target, (state.tomorrow and "Morgen " or "") .. state.next.time)
    setText(countdown, state.countdown)
    setText(status, state.status == "due" and "ADHAN" or "BIS ZUM ADHAN")
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
