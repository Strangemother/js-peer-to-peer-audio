// Receiver JavaScript - Audio playback through speakers (supports multiple senders)

let ws;
let peerConnections = {};  // Multiple peer connections, one per sender
let wsUrl;
let receiverId;
let bytesReceived = 0;
let startTime;
let statsInterval;
let audioContext;
let mixedAudioDest;

const connectBtn = document.getElementById('connectBtn');
const status = document.getElementById('status');
const remoteAudio = document.getElementById('remoteAudio');
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
        bytesReceived = 0;
        // Aggregate stats from all peer connections
        for (const [senderId, pc] of Object.entries(peerConnections)) {
            if (pc && pc.getStats) {
                const stats = await pc.getStats();
                stats.forEach(report => {
                    if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
                        bytesReceived += report.bytesReceived || 0;
                    }
                });
            }
        }
        
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        const bytesDiff = bytesReceived - lastBytes;
        const rate = timeDiff > 0 ? (bytesDiff / timeDiff / 1024).toFixed(2) : 0;
        
        lastBytes = bytesReceived;
        lastTime = now;
        
        document.getElementById('bytesReceived').textContent = formatBytes(bytesReceived);
        document.getElementById('dataRate').textContent = rate + ' KB/s';
        
        const elapsed = Math.floor((now - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        document.getElementById('duration').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, CONFIG.statsUpdateInterval);
}

async function connectAndListen() {
    try {
        wsUrl = CONFIG.websocket.getUrl();
        
        updateStatus('Connecting to server...');
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            updateStatus('Connected to signaling server, waiting for sender...');
            receiverId = `receiver-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            console.log('Registered as:', receiverId);
            ws.send(JSON.stringify({ type: 'register', id: receiverId }));
        };
        
        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            console.log('Receiver got message:', data.type, data.from);
            
            if (data.type === 'new-sender') {
                // A new sender has joined - proactively create a connection
                const senderId = data.senderId;
                console.log('New sender joined:', senderId);
                updateStatus(`New sender detected: ${senderId}`);
                
                if (!peerConnections[senderId]) {
                    createPeerConnection(senderId);
                }
                
            } else if (data.type === 'offer') {
                const senderId = data.from;
                updateStatus(`Received offer from ${senderId}`);
                
                if (!peerConnections[senderId]) {
                    createPeerConnection(senderId);
                }
                
                const pc = peerConnections[senderId];
                await pc.setRemoteDescription(data.offer);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                console.log('Sending answer to', senderId);
                ws.send(JSON.stringify({
                    type: 'answer',
                    answer: answer,
                    target: senderId,
                    from: receiverId
                }));
                
                updateStatus(`Connection established with ${senderId}`);
                
            } else if (data.type === 'ice-candidate') {
                const senderId = data.from;
                console.log('Received ICE candidate from', senderId);
                
                if (peerConnections[senderId]) {
                    await peerConnections[senderId].addIceCandidate(data.candidate);
                }
                
            } else if (data.type === 'sender-disconnected') {
                const senderId = data.senderId;
                console.log('Sender disconnected:', senderId);
                
                if (peerConnections[senderId]) {
                    peerConnections[senderId].close();
                    delete peerConnections[senderId];
                }
                
                updateStatus(`Sender ${senderId} disconnected`);
            }
        };
        
        ws.onerror = (error) => {
            updateStatus('WebSocket error - is server running?');
            logError('WebSocket connection failed. Trying to connect to: ' + wsUrl, error);
        };
        
        ws.onclose = () => {
            updateStatus('Disconnected from server');
        };
        
        connectBtn.disabled = true;
        
    } catch (error) {
        updateStatus(`Error: ${error.message}`);
        logError('Connection error', error);
    }
}

function setupAudioMixing() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        mixedAudioDest = audioContext.createMediaStreamDestination();
        remoteAudio.srcObject = mixedAudioDest.stream;
        remoteAudio.volume = CONFIG.playback.volume;
        remoteAudio.play().catch(e => {
            updateStatus('Tap to play audio');
            document.body.addEventListener('click', () => {
                remoteAudio.play();
            }, { once: true });
        });
        console.log('Audio mixing setup complete');
    }
}

function createPeerConnection(senderId) {
    console.log('Creating peer connection for sender:', senderId);
    
    const pc = new RTCPeerConnection(CONFIG.webrtc);
    peerConnections[senderId] = pc;
    
    pc.ontrack = (event) => {
        console.log('Received track from', senderId);
        
        // Setup audio mixing on first track
        setupAudioMixing();
        
        // Mix this sender's audio into the output
        const source = audioContext.createMediaStreamSource(event.streams[0]);
        source.connect(mixedAudioDest);
        
        // Start stats on first connection
        if (Object.keys(peerConnections).length === 1) {
            startTime = Date.now();
            document.getElementById('stats').style.display = 'block';
            startStatsMonitoring();
        }
        
        updateStatus(`Receiving audio from ${Object.keys(peerConnections).length} sender(s)`);
    };
    
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('Sending ICE candidate to', senderId);
            ws.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: event.candidate,
                target: senderId,
                from: receiverId
            }));
        }
    };
    
    pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${senderId}:`, pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            delete peerConnections[senderId];
            updateStatus(`Lost connection to ${senderId}`);
        }
    };
    
    return pc;
}

connectBtn.addEventListener('click', connectAndListen);
