local location = arg[0]:match('(.*/)') or './'
local host = dofile(location .. 'host.lua')
local app = host.start(arg[1], assert(tonumber(arg[2])))
local function quote(value)
    return '"' .. value:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\r', '\\r') .. '"'
end
local output = {}
for _, obj in ipairs(app.labels) do
    local p = obj.props
    output[#output + 1] = string.format('{"y":%d,"size":%d,"color":%d,"text":%s}', p.y, p.text_font.size, p.text_color, quote(p.text))
end
print('[' .. table.concat(output, ',') .. ']')
