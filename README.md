# PaoPao - Telegram Mini App

A tile-matching puzzle game optimized for Telegram Mini Apps with vertical mobile layout.

## Features

- **Mobile-First Design**: Optimized for iPhone screens in vertical mode
- **Telegram Integration**: Full support for Telegram Web App API
- **Theme Support**: Automatically adapts to Telegram's light/dark themes
- **5 Difficulty Levels**: Progressive difficulty from beginner to expert
- **Compact Layout**: 40x50 pixel tiles in an 11x18 grid
- **Score System**: Points for matches and level completion
- **Heart System**: Limited attempts with hint and solve options

## Game Rules

1. **Objective**: Match pairs of identical tiles
2. **Gameplay**: Click on tiles to select them, find matching pairs
3. **Hearts**: You start with 10 hearts, lose 1 for each wrong match
4. **Timer**: 10-minute time limit per level
5. **Scoring**: 100 points per match, 500 bonus for level completion
6. **Hints**: Use 2 hearts for a hint
7. **Solve**: Use 5 hearts to automatically complete the level

## Telegram Mini App Setup

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Use `/newbot` command
3. Choose a name and username for your bot
4. Save the bot token

### 2. Configure Web App

1. Use `/setmenubutton` command with BotFather
2. Set the web app URL to your deployed game
3. Configure the button text and description

### 3. Deploy the Game

1. Upload all files to your web server
2. Ensure HTTPS is enabled (required for Telegram)
3. Update the `web_app_url` in `bot-config.json`
4. Test the bot with `/start` command

## File Structure

```
paopao/
├── index.html          # Main HTML file with Telegram integration
├── style.css           # CSS with Telegram theme support
├── script.js           # Game logic and Telegram Web App API
├── bot-config.json     # Bot configuration template
├── tiles/              # Tile images (1-36.png)
├── Assets/             # Game assets (backgrounds, sounds, etc.)
└── README.md           # This file
```

## Telegram Web App API Features

- **Theme Integration**: Automatically adapts to user's Telegram theme
- **Back Button**: Proper navigation handling
- **User Data**: Access to user information when available
- **Data Sharing**: Send game results back to Telegram
- **Responsive Design**: Works on all Telegram-supported devices

## Customization

### Changing Tile Images

1. Replace images in the `tiles/` folder
2. Ensure images are named 1.png, 2.png, etc.
3. Maintain the 40x50 pixel aspect ratio

### Modifying Levels

Edit the `levels` array in `script.js`:

```javascript
levels: [
    { name: "Custom Level", description: "Description", pairs: 10 }
]
```

### Adjusting Board Size

Modify these values in `script.js`:

```javascript
boardWidth: 11,    // Number of columns
boardHeight: 18,   // Number of rows
tileWidth: 40,     // Tile width in pixels
tileHeight: 50     // Tile height in pixels
```

## Browser Compatibility

- **Telegram App**: Full support
- **Modern Browsers**: Chrome, Safari, Firefox, Edge
- **Mobile Browsers**: iOS Safari, Chrome Mobile
- **Minimum Requirements**: ES6 support, CSS Grid, Flexbox

## Performance Optimization

- **Tile Rendering**: Uses absolute positioning for smooth performance
- **Event Handling**: Efficient click event management
- **Memory Management**: Proper cleanup of timers and event listeners
- **Asset Loading**: Optimized image loading and caching

## Troubleshooting

### Common Issues

1. **Game not loading**: Check HTTPS requirement and file paths
2. **Tiles not displaying**: Verify tile images exist and are accessible
3. **Theme not working**: Ensure Telegram Web App API is loaded
4. **Performance issues**: Check browser console for errors

### Debug Mode

Add this to your browser console to test outside Telegram:

```javascript
// Mock Telegram Web App for testing
window.Telegram = {
    WebApp: {
        ready: () => console.log('Telegram WebApp ready'),
        expand: () => console.log('Telegram WebApp expanded'),
        themeParams: {
            bg_color: '#ffffff',
            text_color: '#000000',
            button_color: '#2481cc'
        },
        onEvent: () => {},
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {} }
    }
};
```

## License

This project is open source and available under the MIT License.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Telegram's [Web App documentation](https://core.telegram.org/bots/webapps)
3. Test in different Telegram clients

## Changelog

### v1.0.0
- Initial release as Telegram Mini App
- Mobile-optimized vertical layout
- Full Telegram Web App API integration
- 5 difficulty levels
- Theme support for light/dark modes
