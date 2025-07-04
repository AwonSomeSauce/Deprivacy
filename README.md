# Privacy Guard Chrome Extension

A Chrome extension that automatically detects sensitive tokens and protects user privacy using differential privacy mechanisms.

## Features

- **Real-time Detection**: Automatically detects sensitive data like credit cards, SSNs, emails, phone numbers, and API keys
- **Differential Privacy**: Uses formal privacy guarantees to replace sensitive words with semantically similar alternatives
- **Word Clustering**: Groups semantically similar words to maintain utility while preserving privacy
- **Flexible Actions**: Choose to erase, censor, or replace sensitive data
- **Privacy Budget Management**: Tracks and manages privacy budget with formal (ε, δ)-differential privacy guarantees

## Installation

### Method 1: Developer Mode (Recommended for Development)

1. **Clone or Download**: Get the extension files to your local machine
2. **Open Chrome Extensions**: Go to `chrome://extensions/`
3. **Enable Developer Mode**: Toggle the "Developer mode" switch in the top right
4. **Load Unpacked**: Click "Load unpacked" and select the extension directory
5. **Verify Installation**: You should see the Privacy Guard extension appear in your extensions list

### Method 2: Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store once published.

## Usage

### Basic Usage

1. **Enable Protection**: Click the extension icon in the toolbar to open the popup
2. **Configure Settings**: Adjust privacy level and enable/disable features
3. **Browse Normally**: The extension will automatically detect sensitive data as you type
4. **Take Actions**: When sensitive data is detected, choose from:
   - **Erase**: Remove the sensitive word completely
   - **Censor**: Replace with asterisks (****)
   - **Replace**: Use differential privacy to replace with a similar word

### Settings Configuration

#### Privacy Level (ε Parameter)
- **Lower values (0.1-0.5)**: Stronger privacy, less utility
- **Medium values (0.5-1.0)**: Balanced privacy and utility
- **Higher values (1.0-2.0)**: More utility, weaker privacy

#### Auto-Replace Mode
- When enabled, sensitive words are automatically replaced without user interaction
- Uses differential privacy mechanism to select replacements

### Detected Patterns

The extension detects the following types of sensitive data:

- **Credit Card Numbers**: 16-digit numbers with various formatting
- **Social Security Numbers**: XXX-XX-XXXX format
- **Email Addresses**: Standard email format validation
- **Phone Numbers**: Various US phone number formats
- **API Keys**: Common API key patterns (sk_, pk_, etc.)
- **Tokens/Hashes**: Long alphanumeric strings (32+ characters)

## Technical Implementation

