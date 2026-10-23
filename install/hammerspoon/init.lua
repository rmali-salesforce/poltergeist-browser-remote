-- =======================================================================
-- Hammerspoon Configuration: Action Bridge (Bidirectional)
-- =======================================================================

-- Auto-reload Hammerspoon when config changes
local configWatcher = hs.pathwatcher.new(os.getenv("HOME") .. "/.hammerspoon/", function(files)
    for _, file in pairs(files) do
        if file:sub(-4) == ".lua" then
            hs.reload()
            return
        end
    end
end):start()

-- Helper: Broadcast an action to all running Firefox profiles
local function broadcastAction(actionName)
    local cmd = string.format([[
        for sock in __FF_SOCKET_DIR__/firefox_*.sock; do
            [ -S "$sock" ] && echo '{"action":"%s"}' | nc -U -w 1 "$sock" 2>/dev/null
        done
    ]], actionName)
    hs.execute(cmd)
end

-- Focus ONLY the window with the active call by matching its native room code
local function focusActiveMeetCall()
    local handle = io.popen("ls __FF_SOCKET_DIR__/firefox_*.sock 2>/dev/null")
    if not handle then return end

    local activeCallCode = nil

    -- 1. Query sockets to identify which profile has the active call
    for sock in handle:lines() do
        local cmd = string.format('echo \'{"action":"meet_focus"}\' | nc -U -w 2 %s 2>/dev/null', sock)
        local output = hs.execute(cmd)

        if output and output ~= "" then
            local ok, resp = pcall(hs.json.decode, output)
            if ok and resp and resp.success and resp.result and resp.result.executed and resp.result.callCode then
                activeCallCode = resp.result.callCode
                break
            end
        end
    end
    handle:close()

    if not activeCallCode then
        hs.alert.show("No active Google Meet call")
        return
    end

    -- 2. Find and raise only that window (plain string match avoids hyphen regex escaping)
    local tries = 0
    hs.timer.doUntil(
        function()
            tries = tries + 1
            for _, win in ipairs(hs.window.allWindows()) do
                local title = win:title()
                if title and title:find(activeCallCode, 1, true) then
                    if win:isMinimized() then
                        win:unminimize()
                    end
                    win:focus()
                    return true
                end
            end
            return tries >= 10 -- retry for up to 500ms
        end,
        0.05
    )
end

-- =======================================================================
-- Karabiner Hotkeys (G513 Keyboard)
-- =======================================================================

hs.hotkey.bind({}, "F13", function() broadcastAction("meet_toggle_mic") end)
hs.hotkey.bind({}, "F14", function() broadcastAction("meet_toggle_cam") end)
hs.hotkey.bind({}, "F15", function() focusActiveMeetCall() end)

hs.alert.show("Hammerspoon Bridge Ready")
