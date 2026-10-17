local location = arg[0]:match('(.*/)') or './'
local host = dofile(location .. 'host.lua')
local app = host.start(arg[1], assert(tonumber(arg[2])))
local topics = { 'systemStatusBattery', 'weatherCurrentTemperature',
    'weatherCurrentWeather', 'healthStepCount', 'healthHeartRate' }
for index, topic in ipairs(topics) do
    local value = tonumber(arg[index + 2])
    if value then app:metric(topic, value) end
end
local function quote(value)
    return '"' .. value:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\r', '\\r') .. '"'
end
local output = {}
for _, obj in ipairs(app.labels) do
    local p = obj.props
    output[#output + 1] = string.format('{"x":%d,"y":%d,"w":%d,"h":%d,"size":%d,"color":%d,"text":%s}',
        p.x, p.y, p.w, p.h, p.text_font.size, p.text_color, quote(p.text))
end
print('[' .. table.concat(output, ',') .. ']')
