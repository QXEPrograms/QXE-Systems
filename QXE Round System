-- QXE Round System v1.0 | (c) 2026 QXEPrograms
-- Advanced round-based game loop: state machine, scoring, timers, teleportation

local Players    = game:GetService('Players')
local RS         = game:GetService('ReplicatedStorage')
local RunService = game:GetService('RunService')

-- ============================================================
-- CONFIG
-- ============================================================
local CONFIG = {
    MIN_PLAYERS       = 1,
    INTERMISSION_TIME = 15,
    ROUND_TIME        = 120,
    MAX_SCORE         = 10,
    LOBBY_SPAWN       = CFrame.new(0, 5, 0),
    ARENA_SPAWNS      = {
        CFrame.new(220, 5, 20),
        CFrame.new(180, 5, 20),
        CFrame.new(220, 5, -20),
        CFrame.new(180, 5, -20),
    },
}

-- ============================================================
-- STATE MACHINE
-- ============================================================
local STATE = {
    WAITING      = 'Waiting',
    INTERMISSION = 'Intermission',
    ACTIVE       = 'Active',
    ENDED        = 'Ended',
}

local currentState  = STATE.WAITING
local timeRemaining = 0
local activePlayers = {}
local scores        = {}
local connections   = {}

-- ============================================================
-- REMOTES
-- ============================================================
local folder = Instance.new('Folder')
folder.Name = 'RoundSystem'
folder.Parent = RS

local function mkRemote(name)
    local r = Instance.new('RemoteEvent')
    r.Name = name
    r.Parent = folder
    return r
end

local StateChanged  = mkRemote('StateChanged')
local TimerUpdate   = mkRemote('TimerUpdate')
local RoundMessage  = mkRemote('RoundMessage')
local ScoreUpdate   = mkRemote('ScoreUpdate')

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

-- Broadcast current state to all clients
local function broadcastState(state, data)
    currentState = state
    StateChanged:FireAllClients(state, data or {})
    print('[RoundSystem] State -> ' .. state)
end

-- Broadcast timer tick to all clients
local function broadcastTimer(t)
    timeRemaining = t
    TimerUpdate:FireAllClients(t)
end

-- Send a timed message to all clients
local function broadcastMessage(msg, color)
    RoundMessage:FireAllClients(msg, color or Color3.fromRGB(255, 255, 255))
    print('[RoundSystem] ' .. msg)
end

-- Teleport a single player to a CFrame
local function teleportPlayer(player, cf)
    local character = player.Character
    if not character then return end
    local hrp = character:FindFirstChild('HumanoidRootPart')
    if hrp then hrp.CFrame = cf end
end

