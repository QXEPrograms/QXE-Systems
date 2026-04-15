 QXE Round System — (c) 2026 QXEPrograms                                                                                                                                                                                                  
                                                                                                                                                                                                                                             
  A production-ready round-based game loop system for Roblox.                                                                                                                                                                                
                                                                                                                                                                                                                                           
  ---                                                                                                                                                                                                                                        
   
  ## Features                                                                                                                                                                                                                                
  - Automatic game loop — Waiting → Intermission → Active → Ended                                                                                                                                                                          
  - Live countdown timer with color changes at 30s and 10s
  - Real-time scoreboard UI that updates as players score                                                                                                                                                                                    
  - Player teleportation to arena on round start and back to lobby on end
  - Score orbs with smooth bobbing animation                                                                                                                                                                                                 
  - Winner detection with leaderboard tracking                                                                                                                                                                                             
  - Error-safe game loop with auto-recovery                                                                                                                                                                                                  
                                                                                                                                                                                                                                           
  ---                                                                                                                                                                                                                                        
   
  ## How It Works                                                                                                                                                                                                                            
  1. Server waits for minimum players                                                                                                                                                                                                      
  2. 15 second intermission countdown
  3. All players teleport to the arena                                                                                                                                                                                                       
  4. First to 10 points wins — or whoever has the most when time runs out
  5. Winner announced, everyone returns to lobby                                                                                                                                                                                             
  6. Loop restarts automatically                                                                                                                                                                                                           
                                                                                                                                                                                                                                             
  ---                                                                                                                                                                                                                                      

  ## Files                                                                                                                                                                                                                                   
  - `QXE_RoundSystem.lua` — Server script, place in ServerScriptService
  - `QXE_RoundClient.lua` — LocalScript, place in StarterPlayerScripts                                                                                                                                                                       
                                                                                                                                                                                                                                             
  ---
                                                                                                                                                                                                                                             
  Built by QXEProgram
