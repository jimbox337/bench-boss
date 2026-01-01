# ESPN Fantasy League Integration

Bench Boss now supports direct integration with ESPN Fantasy Hockey leagues! This feature allows you to automatically import your league settings, scoring format, and rostered players.

## How to Connect Your ESPN League

### 1. Find Your League ID

Your ESPN League ID can be found in your league's URL:
```
https://fantasy.espn.com/hockey/league?leagueId=123456
                                                ^^^^^^
                                            This is your League ID
```

Just copy the numbers after `leagueId=` in your browser's address bar.

### 2. For Public Leagues

If your league is **public**, you only need your League ID!

Navigate to Settings, enter your League ID, and click "Connect ESPN League".

### 3. For Private Leagues

If your league is **private**, you'll also need to provide two cookies from ESPN.

#### How to Get Your ESPN Cookies:

1. **Open ESPN Fantasy** in your browser (Chrome, Firefox, Edge, etc.)
2. **Make sure you're logged in** to your ESPN account
3. **Navigate to your fantasy hockey league page**
4. **Open Developer Tools**:
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
   - Or right-click anywhere on the page → "Inspect"

5. **Find the Application/Storage tab**:
   - Chrome/Edge: Click the "Application" tab
   - Firefox: Click the "Storage" tab

6. **Navigate to Cookies**:
   - In the left sidebar, expand "Cookies"
   - Click on `https://fantasy.espn.com`

7. **Copy these two cookie values**:
   - Find `espn_s2` - Copy the entire value (it's a very long string)
   - Find `SWID` - Copy the value (looks like `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`)

8. **Paste into Bench Boss Settings**:
   - Go to Settings in Bench Boss
   - Scroll to "For Private Leagues (Optional)"
   - Paste `espn_s2` value into the first field
   - Paste `SWID` value into the second field
   - Click "Connect ESPN League"

#### Important Notes:
- These cookies expire periodically (usually after a few weeks)
- If connection fails, try getting fresh cookies
- Keep these cookies private - they give access to your ESPN account

## What Gets Imported

When you connect your ESPN league, Bench Boss will automatically:

✅ **League Information**
- League name
- Number of teams
- Current season

✅ **Scoring Settings**
- Scoring type (Points or Categories)
- Points per stat (for points leagues)
- Stat categories (for category leagues)

✅ **Roster Configuration**
- Position slots (C, LW, RW, D, G)
- Utility slots
- Bench slots
- IR slots

✅ **Your Team Roster**
- All players currently on your ESPN team
- Automatically matched to NHL player database
- Stats and projections available immediately

## Security & Privacy

- Your ESPN cookies are **stored locally** in your browser only
- Cookies are **never sent to any external server** except ESPN's official API
- You can disconnect your league at any time from Settings
- All data is fetched directly from ESPN's API

## Troubleshooting

### "Failed to connect to ESPN league"
- Verify your League ID and Season ID are correct
- For private leagues, ensure you've entered valid `espn_s2` and `SWID` cookies
- Make sure you're logged into ESPN in the same browser

### "Could not find NHL player match for..."
- Some players may not be matched automatically if their names differ between ESPN and NHL databases
- You can manually add these players to your team from the Player Explorer

### Cookies expired
- ESPN cookies expire periodically
- If you get authentication errors, get fresh cookies from your browser and update them in Settings

## API Documentation

The ESPN Fantasy API is unofficial and undocumented. This integration uses publicly available endpoints that power ESPN's own fantasy platform.

For more information about the ESPN Fantasy API, see:
- [ESPN Fantasy API Guide](https://stmorse.github.io/journal/espn-fantasy-v3.html)
- [Public ESPN API Documentation](https://github.com/pseudo-r/Public-ESPN-API)

## Known Limitations

1. **Team Selection**: Currently imports the first team in the league. If you own multiple teams, you may need to manually select which team to import.

2. **Player Matching**: Player name matching is done by exact name comparison. Players with different name formats may not match automatically.

3. **Real-time Sync**: Changes made in ESPN are not automatically reflected. Click "Reconnect ESPN League" to refresh data.

4. **Cookie Security**: Private league cookies must be manually updated if they expire.

## Future Enhancements

Planned improvements include:
- Multi-team support for users in multiple leagues
- Automatic cookie refresh
- Real-time sync with ESPN
- Trade proposal integration
- Waiver wire sync