-- Teleport all active players to arena spawn points
local function teleportToArena()
    local spawns = CONFIG.ARENA_SPAWNS
    for i, player in ipairs(activePlayers) do
        local idx = ((i - 1) % #spawns) + 1
        teleportPlayer(player, spawns[idx])
    end
end

-- Teleport all active players back to the lobby
local function teleportToLobby()
    for _, player in ipairs(activePlayers) do
        teleportPlayer(player, CONFIG.LOBBY_SPAWN)
    end
end

-- Disconnect all event connections from the active round
local function cleanupConnections()
    for _, conn in ipairs(connections) do
        conn:Disconnect()
    end
    connections = {}
end

-- ============================================================
-- SCORE MANAGEMENT
-- ============================================================

local function resetScores()
    scores = {}
    for _, p in ipairs(Players:GetPlayers()) do
        local ls = p:FindFirstChild('leaderstats')
        if ls then
            local sv = ls:FindFirstChild('Score')
            if sv then sv.Value = 0 end
        end
    end
    ScoreUpdate:FireAllClients({})
end

-- Add points to a player; returns true if they've hit the win threshold
local function addScore(player, amount)
    scores[player] = (scores[player] or 0) + amount
    local ls = player:FindFirstChild('leaderstats')
    if ls then
        local sv = ls:FindFirstChild('Score')
        if sv then sv.Value = scores[player] end
    end
    ScoreUpdate:FireAllClients(scores)
    broadcastMessage(player.Name .. ' scored! (' .. scores[player] .. ' pts)', Color3.fromRGB(80, 220, 120))
    return scores[player] >= CONFIG.MAX_SCORE
end

-- Return the player with the highest score
local function getWinner()
    local winner, best = nil, -1
    for player, score in pairs(scores) do
        if player.Parent and score > best then
            best = score
            winner = player
        end
    end
    return winner, best
end

-- ============================================================
-- LEADERSTATS
-- ============================================================

local function setupLeaderstats(player)
    local ls = Instance.new('Folder')
    ls.Name = 'leaderstats'
    ls.Parent = player
    local score = Instance.new('IntValue')
    score.Name = 'Score'
    score.Value = 0
    score.Parent = ls
    local wins = Instance.new('IntValue')
    wins.Name = 'Wins'
    wins.Value = 0
    wins.Parent = ls
end

-- ============================================================
-- COUNTDOWN HELPER
-- ============================================================

-- Counts down from [seconds] to 0, calling [onTick] each second
local function countdown(seconds, onTick)
    for t = seconds, 0, -1 do
        broadcastTimer(t)
        if onTick then onTick(t) end
        task.wait(1)
    end
end

-- ============================================================
-- ROUND PHASES
-- ============================================================

local function phaseWaiting()
    broadcastState(STATE.WAITING)
    repeat
        local count = #Players:GetPlayers()
        broadcastMessage('Waiting for players... (' .. count .. '/' .. CONFIG.MIN_PLAYERS .. ')', Color3.fromRGB(200, 200, 80))
        task.wait(2)
    until #Players:GetPlayers() >= CONFIG.MIN_PLAYERS
end

local function phaseIntermission()
    broadcastState(STATE.INTERMISSION)
    broadcastMessage('Get ready! Round starting soon.', Color3.fromRGB(80, 160, 255))
    countdown(CONFIG.INTERMISSION_TIME, function(t)
        if t == 5 then
            broadcastMessage('Round starting in 5!', Color3.fromRGB(255, 200, 80))
        end
    end)
end

local function phaseActive()
    activePlayers = {}
    for _, p in ipairs(Players:GetPlayers()) do
        table.insert(activePlayers, p)
    end
    resetScores()
    broadcastState(STATE.ACTIVE, { playerCount = #activePlayers })
    broadcastMessage('Round started! First to ' .. CONFIG.MAX_SCORE .. ' points wins!', Color3.fromRGB(80, 220, 120))
    task.wait(0.5)
    teleportToArena()

    local roundWon = false
    local winner   = nil

    -- Wire up score parts if they exist in workspace
    local scoreParts = workspace:FindFirstChild('ScoreParts')
    if scoreParts then
        for _, part in ipairs(scoreParts:GetChildren()) do
            if part:IsA('BasePart') then
                local conn = part.Touched:Connect(function(hit)
                    if roundWon then return end
                    local char   = hit.Parent
                    local player = Players:GetPlayerFromCharacter(char)
                    if player and table.find(activePlayers, player) then
                        if addScore(player, 1) then
                            roundWon = true
                            winner   = player
                        end
                    end
                end)
                table.insert(connections, conn)
            end
        end
    end

    -- Round timer
    for t = CONFIG.ROUND_TIME, 0, -1 do
        if roundWon then break end
        broadcastTimer(t)
        if t == 30 then broadcastMessage('30 seconds left!', Color3.fromRGB(255, 200, 80)) end
        if t == 10 then broadcastMessage('10 seconds left!', Color3.fromRGB(255, 80, 80)) end
        task.wait(1)
    end

    cleanupConnections()
    if not roundWon then winner = getWinner() end
    return winner
end

local function phaseEnded(winner)
    broadcastState(STATE.ENDED)
    if winner and winner.Parent then
        local ls = winner:FindFirstChild('leaderstats')
        if ls then
            local wins = ls:FindFirstChild('Wins')
            if wins then wins.Value = wins.Value + 1 end
        end
        broadcastMessage(winner.Name .. ' wins the round!', Color3.fromRGB(255, 215, 0))
    else
        broadcastMessage('Round over — no winner.', Color3.fromRGB(180, 180, 180))
    end
    task.wait(3)
    teleportToLobby()
    task.wait(2)
end

-- ============================================================
-- MAIN GAME LOOP
-- ============================================================

local function gameLoop()
    while true do
        local ok, err = pcall(function()
            phaseWaiting()
            phaseIntermission()
            local winner = phaseActive()
            phaseEnded(winner)
        end)
        if not ok then
            warn('[RoundSystem] Loop error: ' .. tostring(err))
            task.wait(5)
        end
    end
end

-- ============================================================
-- PLAYER EVENTS
-- ============================================================

Players.PlayerAdded:Connect(function(player)
    setupLeaderstats(player)
    task.wait(1)
    StateChanged:FireClient(player, currentState, {})
    TimerUpdate:FireClient(player, timeRemaining)
end)

Players.PlayerRemoving:Connect(function(player)
    scores[player] = nil
    local idx = table.find(activePlayers, player)
    if idx then table.remove(activePlayers, idx) end
end)

-- ============================================================
-- INIT
-- ============================================================

print('[QXE RoundSystem] Initialized. Lines: ~260 | (c) 2026 QXEPrograms')
task.spawn(gameLoop)
