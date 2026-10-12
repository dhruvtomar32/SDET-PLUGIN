# 🧪 Manual Tester – Selector Highlighter

A lightweight Chrome extension for manually identifying webpage elements using **ID, CSS selectors, and XPath**. Easily highlight elements with different colors to simplify web testing, debugging, and selector identification.

## ✨ Features

- **Highlight Mode** — Toggle element highlighting ON or OFF.
- **Multiple Selector Types** — Choose between ID, CSS, and XPath.
- **Highlight Colors** — Select red, green, or blue for visual identification.
- **Element Selection** — Drag around a webpage component to identify it using the selected selector type.
- **Delete Individual Highlights** — Double-click a highlighted box to remove it.
- **Clear All Highlights** — Remove all highlights with a single click.
- **Privacy-Friendly** — Designed for local use, with no server required.

## 🚀 Installation

1. Clone or download this repository.
2. Open Google Chrome.
3. Navigate to `chrome://extensions/`.
4. Enable **Developer mode** in the top-right corner.
5. Click **Load unpacked**.
6. Select the project folder containing `manifest.json`.
7. Pin the extension to your Chrome toolbar.

## 📖 How to Use

1. Open the webpage you want to test.
2. Click the **Manual Tester – Selector Highlighter** icon in Chrome.
3. Turn **Highlight Mode** ON.
4. Select your preferred selector type:
   - **ID** — Identify elements using their HTML `id` attribute.
   - **CSS** — Identify elements using CSS selector syntax.
   - **XPath** — Identify elements using XPath expressions.
5. Choose a highlight color: red, green, or blue.
6. Drag around a webpage component to identify it using the selected selector.
7. Double-click a highlighted box to delete it.
8. Click **Clear All Highlights** to remove every highlight.

## 🛠️ Technologies

- HTML
- CSS
- JavaScript
- Chrome Extensions API

## 🎯 Use Cases

- Manual web application testing
- Frontend debugging
- CSS selector identification
- XPath selector validation
- Preparing selectors for automated testing
- Inspecting webpage elements during QA

## 🔒 Privacy

The extension is designed for local use without requiring a remote server.

- Local storage is indicated in the extension interface.
- No remote data transmission is intended as part of the described workflow.
- Actual permissions and network behavior depend on the source code.

## 📋 Requirements

- Google Chrome or a compatible Chromium-based browser.
- Developer mode enabled for installation from source.
- A valid `manifest.json` file.

## 🐛 Known Limitations

- Highlighting may depend on the webpage structure and styling.
- Dynamic page updates may require selecting elements again.
- Iframes and Shadow DOM may require additional implementation support.

## 🤝 Contributing

Contributions and suggestions are welcome!

1. Fork this repository.
2. Create a feature branch.
3. Make your changes.
4. Test the extension in Chrome.
5. Submit a pull request describing your changes.

## 📄 License

No license has been specified yet. Add a `LICENSE` file before distributing or reusing this project publicly.
