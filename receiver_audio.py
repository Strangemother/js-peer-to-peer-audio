#!/usr/bin/env python3
"""
Python audio receiver - Receives audio data via WebSocket DataChannel
and saves to WAV file.
"""
import asyncio
import json
import wave
import struct
import websockets
from datetime import datetime

# Audio configuration (must match sender)
SAMPLE_RATE = 48000
CHANNELS = 1
SAMPLE_WIDTH = 2  # 16-bit audio

class AudioRecorder:
    def __init__(self, filename=None):
        if filename is None:
            filename = f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
        self.filename = filename
        self.audio_data = []
        self.is_recording = False
        
    def add_chunk(self, data):
        """Add audio chunk to buffer"""
        self.audio_data.append(data)
        
    def save(self):
        """Save recorded audio to WAV file"""
        if not self.audio_data:
            print("No audio data to save")
            return
            
        print(f"Saving {len(self.audio_data)} chunks to {self.filename}...")
        
        with wave.open(self.filename, 'wb') as wav_file:
            wav_file.setnchannels(CHANNELS)
            wav_file.setsampwidth(SAMPLE_WIDTH)
            wav_file.setframerate(SAMPLE_RATE)
            
            # Write all audio chunks
            for chunk in self.audio_data:
                wav_file.writeframes(chunk)
                
        total_bytes = sum(len(chunk) for chunk in self.audio_data)
        duration = total_bytes / (SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH)
        print(f"Saved {total_bytes:,} bytes ({duration:.2f} seconds) to {self.filename}")

async def receive_audio(output_file=None, duration=None):
    """
    Connect to signaling server and receive audio data
    
    Args:
        output_file: Output WAV filename (default: recording_TIMESTAMP.wav)
        duration: Recording duration in seconds (None = until Ctrl+C)
    """
    recorder = AudioRecorder(output_file)
    receiver_id = f"python-receiver-{datetime.now().timestamp()}"
    
    # Determine WebSocket URL (localhost or Codespaces)
    ws_url = "ws://localhost:8765"
    
    print(f"Connecting to {ws_url}...")
    print(f"Receiver ID: {receiver_id}")
    print("Waiting for audio data... (Press Ctrl+C to stop)")
    
    try:
        async with websockets.connect(ws_url) as websocket:
            # Register as receiver
            await websocket.send(json.dumps({
                'type': 'register',
                'id': receiver_id
            }))
            print("Registered with server")
            
            start_time = None
            
            async for message in websocket:
                try:
                    # Check if it's JSON (control message) or binary (audio data)
                    if isinstance(message, bytes):
                        # Binary audio data
                        if not recorder.is_recording:
                            recorder.is_recording = True
                            start_time = asyncio.get_event_loop().time()
                            print("Receiving audio data...")
                        
                        recorder.add_chunk(message)
                        
                        # Check duration limit
                        if duration and start_time:
                            elapsed = asyncio.get_event_loop().time() - start_time
                            if elapsed >= duration:
                                print(f"\nDuration limit ({duration}s) reached")
                                break
                    else:
                        # JSON control message
                        data = json.loads(message)
                        print(f"Control message: {data.get('type', 'unknown')}")
                        
                        # Handle WebRTC signaling if needed
                        # (for now we're just receiving raw audio via WebSocket)
                        
                except json.JSONDecodeError:
                    pass  # Binary data, already handled
                    
    except KeyboardInterrupt:
        print("\n\nStopping recording...")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        recorder.save()

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Receive and record audio stream')
    parser.add_argument('-o', '--output', help='Output WAV filename')
    parser.add_argument('-d', '--duration', type=float, help='Recording duration in seconds')
    args = parser.parse_args()
    
    try:
        asyncio.run(receive_audio(args.output, args.duration))
    except KeyboardInterrupt:
        print("\nExiting...")

if __name__ == "__main__":
    main()
