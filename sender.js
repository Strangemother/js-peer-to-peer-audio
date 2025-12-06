// Sender JavaScript - Microphone audio streaming with multi-receiver support

let ws;
let peerConnections = {}; // Multiple peer connections for multiple receivers
let localStream;
let wsUrl;
let bytesSent = 0;
let startTime;
let statsInterval;

const startBtn = document.getElementById('startBtn');
const status = document.getElementById('status');
const errorLog = document.getElementById('errorLog');

function logError(message, error) {
    errorLog.style.display = 'block';
    const errorText = error ? `${message}\n${error.name}: ${error.message}` : message;
    errorLog.textContent = errorText;
    console.error(message, error);
}

function updateStatus(message) {
    status.textContent = `Status: ${message}`;
    console.log(message);
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
}

function startStatsMonitoring() {
    let lastBytes = 0;
    let lastTime = Date.now();
    
    statsInterval = setInterval(async () => {
        bytesSent = 0;
        // Aggregate stats from all peer connections
        for (const [receiverId, pc] of Object.entries(peerConnections)) {
            if (pc && pc.getStats) {
                const stats = await pc.getStats();
                stats.forEach(report => {
                    if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
                        bytesSent += report.bytesSent || 0;
                    }
                });
            }
        }
        
        // Calculate rate
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        const bytesDiff = bytesSent - lastBytes;
        const rate = timeDiff > 0 ? (bytesDiff / timeDiff / 1024).toFixed(2) : 0;
        
        lastBytes = bytesSent;
        lastTime = now;
        
        // Update display
        document.getElementById('bytesSent').textContent = formatBytes(bytesSent);
        document.getElementById('dataRate').textContent = rate + ' KB/s';
        
        const elapsed = Math.floor((now - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        document.getElementById('duration').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, CONFIG.statsUpdateInterval);
}

async function startStreaming() {
    try {
        // Connect to signaling server
        wsUrl = CONFIG.websocket.getUrl();
        
        updateStatus('Connecting to server...');
        ws = new WebSocket(wsUrl);
        
        ws.onopen = async () => {
            updateStatus('Connected to signaling server');
            
            // Register as sender
            ws.send(JSON.stringify({ type: 'register', id: 'sender' }));
            
            // Get microphone access with low-latency constraints
            localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: CONFIG.audio, 
                video: false 
            });
            updateStatus('Microphone access granted - waiting for receivers...');
            
            // Start monitoring stats
            startTime = Date.now();
            document.getElementById('stats').style.display = 'block';
            startStatsMonitoring();
        };
        
        // Function to create peer connection for a receiver
        async function createPeerConnectionForReceiver(receiverId) {
            console.log(`Creating peer connection for receiver: ${receiverId}`);
            
            // Create peer connection
            const pc = new RTCPeerConnection(CONFIG.webrtc);
            peerConnections[receiverId] = pc;
            
            // Add audio track
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
            
            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    ws.send(JSON.stringify({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                        target: receiverId
                    }));
                }
            };
            
            // Create and send offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            ws.send(JSON.stringify({
                type: 'offer',
                offer: offer,
                target: receiverId
            }));
            
            console.log(`Offer sent to ${receiverId}`);
        }
        
        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'new-receiver') {
                // New receiver connected, create peer connection for it
                const receiverId = data.receiverId;
                await createPeerConnectionForReceiver(receiverId);
            } else if (data.type === 'answer') {
                // Answer from a receiver
                const receiverId = data.from;
                if (peerConnections[receiverId]) {
                    await peerConnections[receiverId].setRemoteDescription(data.answer);
                    const count = Object.keys(peerConnections).length;
                    updateStatus(`Connected! Streaming to ${count} receiver(s)...`);
                }
            } else if (data.type === 'ice-candidate') {
                // ICE candidate from a receiver
                const receiverId = data.from;
                if (peerConnections[receiverId]) {
                    await peerConnections[receiverId].addIceCandidate(data.candidate);
                }
            }
        };
        
        ws.onerror = (error) => {
            updateStatus('WebSocket error - is server running?');
            logError('WebSocket connection failed. Trying to connect to: ' + wsUrl, error);
        };
        
        ws.onclose = () => {
            updateStatus('Disconnected from server');
        };
        
        startBtn.disabled = true;
        
    } catch (error) {
        updateStatus(`Error: ${error.message}`);
        logError('Startup error', error);
    }
}

startBtn.addEventListener('click', startStreaming);
