local directory = arg[1]
package.path = directory .. '/?.lua;' .. package.path
local calendar = require('prayer_calendar')
local prayers = require('prayer_logic')
local vectors = dofile(directory .. '/vectors.lua')
for _, vector in ipairs(vectors) do
    local state = prayers.state(calendar, vector.at)
    assert(state.status == vector.status, 'Status at ' .. vector.at)
    assert(state.countdown == vector.countdown, 'Countdown at ' .. vector.at)
    assert((state.next and state.next.id) == vector.next, 'Prayer at ' .. vector.at)
    assert((state.tomorrow or false) == vector.tomorrow, 'Tomorrow at ' .. vector.at)
end
assert(prayers.countdown(90000) == '25:00:00')
assert(prayers.countdown(-1) == '00:00:00')
assert(prayers.state({ days = {} }, 0).status == 'unavailable')
local gap = { days = { calendar.days[1], calendar.days[3] } }
assert(prayers.state(gap, calendar.days[1].prayers[5].at + 60).status == 'missing-next-day')
print(#vectors .. ' Lua/JS boundary comparisons passed (including DST).')

local host = dofile((arg[0]:match('(.*/)') or './') .. 'host.lua')
local target = calendar.days[1].prayers[2].at
local app = host.start(directory, target - 120)
assert(app:text(329) == '00:02:00')
app:tick(target - 119)
assert(app:text(329) == '00:01:59', 'Must update on timeSecond')
app:tick(target - 118)
assert(app:text(329) == '00:01:58')
ScreenStateChangedCB('ON', 'OFF', '')
app:tick(target - 50)
assert(app:text(329) == '00:01:58', 'No repaint while screen off')
ScreenStateChangedCB('OFF', 'ON', '')
assert(app:text(329) == '00:00:50', 'Must recompute immediately on wake')
app:tick(target)
assert(app:text(199) == 'JETZT IST GEBETSZEIT')
assert(app:text(329) == '00:00:00')
app:tick(target + 60)
assert(app:text(227) == 'Asr')
app:tick(target - 1)
assert(app:text(227) == 'Dhuhr', 'Backward clock correction must recompute')
assert(app:text(329) == '00:00:01')
pageOnPause()
app:tick(calendar.days[1].prayers[5].at + 60)
pageOnResume()
assert(app:text(227) == 'Fajr')
assert(app:text(273) == 'Morgen ' .. calendar.days[2].prayers[1].time)
app:tick(calendar.days[#calendar.days].finish)
assert(app:text(329) == '--:--:--')
assert(app:text(273) == 'Kalender erneuern')
for _, obj in ipairs(app.labels) do assert(obj.flags[2], 'Long-press must bubble to system') end
for _, obj in ipairs(app.labels) do
    local p = obj.props
    assert(p.align == nil, 'Text labels must not use dynamic object alignment')
    assert(p.x == 0 and p.w == 212 and p.h >= p.text_font.size, 'Text must have a fixed display lane')
    assert(p.y >= 0 and p.y + p.h <= 520, 'Text lane outside screen')
end
print('Lifecycle and live countdown passed: second ticks, sleep/wake, prayer change, clock correction, tomorrow, expiry.')
