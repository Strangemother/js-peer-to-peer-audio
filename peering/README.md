# WebRTC Audio Streaming Example

A minimal peer-to-peer audio streaming example using WebRTC. Stream audio from a microphone (sender) to speakers (receiver) using vanilla JavaScript and a Python signaling server.

## Files

- `server.py` - Python WebSocket signaling server
- `sender.html` - Microphone audio sender page
- `receiver.html` - Audio receiver page (plays through speakers)

## Requirements

- Python 3.7+
- `websockets` library

## Setup

1. Install Python dependencies:
```bash
pip install websockets
```

## Usage

### 1. Start the signaling server

```bash
python3 server.py
```

You should see: `Starting signaling server on ws://localhost:8765`

### 2. Open the receiver page

Open `receiver.html` in a web browser:
```bash
# On Linux/macOS
open receiver.html
# Or simply drag the file into your browser
```

Click "Connect and Listen" button.

### 3. Open the sender page

Open `sender.html` in another browser window/tab:
```bash
# On Linux/macOS
open sender.html
# Or simply drag the file into your browser
```

Click "Start Streaming" button and allow microphone access.

### 4. Listen!

The receiver should now play the audio from the sender's microphone through its speakers.

## How It Works

1. **Signaling Server** (Python): Relays WebRTC signaling messages (offers, answers, ICE candidates) between sender and receiver
2. **Sender** (JavaScript): Captures microphone audio and creates a WebRTC peer connection to send the stream
3. **Receiver** (JavaScript): Receives the audio stream via WebRTC and plays it through the `<audio>` element

## Architecture

```
Sender (Browser)  <--WebSocket-->  Server (Python)  <--WebSocket-->  Receiver (Browser)
      |                                                                      |
      +------------------------WebRTC Audio Stream------------------------->+
```

The WebSocket connection is only used for signaling. The actual audio streams peer-to-peer via WebRTC.

## Troubleshooting

- **Microphone permission denied**: Allow microphone access when prompted
- **No audio**: Check browser console for errors and ensure both pages are connected
- **Connection fails**: Ensure the Python server is running on port 8765
- **HTTPS required**: Some browsers require HTTPS for microphone access (use `file://` or `localhost` for testing)
