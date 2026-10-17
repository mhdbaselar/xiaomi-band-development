-- Minimal host adapter for tests and preview. Runs the real main.lua; does not
-- emulate LVGL layout, firmware packaging, fonts or hardware behavior.
local M = {}
function M.start(directory, timestamp)
    local app = { now = timestamp, labels = {}, subscriptions = {} }
    local lvgl = {
        FLAG = { SCROLLABLE = 1, EVENT_BUBBLE = 2 }, ALIGN = { TOP_MID = 1 },
        HOR_RES = function() return 212 end, VER_RES = function() return 520 end,
        OPA = function(value) return value end,
        Font = function(name, size) return { name = name, size = size } end
    }
    local function object(parent, props)
        local obj = { props = props, flags = {} }
        function obj:set(values) for key, value in pairs(values) do self.props[key] = value end end
        function obj:add_flag(flag) self.flags[flag] = true end
        function obj:clear_flag(flag) self.flags[flag] = nil end
        return obj
    end
    lvgl.Object = object
    lvgl.Label = function(parent, props)
        local obj = object(parent, props)
        app.labels[#app.labels + 1] = obj
        return obj
    end
    package.loaded.lvgl = lvgl
    package.loaded.dataman = { subscribe = function(topic, obj, callback)
        assert(not app.subscriptions[topic], "Duplicate subscription")
        app.subscriptions[topic] = function(value) callback(obj, value) end
    end }
    package.loaded.prayer_calendar = nil
    package.loaded.prayer_logic = nil
    package.path = directory .. '/?.lua;' .. package.path
    os.time = function() return app.now end
    dofile(directory .. '/main.lua')
    function app:tick(now)
        self.now = now
        assert(self.subscriptions.timeSecond, "No second subscription")
        self.subscriptions.timeSecond((now % 60) * 256)
    end
    function app:text(y)
        for _, obj in ipairs(self.labels) do if obj.props.y == y then return obj.props.text end end
        error("Missing label at " .. y)
    end
    return app
end
return M
