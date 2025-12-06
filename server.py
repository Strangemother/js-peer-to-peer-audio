#!/usr/bin/env python3
"""
Minimal WebSocket signaling server for WebRTC audio streaming.
Supports broadcasting from one sender to multiple receivers.
"""
import asyncio
import json
import websockets

clients = {}
receivers = set()
python_receivers = set()  # Track Python audio receivers separately

async def handler(websocket):
    client_id = None
    try:
        async for message in websocket:
            # Handle binary audio data (from sender to Python receivers)
            if isinstance(message, bytes):
                # Broadcast raw audio to Python receivers
                for py_receiver_id in list(python_receivers):
                    if py_receiver_id in clients:
                        try:
                            await clients[py_receiver_id].send(message)
                        except:
                            pass
                continue
            
            # Handle JSON messages
            data = json.loads(message)
            
            if data['type'] == 'register':
                client_id = data['id']
                clients[client_id] = websocket
                
                # Track receivers separately
                if client_id == 'receiver' or client_id.startswith('receiver-') or client_id.startswith('python-receiver-'):
                    # Generate unique receiver ID if needed
                    if client_id == 'receiver':
                        client_id = f"receiver-{id(websocket)}"
                        clients[client_id] = websocket
                    
                    # Track Python receivers separately (they receive raw audio, not WebRTC)
                    if client_id.startswith('python-receiver-'):
                        python_receivers.add(client_id)
                        print(f"Python receiver registered: {client_id} (Total: {len(python_receivers)})")
                    else:
                        receivers.add(client_id)
                        print(f"Browser receiver registered: {client_id} (Total: {len(receivers)})")
                        
                        # If sender exists, notify sender of new receiver
                        if 'sender' in clients:
                            await clients['sender'].send(json.dumps({
                                'type': 'new-receiver',
                                'receiverId': client_id
                            }))
                else:
                    print(f"Sender registered: {client_id}")
                    
                    # If this is sender and receivers already exist, notify sender about them
                    if client_id == 'sender':
                        for receiver_id in list(receivers):
                            await clients['sender'].send(json.dumps({
                                'type': 'new-receiver',
                                'receiverId': receiver_id
                            }))
                    
            elif data['type'] in ['offer', 'ice-candidate']:
                # Send to specific target receiver or sender
                target_id = data.get('target')
                if target_id and target_id in clients:
                    modified_data = data.copy()
                    modified_data['from'] = client_id
                    await clients[target_id].send(json.dumps(modified_data))
                    print(f"Relayed {data['type']} from {client_id} to {target_id}")
                        
            elif data['type'] == 'answer':
                # Relay answer from receiver back to sender
                target_id = data.get('target', 'sender')
                if target_id in clients:
                    modified_data = data.copy()
                    modified_data['from'] = client_id
                    await clients[target_id].send(json.dumps(modified_data))
                    print(f"Relayed answer from {client_id} to {target_id}")
                    
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if client_id and client_id in clients:
            if client_id.startswith('python-receiver-'):
                python_receivers.discard(client_id)
                print(f"Python receiver disconnected: {client_id} (Remaining: {len(python_receivers)})")
            elif client_id.startswith('receiver-'):
                receivers.discard(client_id)
                print(f"Browser receiver disconnected: {client_id} (Remaining: {len(receivers)})")
            else:
                print(f"Client disconnected: {client_id}")
            del clients[client_id]

async def main():
    print("Starting signaling server on ws://localhost:8765")
    async with websockets.serve(handler, "localhost", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
