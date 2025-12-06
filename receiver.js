// Receiver JavaScript - Audio playback through speakers

let ws;
let peerConnection;
let wsUrl;
let receiverId;
let bytesReceived = 0;
let startTime;
let statsInterval;
let isConnected = false;

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
        if (peerConnection && peerConnection.getStats) {
            const stats = await peerConnection.getStats();
            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
                    bytesReceived = report.bytesReceived || 0;
                }
            });
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
            console.log('Receiver got message:', data.type);
            
            if (data.type === 'offer') {
                // Ignore duplicate offers if already connected
                if (isConnected) {
                    console.log('Ignoring duplicate offer - already connected');
                    return;
                }
                
                updateStatus('Received offer, setting up connection...');
                
                if (!peerConnection) {
                    peerConnection = new RTCPeerConnection(CONFIG.webrtc);
                    console.log('Created peer connection');
                    
                    peerConnection.ontrack = (event) => {
                        console.log('Received track');
                        isConnected = true;
                        updateStatus('Receiving audio stream!');
                        remoteAudio.srcObject = event.streams[0];
                        remoteAudio.volume = CONFIG.playback.volume;
                        if ('setSinkId' in remoteAudio) {
                            remoteAudio.setSinkId(CONFIG.playback.defaultSinkId).catch(e => console.log('setSinkId not supported'));
                        }
                        remoteAudio.play().catch(e => {
                            updateStatus('Tap to play audio');
                            document.body.addEventListener('click', () => {
                                remoteAudio.play();
                            }, { once: true });
                        });
                        
                        startTime = Date.now();
                        document.getElementById('stats').style.display = 'block';
                        startStatsMonitoring();
                    };
                    
                    peerConnection.onicecandidate = (event) => {
                        if (event.candidate) {
                            console.log('Sending ICE candidate');
                            ws.send(JSON.stringify({
                                type: 'ice-candidate',
                                candidate: event.candidate,
                                target: 'sender',
                                from: receiverId
                            }));
                        }
                    };
                }
                
                await peerConnection.setRemoteDescription(data.offer);
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                
                console.log('Sending answer');
                ws.send(JSON.stringify({
                    type: 'answer',
                    answer: answer,
                    target: 'sender',
                    from: receiverId
                }));
                
                updateStatus('Answer sent, establishing connection...');
                
            } else if (data.type === 'ice-candidate') {
                console.log('Received ICE candidate');
                if (peerConnection) {
                    await peerConnection.addIceCandidate(data.candidate);
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
        
        connectBtn.disabled = true;
        
    } catch (error) {
        updateStatus(`Error: ${error.message}`);
        logError('Connection error', error);
    }
}

connectBtn.addEventListener('click', connectAndListen);
