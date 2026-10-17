-- Pure countdown logic. All times are Unix seconds, independent of device timezone.
local M = {}

function M.countdown(seconds)
    seconds = math.max(0, math.ceil(seconds))
    return string.format("%02d:%02d:%02d", math.floor(seconds / 3600),
        math.floor(seconds / 60) % 60, seconds % 60)
end

function M.state(calendar, now)
    if type(now) ~= "number" or now ~= now then
        return { status = "unavailable", countdown = "--:--:--" }
    end
    local function event(day, prayer, phase, at, time, tomorrow, source, due, adhanNow)
        return { status = due and "due" or "upcoming", day = day, next = prayer,
            phase = phase, at = at, time = time, tomorrow = tomorrow or false,
            source = source, adhanNow = adhanNow or false,
            countdown = due and "00:00:00" or M.countdown(at - now) }
    end
    for index, day in ipairs(calendar.days) do
        if now >= day.start and now < day.finish then
            for _, prayer in ipairs(day.prayers) do
                if prayer.at > now then
                    return event(day, prayer, "adhan", prayer.at, prayer.time)
                end
                if now < prayer.iqamaAt then
                    return event(day, prayer, "iqama", prayer.iqamaAt,
                        prayer.iqamaTime, false, prayer.iqamaSource,
                        false, now < prayer.at + 60)
                end
                if now < prayer.iqamaAt + 60 then
                    return event(day, prayer, "iqama", prayer.iqamaAt,
                        prayer.iqamaTime, false, prayer.iqamaSource, true)
                end
                if prayer.id == "fajr" then
                    if now < day.sunriseAt then
                        return event(day, nil, "sunrise", day.sunriseAt, day.sunrise)
                    end
                    if now < day.sunriseAt + 60 then
                        return event(day, nil, "sunrise", day.sunriseAt, day.sunrise, false, nil, true)
                    end
                end
            end
            local tomorrow = calendar.days[index + 1]
            if tomorrow and tomorrow.start == day.finish and tomorrow.prayers[1] then
                return event(day, tomorrow.prayers[1], "adhan", tomorrow.prayers[1].at,
                    tomorrow.prayers[1].time, true)
            end
            return { status = "missing-next-day", day = day, countdown = "--:--:--" }
        end
    end
    return { status = "unavailable", countdown = "--:--:--" }
end

return M
