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
    for index, day in ipairs(calendar.days) do
        if now >= day.start and now < day.finish then
            for _, prayer in ipairs(day.prayers) do
                if now >= prayer.at and now < prayer.at + 60 then
                    return { status = "due", day = day, next = prayer,
                        tomorrow = false, countdown = "00:00:00" }
                end
                if prayer.at > now then
                    return { status = "upcoming", day = day, next = prayer,
                        tomorrow = false, countdown = M.countdown(prayer.at - now) }
                end
            end
            local tomorrow = calendar.days[index + 1]
            if tomorrow and tomorrow.start == day.finish and tomorrow.prayers[1] then
                return { status = "upcoming", day = day, next = tomorrow.prayers[1],
                    tomorrow = true, countdown = M.countdown(tomorrow.prayers[1].at - now) }
            end
            return { status = "missing-next-day", day = day, countdown = "--:--:--" }
        end
    end
    return { status = "unavailable", countdown = "--:--:--" }
end

return M
