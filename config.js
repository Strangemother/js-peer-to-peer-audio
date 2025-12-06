// Configuration for WebRTC audio streaming
const CONFIG = {
    // Audio constraints for microphone capture
    audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0,
        sampleRate: 48000,
        channelCount: 1
    },
    
    // WebRTC configuration
    webrtc: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    },
    
    // WebSocket server configuration
    websocket: {
        getUrl: () => {
            const hostname = window.location.hostname;
            if (hostname.includes('github.dev')) {
                const parts = hostname.split('-8000.');
                return `wss://${parts[0]}-8765.${parts[1]}`;
            } else {
                return 'ws://localhost:8765';
            }
        }
    },
    
    // Stats update interval (ms)
    statsUpdateInterval: 1000,
    
    // Audio playback settings
    playback: {
        volume: 1.0,
        defaultSinkId: 'default'
    }
};
