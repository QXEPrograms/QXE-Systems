-- QXE Round System Client UI | (c) 2026 QXEPrograms
local Pl = game:GetService('Players')
local RS = game:GetService('ReplicatedStorage')
local TS = game:GetService('TweenService')
local me = Pl.LocalPlayer
local folder = RS:WaitForChild('RoundSystem', 30)
if not folder then return end
local StateChanged = folder:WaitForChild('StateChanged')
local TimerUpdate  = folder:WaitForChild('TimerUpdate')
local RoundMessage = folder:WaitForChild('RoundMessage')
local ScoreUpdate  = folder:WaitForChild('ScoreUpdate')
local sg = Instance.new('ScreenGui')
sg.Name = 'RoundUI'
sg.ResetOnSpawn = false
sg.IgnoreGuiInset = true
sg.Parent = me:WaitForChild('PlayerGui')
local function mk(c,p,t)
    local o = Instance.new(c)
    if p then for k,v in pairs(p) do o[k]=v end end
    if t then o.Parent=t end
    return o
end
local function rnd(o,r) mk('UICorner',{CornerRadius=UDim.new(0,r or 8)},o) end
-- Timer bar at top center
local timerBG = mk('Frame',{Size=UDim2.new(0,200,0,44),Position=UDim2.new(0.5,-100,0,16),BackgroundColor3=Color3.fromRGB(11,11,18),BorderSizePixel=0},sg) rnd(timerBG,10)
mk('UIStroke',{Color=Color3.fromRGB(80,120,255),Thickness=1.5},timerBG)
local timerLabel = mk('TextLabel',{Size=UDim2.new(1,0,0,22),Position=UDim2.new(0,0,0,4),BackgroundTransparency=1,Text='--:--',Font=Enum.Font.GothamBold,TextSize=20,TextColor3=Color3.fromRGB(255,255,255),TextXAlignment=Enum.TextXAlignment.Center},timerBG)
local stateLabel = mk('TextLabel',{Size=UDim2.new(1,0,0,16),Position=UDim2.new(0,0,1,-20),BackgroundTransparency=1,Text='WAITING',Font=Enum.Font.GothamBold,TextSize=10,TextColor3=Color3.fromRGB(80,120,255),TextXAlignment=Enum.TextXAlignment.Center},timerBG)
-- Message banner
local msgFrame = mk('Frame',{Size=UDim2.new(0,420,0,44),Position=UDim2.new(0.5,-210,0,-60),BackgroundColor3=Color3.fromRGB(11,11,18),BorderSizePixel=0,Visible=true},sg) rnd(msgFrame,10)
mk('UIStroke',{Color=Color3.fromRGB(60,60,90),Thickness=1},msgFrame)
local msgLabel = mk('TextLabel',{Size=UDim2.new(1,-20,1,0),Position=UDim2.new(0,10,0,0),BackgroundTransparency=1,Text='',Font=Enum.Font.GothamBold,TextSize=14,TextColor3=Color3.fromRGB(255,255,255),TextXAlignment=Enum.TextXAlignment.Center},msgFrame)
-- Scoreboard (top right)
local sbFrame = mk('Frame',{Size=UDim2.new(0,180,0,200),Position=UDim2.new(1,-196,0,16),BackgroundColor3=Color3.fromRGB(11,11,18),BorderSizePixel=0},sg) rnd(sbFrame,10)
mk('UIStroke',{Color=Color3.fromRGB(80,120,255),Thickness=1.5},sbFrame)
mk('TextLabel',{Size=UDim2.new(1,0,0,28),BackgroundColor3=Color3.fromRGB(16,16,28),BorderSizePixel=0,Text='SCOREBOARD',Font=Enum.Font.GothamBold,TextSize=11,TextColor3=Color3.fromRGB(80,120,255),TextXAlignment=Enum.TextXAlignment.Center},sbFrame) rnd(sbFrame,10)
local sbList = mk('ScrollingFrame',{Size=UDim2.new(1,-8,1,-36),Position=UDim2.new(0,4,0,32),BackgroundTransparency=1,BorderSizePixel=0,ScrollBarThickness=2,ScrollBarImageColor3=Color3.fromRGB(80,120,255),AutomaticCanvasSize=Enum.AutomaticSize.Y,CanvasSize=UDim2.new(0,0,0,0)},sbFrame)
mk('UIListLayout',{Padding=UDim.new(0,3),SortOrder=Enum.SortOrder.Name},sbList)
local sbRows = {}
local function updateScoreboard(scores)
    for _, r in pairs(sbRows) do r:Destroy() end
    sbRows = {}
    for player, score in pairs(scores) do
        if type(player) == 'userdata' and player.Parent then
            local row = mk('Frame',{Name=player.Name,Size=UDim2.new(1,0,0,28),BackgroundColor3=Color3.fromRGB(18,18,28),BorderSizePixel=0},sbList) rnd(row,6)
            mk('TextLabel',{Size=UDim2.new(0.6,0,1,0),Position=UDim2.new(0,8,0,0),BackgroundTransparency=1,Text=player.Name,Font=Enum.Font.Gotham,TextSize=12,TextColor3=Color3.fromRGB(200,200,220),TextXAlignment=Enum.TextXAlignment.Left},row)
            mk('TextLabel',{Size=UDim2.new(0.4,-8,1,0),Position=UDim2.new(0.6,0,0,0),BackgroundTransparency=1,Text=tostring(score),Font=Enum.Font.GothamBold,TextSize=13,TextColor3=Color3.fromRGB(80,220,120),TextXAlignment=Enum.TextXAlignment.Right},row)
            table.insert(sbRows, row)
        end
    end
