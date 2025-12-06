# Python Audio Receiver

Record audio from the WebRTC sender directly to a WAV file using Python.

## Features

- Receives raw PCM audio data from the sender
- Saves to WAV file format
- Automatic timestamped filenames
- Optional recording duration limit
- Command-line interface

## Requirements

```bash
pip install websockets
```

## Usage

### Basic recording (stop with Ctrl+C):
```bash
python3 receiver_audio.py
```

### Record to specific file:
```bash
python3 receiver_audio.py -o my_recording.wav
```

### Record for specific duration (10 seconds):
```bash
python3 receiver_audio.py -d 10
```

### Record with both options:
```bash
python3 receiver_audio.py -o meeting.wav -d 60
```

## Workflow

1. Start the signaling server:
   ```bash
   python3 server.py
   ```

2. Open sender in browser and start streaming

3. Run Python receiver to record:
   ```bash
   python3 receiver_audio.py -o recording.wav -d 30
   ```

4. Audio is saved to `recording.wav` when done

## Audio Format

- **Sample Rate**: 48,000 Hz
- **Channels**: Mono (1 channel)
- **Bit Depth**: 16-bit PCM
- **Format**: WAV

## Notes

- The Python receiver works alongside browser receivers
- Multiple Python receivers can record simultaneously
- Audio is captured in real-time as raw PCM data
- No WebRTC implementation needed in Python
