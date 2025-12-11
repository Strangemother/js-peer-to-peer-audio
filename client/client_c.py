"""
Client C - Running on port 8030
"""

from client import Client
import time
import random
from threading import Timer


CLIENT_A_URL = "http://localhost:8010"


def perform_work(message):
    """
    Custom work logic for Client C.
    Wait 2-8 seconds then send a message to Client A.
    
    Args:
        message: The message received from the remote caller
    """
    def delayed_send():
        client.send_message(CLIENT_A_URL, f"Ping from Charlie at {time.time()}")
    
    print(f"[Charlie Client] will perform work: {message}")
    # Schedule message to Client A in 2-8 seconds (random)
    delay = random.uniform(2, 8)
    timer = Timer(delay, delayed_send)
    timer.daemon = True
    timer.start()
    return "okay, I'll do that (says Charlie)"


def start_process():
    """Initiate the first message to Client A."""
    print(f"[Charlie Client] Starting ping-pong process...")
    client.send_message(CLIENT_A_URL, f"Initial ping from Charlie at {time.time()}")


if __name__ == "__main__":
    # Create Client C with auto-start after 5 seconds (staggered from Alice)
    client = Client(perform_work, port=8030, name="Charlie Client", auto_start=5, on_start=start_process)
    client.start()