end
-- Animate message banner in/out
local msgThr
local function showMessage(msg, color)
    if msgThr then task.cancel(msgThr) end
    msgLabel.Text = msg
    msgLabel.TextColor3 = color or Color3.fromRGB(255,255,255)
    msgFrame.Visible = true
    msgFrame.Position = UDim2.new(0.5,-210,0,-60)
    TS:Create(msgFrame,TweenInfo.new(0.3,Enum.EasingStyle.Quart,Enum.EasingDirection.Out),{Position=UDim2.new(0.5,-210,0,76)}):Play()
    msgThr = task.delay(4, function()
        TS:Create(msgFrame,TweenInfo.new(0.3,Enum.EasingStyle.Quart,Enum.EasingDirection.In),{Position=UDim2.new(0.5,-210,0,-60)}):Play()
        task.wait(0.35)
        msgFrame.Visible = false
    end)
end
-- Format seconds as MM:SS
local function formatTime(t)
    local m = math.floor(t / 60)
    local s = t % 60
    return string.format('%02d:%02d', m, s)
end
-- Orb bobbing animation
local scoreFolder = workspace:WaitForChild('ScoreParts', 10)
if scoreFolder then
    task.spawn(function()
        local t = 0
        while true do
            t = t + 0.05
            for _, orb in ipairs(scoreFolder:GetChildren()) do
                if orb:IsA('BasePart') then
                    local base = orb:GetAttribute('BaseY') or orb.Position.Y
                    orb:SetAttribute('BaseY', base)
                    orb.CFrame = CFrame.new(orb.Position.X, base + math.sin(t + orb.Position.X) * 0.8, orb.Position.Z) * CFrame.Angles(0, t * 0.5, 0)
                end
            end
            task.wait(0.03)
        end
    end)
end
-- Remote listeners
StateChanged.OnClientEvent:Connect(function(state)
    stateLabel.Text = state:upper()
    if state == 'Waiting' then stateLabel.TextColor3 = Color3.fromRGB(200,200,80)
    elseif state == 'Intermission' then stateLabel.TextColor3 = Color3.fromRGB(80,160,255)
    elseif state == 'Active' then stateLabel.TextColor3 = Color3.fromRGB(80,220,120)
    elseif state == 'Ended' then stateLabel.TextColor3 = Color3.fromRGB(255,215,0)
    end
end)
TimerUpdate.OnClientEvent:Connect(function(t)
    timerLabel.Text = formatTime(t)
    if t <= 10 then timerLabel.TextColor3 = Color3.fromRGB(255,80,80)
    elseif t <= 30 then timerLabel.TextColor3 = Color3.fromRGB(255,200,80)
    else timerLabel.TextColor3 = Color3.fromRGB(255,255,255) end
end)
RoundMessage.OnClientEvent:Connect(function(msg, color)
    showMessage(msg, color)
end)
ScoreUpdate.OnClientEvent:Connect(function(scores)
    updateScoreboard(scores)
end)
