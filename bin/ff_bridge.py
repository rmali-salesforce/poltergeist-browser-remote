#!/usr/bin/env python3
import sys
import os
import json
import struct
import socket
import threading
import atexit
import uuid

active_socket_path = None
stdout_lock = threading.Lock()
pending_lock = threading.Lock()
pending_requests = {}

def cleanup():
    """Remove the socket file on exit."""
    global active_socket_path
    if active_socket_path and os.path.exists(active_socket_path):
        try:
            os.remove(active_socket_path)
        except OSError:
            pass

atexit.register(cleanup)

def send_to_firefox(payload):
    """Sends length-prefixed JSON to Firefox through stdout."""
    encoded = json.dumps(payload).encode("utf-8")
    with stdout_lock:
        sys.stdout.buffer.write(struct.pack("@I", len(encoded)))
        sys.stdout.buffer.write(encoded)
        sys.stdout.buffer.flush()

def read_from_firefox():
    """Reads a length-prefixed JSON message from Firefox through stdin."""
    raw_len = sys.stdin.buffer.read(4)
    if not raw_len or len(raw_len) < 4:
        return None
    msg_len = struct.unpack("@I", raw_len)[0]
    data = sys.stdin.buffer.read(msg_len)
    return json.loads(data.decode("utf-8"))

def handle_client(conn):
    """Handles an individual inbound socket connection from Hammerspoon."""
    try:
        raw_data = conn.recv(4096)
        if not raw_data:
            conn.close()
            return
        data = json.loads(raw_data.decode("utf-8"))
    except Exception:
        conn.close()
        return

    # Attach a correlation ID for request-response matching
    req_id = uuid.uuid4().hex
    data["req_id"] = req_id

    event = threading.Event()
    box = {}
    with pending_lock:
        pending_requests[req_id] = (event, box)

    # Forward to Firefox background script
    send_to_firefox(data)

    # Await response from Firefox (timeout after 2.0s)
    if event.wait(timeout=2.0):
        resp = box.get("payload", {"success": True})
    else:
        resp = {"success": False, "error": "TIMEOUT"}

    with pending_lock:
        pending_requests.pop(req_id, None)

    # Send response back to Hammerspoon and close
    try:
        conn.sendall(json.dumps(resp).encode("utf-8") + b"\n")
    except Exception:
        pass
    finally:
        conn.close()

def listen_to_unix_socket(profile_name):
    """Listens on /tmp/firefox_<profile>.sock for incoming commands."""
    global active_socket_path
    active_socket_path = f"/tmp/firefox_{profile_name}.sock"
    cleanup()

    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(active_socket_path)
    server.listen(10)

    while True:
        try:
            conn, _ = server.accept()
            # Spawn worker thread so multiple requests never block the listener
            threading.Thread(target=handle_client, args=(conn,), daemon=True).start()
        except Exception:
            break

def main():
    while True:
        msg = read_from_firefox()
        if msg is None:
            break

        msg_type = msg.get("type")

        # Handshake: initialize socket on registration
        if msg_type == "register":
            profile = msg.get("profile", "default")
            threading.Thread(target=listen_to_unix_socket, args=(profile,), daemon=True).start()
            send_to_firefox({
                "type": "registered",
                "profile": profile,
                "socket": f"/tmp/firefox_{profile}.sock"
            })

        # Return journey: dispatch result received from background.js
        elif msg_type == "response":
            req_id = msg.get("req_id")
            with pending_lock:
                if req_id in pending_requests:
                    event, box = pending_requests[req_id]
                    box["payload"] = msg.get("payload")
                    event.set()

if __name__ == "__main__":
    main()
