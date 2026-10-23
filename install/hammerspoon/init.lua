-- =======================================================================
-- Hammerspoon Configuration: Poltergeist Browser Remote (with Visual Alerts)
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

-- Helper: Queries all active browser profile sockets and returns the first active result
local function queryMeetAction(actionName)
    local handle = io.popen("ls __PGR_SOCKET_DIR__/poltergeist_*.sock 2>/dev/null")
    if not handle then
        return nil, "No browser instances running"
    end

    local sockets = {}
    for sock in handle:lines() do
        table.insert(sockets, sock)
    end
    handle:close()

    if #sockets == 0 then
        return nil, "No browser profile sockets found"
    end

    -- Query each running profile
    for _, sock in ipairs(sockets) do
        local cmd = string.format('echo \'{"action":"%s"}\' | nc -U -w 2 %s 2>/dev/null', actionName, sock)
        local output = hs.execute(cmd)

        if output and output ~= "" then
            local ok, resp = pcall(hs.json.decode, output)
            if ok and resp and resp.success and resp.result then
                local res = resp.result
                -- Return as soon as we get a response from the profile hosting the active call
                if res.status == "SUCCESS" or res.executed == true then
                    return res, nil
                end
            end
        end
    end

    return nil, "No active Google Meet call"
end

-- =======================================================================
-- Handlers with Visual Feedback
-- =======================================================================

-- F13: Toggle Microphone
local function handleToggleMic()
    local res, err = queryMeetAction("meet_toggle_mic")

    if err then
        hs.alert.show("🎙️ " .. err, 1.5)
        return
    end

    if res.after == "UNMUTED" then
        hs.alert.show("🎙️ Mic: ON (Unmuted)", 1.5)
    elseif res.after == "MUTED" then
        hs.alert.show("🎙️ Mic: OFF (Muted)", 1.5)
    else
        hs.alert.show("🎙️ Mic: " .. tostring(res.after), 1.5)
    end
end

-- F14: Toggle Camera
local function handleToggleCam()
    local res, err = queryMeetAction("meet_toggle_cam")

    if err then
        hs.alert.show("📷 " .. err, 1.5)
        return
    end

    if res.after == "CAMERA_ON" then
        hs.alert.show("📷 Camera: ON", 1.5)
    elseif res.after == "CAMERA_OFF" then
        if res.changed then
            hs.alert.show("📷 Camera: OFF", 1.5)
        else
            -- Guardrail triggered: camera cannot be enabled from background
            hs.alert.show("📷 Camera: OFF\n(Press F15 to focus window first)", 2.5)
        end
    else
        hs.alert.show("📷 Camera: " .. tostring(res.after), 1.5)
    end
end

-- F15: Focus Active Meet Window
local function handleFocusMeet()
    local res, err = queryMeetAction("meet_focus")

    if err then
        hs.alert.show("🪟 " .. err, 1.5)
        return
    end

    local activeCallCode = res.callCode
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
                    hs.alert.show(string.format("🪟 Focused: %s", activeCallCode), 1.5)
                    return true
                end
            end

            if tries >= 10 then
                hs.alert.show(string.format("⚠️ Switched tab [%s], but window could not be raised", activeCallCode), 2.0)
                return true
            end
            return false
        end,
        0.05
    )
end

-- =======================================================================
-- Karabiner Hotkey Mappings (G513)
-- =======================================================================

hs.hotkey.bind({}, "F13", handleToggleMic)
hs.hotkey.bind({}, "F14", handleToggleCam)
hs.hotkey.bind({}, "F15", handleFocusMeet)

hs.alert.show("Poltergeist Browser Remote Ready", 1.5)