### Architecture

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   Content       │    │   Background         │    │   Popup         │
│   Script        │◄──►│   Script             │◄──►│   Interface     │
├─────────────────┤    ├──────────────────────┤    ├─────────────────┤
│ • Text Monitor  │    │ • Settings Manager   │    │ • UI Controls   │
│ • Token Detect  │    │ • Stats Tracking     │    │ • Privacy Stats │
│ • DP Replace    │    │ • Message Routing    │    │ • Config Panel  │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌──────────────────────┐
│ Word Clustering │    │ Differential Privacy │
│ Manager         │    │ Manager              │
├─────────────────┤    ├──────────────────────┤
│ • Semantic      │    │ • Exponential        │
│   Clustering    │    │   Mechanism          │
│ • Similarity    │    │ • Privacy Budget     │
│ • Embeddings    │    │ • Formal Guarantees  │
└─────────────────┘    └──────────────────────┘
```

### Differential Privacy Implementation

The extension uses the **Exponential Mechanism** for private word replacement:

1. **Utility Function**: Combines semantic similarity, length similarity, and contextual appropriateness
2. **Privacy Parameter**: ε (epsilon) controls the privacy-utility tradeoff
3. **Probability Calculation**: `P(output) ∝ exp(ε × utility(output) / (2 × sensitivity))`
4. **Sampling**: Select replacement word based on computed probabilities

### Word Clustering System

Words are grouped into semantic clusters:

- **Countries**: Canada, America, Mexico, France, Germany...
- **Body Parts**: Hand, Eyes, Feet, Head, Arm...
- **Colors**: Red, Blue, Green, Yellow, Purple...
- **Professions**: Doctor, Teacher, Engineer, Lawyer...
- **Animals**: Dog, Cat, Bird, Fish, Horse...

## Privacy Guarantees

The extension provides **(ε, δ)-differential privacy** with:

- **ε (epsilon)**: Privacy budget parameter (configurable 0.1-2.0)
- **δ (delta)**: Failure probability (fixed at 0.001)
- **Formal Definition**: For any two adjacent datasets differing by one record, the probability ratio of any output is bounded by e^ε

## File Structure

```
privacy-guard-extension/
├── manifest.json              # Extension configuration
├── content.js                 # Main content script
├── background.js              # Background service worker
├── popup.html                 # Extension popup UI
├── popup.js                   # Popup functionality
├── word-clustering.js         # Word clustering system
├── differential-privacy.js    # DP implementation
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                  # This file
```

## Development

### Prerequisites

- Chrome browser
- Basic knowledge of JavaScript, HTML, CSS
- Understanding of differential privacy concepts

### Building and Testing

1. **Load Extension**: Use Developer Mode to load the unpacked extension
2. **Test Detection**: Visit websites with form inputs and type sensitive data
3. **Verify Privacy**: Check that replacements maintain semantic meaning
4. **Debug Issues**: Use Chrome DevTools to inspect console logs

### Customization

#### Adding New Detection Patterns

Edit `content.js` and add patterns to `this.sensitivePatterns`:

```javascript
/\b[A-Z]{2}\d{6}\b/g, // Passport numbers
```

#### Extending Word Clusters

Modify `word-clustering.js` to add new semantic categories:

```javascript
const defaultClusters = {
  'new_category': ['word1', 'word2', 'word3'],
  // ...
};
```

#### Adjusting Privacy Parameters

Fine-tune privacy parameters in `differential-privacy.js`:

```javascript
constructor(epsilon = 1.0, delta = 0.001) {
  this.epsilon = epsilon;
  this.delta = delta;
  this.sensitivity = 1.0; // Adjust as needed
}
```

## Security Considerations

- **Local Processing**: All detection and replacement happens locally
- **No Data Transmission**: Sensitive data never leaves the user's browser
- **Privacy Budget**: Tracks cumulative privacy loss over time
- **Secure Storage**: Settings stored using Chrome's secure storage API

## Troubleshooting

### Common Issues

1. **Extension Not Loading**
   - Check Developer Mode is enabled
   - Verify all files are in the correct directory
   - Check console for JavaScript errors

2. **Detection Not Working**
   - Ensure Protection is enabled in popup
   - Check if website blocks content scripts
   - Verify input elements are supported

3. **Poor Replacement Quality**
   - Adjust privacy level (higher ε = better utility)
   - Add more words to relevant clusters
   - Check word similarity calculations

### Performance Optimization

- **Debouncing**: Input analysis is debounced to prevent excessive processing
- **Lazy Loading**: Word clusters loaded asynchronously
- **Memory Management**: Old detection logs automatically cleaned up

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Research Background

This extension implements concepts from:

- **Differential Privacy**: Dwork, C. (2006). Differential privacy
- **Exponential Mechanism**: McSherry, F. & Talwar, K. (2007)
- **Word Embeddings**: Mikolov, T. et al. (2013). Word2Vec
- **Semantic Similarity**: Various NLP and computational linguistics research

## Future Enhancements

- [ ] Machine learning-based detection
- [ ] Custom word embedding models
- [ ] Multi-language support
- [ ] Advanced composition theorems
- [ ] Real-time privacy budget visualization
- [ ] Integration with password managers
- [ ] Contextual privacy policies

## Support

For issues, questions, or contributions:

1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed description
4. Include browser version, extension version, and steps to reproduce

---

**Note**: This extension is designed for educational and research purposes. While it implements formal differential privacy guarantees, users should still exercise caution when entering sensitive information online.